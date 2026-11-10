import test from "node:test";
import assert from "node:assert/strict";
import { actionState, clampCheckTn, getActorKind, inferActionTypes } from "../system/scripts/services/rule-utils.js";
import { inferActions } from "../system/scripts/dice/action-types.js";
import { ConditionService } from "../system/scripts/services/condition-service.js";
import { OpportunityService } from "../system/scripts/services/opportunity-service.js";
import { OpportunityRepository } from "../system/scripts/services/opportunity-repository.js";
import { RollResolutionService } from "../system/scripts/services/roll-resolution-service.js";
import { CORE_OPPORTUNITIES } from "../system/scripts/data/core-opportunities.js";

const definition = (overrides = {}) => ({
    rulesKey: "test", name: "Test", description: "", sourceReference: {}, ring: "any",
    contexts: { conflictTypes: [], checkKinds: [], actionTypes: [], actionIds: [], skillGroups: [], skillIds: [], techniqueTypes: [], itemTypes: [], initiative: null },
    cost: { base: 1, increment: 1, scalable: false, maxSpend: null }, requirements: {}, timing: "manual",
    target: { mode: "none", filters: {} }, effect: { type: "manual", params: {} }, duration: null, automation: "manual",
    ...overrides,
});

test("ordinary rolls have no default action tags and metadata is structural", () => {
    assert.deepEqual(actionState(), { attack: false, scheme: false, move: false, support: false });
    assert.deepEqual(inferActionTypes(null), []);
    assert.deepEqual(inferActions(null), { attack: false, scheme: false, support: false, move: false });
    assert.deepEqual(inferActionTypes({ system: { activation: { actionTypes: ["Attack", "Movement"] } } }), ["attack", "move"]);
    assert.deepEqual(inferActionTypes({ system: { rulesKey: "path-to-inner-peace", activation: { action_types: [] } } }), ["support"]);
    assert.equal(clampCheckTn(0), 1);
});

test("opportunity compendium data retains newer built-in definitions when the pack is stale", async () => {
    const originalGame = globalThis.game;
    globalThis.game = {
        packs: {
            get: () => ({ getDocuments: async () => [{ id: "old-pack-entry", system: definition({ rulesKey: "old-pack-entry" }) }] }),
        },
    };
    try {
        const repository = new OpportunityRepository({ definitions: CORE_OPPORTUNITIES });
        const loaded = await repository.all();
        assert.ok(loaded.some(({ rulesKey }) => rulesKey === "path-to-inner-peace-remove-condition"));
        assert.ok(loaded.some(({ rulesKey }) => rulesKey === "path-to-inner-peace-remove-strife"));
        assert.ok(loaded.some(({ rulesKey }) => rulesKey === "old-pack-entry"));
    } finally {
        if (originalGame === undefined) delete globalThis.game;
        else globalThis.game = originalGame;
    }
});

test("Path to Inner Peace restores Water Ring plus bonus successes to the target", async () => {
    const conditions = new ConditionService();
    const opportunities = new OpportunityService({ repository: new OpportunityRepository({ definitions: [] }), conditionService: conditions });
    const rolls = new RollResolutionService({ opportunityService: opportunities, conditionService: conditions });
    const actor = { uuid: "Actor.A", system: { rings: { water: 3 } } };
    const target = { uuid: "Actor.T", system: { fatigue: { value: 5 } } };
    const item = { uuid: "Actor.A.Item.P", system: { rulesKey: "path-to-inner-peace" } };
    const resolution = await rolls.resolve({
        context: { actor, targetActor: target, item, ring: "water", stance: "water", actionTypes: ["support"], tn: 2, lifecycle: { sceneId: "Scene.test" } },
        rawSymbols: { success: 3, explosive: 0, opportunity: 0, strife: 0 },
    });
    assert.deepEqual(resolution.effects.action.techniqueEffects, [{
        type: "resource", resource: "fatigue", amount: -4, targetUuid: "Actor.T", rulesKey: "path-to-inner-peace",
    }]);
    const mutations = await rolls.buildMutations(resolution, { actor, targetActor: target, item, resolver: async (uuid) => uuid === target.uuid ? target : actor });
    assert.ok(mutations.some((mutation) => mutation.documentUuid === target.uuid && mutation.path === "system.fatigue.value" && mutation.after === 1));
    assert.ok(mutations.some((mutation) => mutation.documentUuid === target.uuid && mutation.path === "flags.l5r5e.pathToInnerPeaceUsage" && mutation.after.sceneId === "Scene.test"));
});

test("Path to Inner Peace cannot affect the same target twice in one scene", async () => {
    const conditions = new ConditionService();
    const opportunities = new OpportunityService({ repository: new OpportunityRepository({ definitions: CORE_OPPORTUNITIES }), conditionService: conditions });
    const rolls = new RollResolutionService({ opportunityService: opportunities, conditionService: conditions });
    const actor = { uuid: "Actor.A", system: { rings: { water: 3 } } };
    const target = { uuid: "Actor.T", flags: { l5r5e: { pathToInnerPeaceUsage: { sceneId: "Scene.test" } } }, system: { fatigue: { value: 5 } } };
    const result = await rolls.resolve({
        context: { actor, targetActor: target, item: { system: { rulesKey: "path-to-inner-peace" } }, actionId: "path-to-inner-peace", actionTypes: ["support"], ring: "water", tn: 2, lifecycle: { sceneId: "Scene.test" } },
        rawSymbols: { success: 2, opportunity: 0 },
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "techniqueAlreadyUsed");
});

test("resource reductions from one resolution are combined before clamping at zero", async () => {
    const rolls = new RollResolutionService();
    const actor = { uuid: "Actor.A", system: { fatigue: { value: 2 } } };
    const resolution = {
        context: { actorUuid: actor.uuid },
        effects: {
            afterSuccess: [{ type: "resource", resource: "fatigue", amount: -1, rulesKey: "second-wind" }],
            action: { techniqueEffects: [{ type: "resource", resource: "fatigue", amount: -5, targetUuid: actor.uuid, rulesKey: "path-to-inner-peace" }] },
        },
    };
    const mutations = await rolls.buildMutations(resolution, { actor, resolver: async () => actor });
    assert.deepEqual(mutations.filter(({ path }) => path === "system.fatigue.value").map(({ before, after }) => [before, after]), [[2, 0]]);
});

test("Path to Inner Peace exposes and applies its condition and bonus-success Strife Opportunities", async () => {
    const conditions = new ConditionService();
    const opportunities = new OpportunityService({ repository: new OpportunityRepository({ definitions: CORE_OPPORTUNITIES }), conditionService: conditions });
    const rolls = new RollResolutionService({ opportunityService: opportunities, conditionService: conditions });
    const actor = { uuid: "Actor.A", system: { rings: { water: 3 } } };
    const target = { uuid: "Actor.T", statuses: new Set(["dazed"]), system: { fatigue: { value: 5 }, strife: { value: 4 } } };
    const result = await rolls.resolve({
        context: { actor, targetActor: target, item: { system: { rulesKey: "path-to-inner-peace" } }, actionId: "path-to-inner-peace", actionTypes: ["support"], conflictType: "skirmish", ring: "water", tn: 2 },
        rawSymbols: { success: 3, opportunity: 2 },
        opportunityPlan: [
            { rulesKey: "path-to-inner-peace-remove-condition" },
            { rulesKey: "path-to-inner-peace-remove-strife" },
        ],
        decisions: {
            "path-to-inner-peace-remove-condition": { condition: "dazed", targetUuid: target.uuid },
            "path-to-inner-peace-remove-strife": { targetUuid: target.uuid },
        },
    });
    assert.notEqual(result.status, "blocked");
    assert.ok(result.effects.afterSuccess.some((effect) => effect.type === "condition" && effect.condition === "dazed"));
    assert.ok(result.effects.afterSuccess.some((effect) => effect.type === "priorStrifeReduction" && effect.amount === 1));
    const mutations = await rolls.buildMutations(result, { actor, targetActor: target, resolver: async (uuid) => uuid === target.uuid ? target : actor });
    assert.ok(mutations.some((mutation) => mutation.documentUuid === target.uuid && mutation.path === "statuses.dazed" && mutation.after === false));
    assert.ok(mutations.some((mutation) => mutation.documentUuid === target.uuid && mutation.path === "system.strife.value" && mutation.after === 3));
});

test("NPC document type and subtype are kept separate", () => {
    assert.equal(getActorKind({ type: "npc", system: { type: "minion" } }), "minion");
    assert.equal(getActorKind({ type: "npc", system: { type: "adversary" } }), "adversary");
    assert.equal(getActorKind({ type: "character", system: { type: "minion" } }), "character");
});

test("TN modifiers are applied once and Silenced uses intrigue/technique context", () => {
    const service = new ConditionService();
    const actor = { statuses: new Set(["dazed", "silenced", "lightly_wounded_fire"]) };
    const result = service.finalTn({ actor, ring: "fire", actionTypes: ["attack", "attack"], conflictType: "intrigue", baseTn: 1 });
    assert.equal(result.value, 7);
    assert.deepEqual(result.reasons.map(({ key }) => key).sort(), ["dazed", "lightlyWounded", "silenced"]);
    assert.equal(service.finalTn({ actor, ring: "water", actionTypes: ["support"], techniqueType: "invocation", baseTn: 1 }).value, 4);
    const damaged = { system: { properties: [{ rulesKey: "damaged" }] } };
    assert.equal(service.finalTn({ actor: { statuses: new Set() }, item: damaged, baseTn: 2 }).value, 3);
    assert.equal(service.validateAction({ actor: { statuses: new Set() }, item: { system: { properties: [{ rulesKey: "destroyed" }] } } }).legal, false);
    const thresholdActor = { type: "character", system: { fatigue: { value: 2 }, strife: { value: 2 }, endurance: 3, composure: 3 } };
    assert.equal(service.thresholdState(thresholdActor, { "system.endurance": 1 }).incapacitated, true);
    assert.equal(service.thresholdState(thresholdActor, { "system.composure": 1 }).compromised, true);
});

test("Incapacitated restricts a check to Void while other actors retain configured Rings", () => {
    const service = new ConditionService();
    const incapacitated = { statuses: new Set(["incapacitated"]) };
    assert.deepEqual(service.allowedRingsForCheck(incapacitated), ["void"]);
    assert.deepEqual(service.allowedRingsForCheck(incapacitated, { allowedRings: ["air", "fire"] }), ["void"]);
    assert.deepEqual(service.allowedRingsForCheck({ statuses: new Set() }, { allowedRings: ["air", "fire"] }), ["air", "fire"]);
});

test("Fire adds effective bonus successes only after raw success", async () => {
    const conditions = new ConditionService();
    const opportunities = new OpportunityService({ repository: new OpportunityRepository({ definitions: [] }), conditionService: conditions });
    const rolls = new RollResolutionService({ opportunityService: opportunities, conditionService: conditions });
    const failed = await rolls.resolve({ context: { stance: "fire", tn: 1 }, rawSymbols: { success: 0, explosive: 0, opportunity: 0, strife: 3 } });
    assert.equal(failed.effective.success, false);
    assert.equal(failed.effective.fireBonusSuccesses, 0);
    const success = await rolls.resolve({ context: { stance: "fire", tn: 1 }, rawSymbols: { success: 2, explosive: 0, opportunity: 0, strife: 2 } });
    assert.equal(success.effective.success, true);
    assert.equal(success.effective.rawBonusSuccesses, 1);
    assert.equal(success.effective.fireBonusSuccesses, 2);
    assert.equal(success.effective.bonusSuccesses, 3);
});

test("Compromised remains provisional until Void preValidation opportunity", async () => {
    const ignore = definition({ rulesKey: "ignore", ring: "void", cost: { base: 2, increment: 1, scalable: false, maxSpend: null }, requirements: { conditionChoice: true }, timing: "preValidation", effect: { type: "ignore-condition", params: {} }, automation: "confirm" });
    const conditions = new ConditionService();
    const opportunities = new OpportunityService({ repository: new OpportunityRepository({ definitions: [ignore] }), conditionService: conditions });
    const rolls = new RollResolutionService({ opportunityService: opportunities, conditionService: conditions });
    const actor = { uuid: "Actor.A", statuses: new Set(["compromised"]) };
    const blocked = await rolls.resolve({ context: { actor, stance: "void", tn: 1 }, rawSymbols: { success: 1, explosive: 0, opportunity: 2, strife: 1 } });
    assert.equal(blocked.status, "blocked");
    const legal = await rolls.resolve({ context: { actor, stance: "void", tn: 1 }, rawSymbols: { success: 1, explosive: 0, opportunity: 2, strife: 1 }, opportunityPlan: [{ rulesKey: "ignore", spend: 2 }], decisions: { ignore: { condition: "compromised" } } });
    assert.equal(legal.status, "resolved");
    assert.equal(legal.strife.voidPrevented, 1);
});

test("opportunity filtering, scalable budget and one instance per check", async () => {
    const defs = [
        definition({ rulesKey: "air-attack", ring: "air", contexts: { ...definition().contexts, actionTypes: ["attack"] } }),
        definition({ rulesKey: "air-scale", ring: "air", cost: { base: 1, increment: 1, scalable: true, maxSpend: null } }),
        definition({ rulesKey: "fire", ring: "fire" }),
    ];
    const service = new OpportunityService({ repository: new OpportunityRepository({ definitions: defs }) });
    const available = await service.available({ ring: "air", actionTypes: ["attack"] });
    assert.deepEqual(available.map(({ rulesKey }) => rulesKey), ["air-attack", "air-scale"]);
    assert.equal(service.validatePlan(available, [{ rulesKey: "air-scale", spend: 3 }], 2).valid, false);
    assert.equal(service.validatePlan(available, [{ rulesKey: "air-attack" }, { rulesKey: "air-attack" }], 3).errors[0].code, "duplicate");
    const direct = await service.available({ ring: "air", actionTypes: ["support"], directOpportunityKeys: ["air-attack"] });
    assert.ok(direct.some(({ rulesKey }) => rulesKey === "air-attack"));
});

test("Strife ledger covers Void, universal/Water reduction and Intoxicated", () => {
    const service = new ConditionService();
    const actor = { statuses: new Set(["intoxicated"]) };
    assert.deepEqual(service.calculateStrife({ actor, stance: "void", rawKeptStrife: 3, otherGains: 1 }), { rawKept: 3, voidPrevented: 3, universalRemoved: 0, waterRemoved: 0, otherGains: 1, multiplier: 2, gained: 2, removed: 0, net: 2 });
    const ledger = service.calculateStrife({ actor, stance: "air", rawKeptStrife: 3, checkReduction: 1, priorReduction: 2 });
    assert.equal(ledger.gained, 4);
    assert.equal(ledger.removed, 6);
    assert.equal(ledger.net, 0);
});

test("targeted Strife removal does not reduce the rolling actor and creates a target mutation", async () => {
    const targeted = definition({ rulesKey: "target-remove", ring: "earth", target: { mode: "single", filters: {} }, timing: "strife", effect: { type: "remove-strife", params: { amount: 2 } }, automation: "confirm" });
    const conditions = new ConditionService();
    const opportunities = new OpportunityService({ repository: new OpportunityRepository({ definitions: [targeted] }), conditionService: conditions });
    const rolls = new RollResolutionService({ opportunityService: opportunities, conditionService: conditions });
    const actor = { uuid: "Actor.A", statuses: new Set(), system: { strife: { value: 1 } } };
    const target = { uuid: "Actor.T", statuses: new Set(), system: { strife: { value: 4 } } };
    const resolution = await rolls.resolve({ context: { actor, targetActor: target, stance: "earth", tn: 1 }, rawSymbols: { success: 1, explosive: 0, opportunity: 1, strife: 1 }, opportunityPlan: [{ rulesKey: "target-remove" }], decisions: { "target-remove": { targetUuid: target.uuid } } });
    assert.equal(resolution.strife.net, 1);
    const mutations = await rolls.buildMutations(resolution, { actor, targetActor: target, resolver: async (uuid) => uuid === target.uuid ? target : actor });
    assert.ok(mutations.some((mutation) => mutation.documentUuid === target.uuid && mutation.path === "system.strife.value" && mutation.after === 2));
    assert.deepEqual(resolution.audit.map(({ phase }) => phase), ["normalize", "dice", "symbols", "opportunities", "spending", "preValidation", "validation", "strife", "opportunityTimings", "success", "actionEffects", "commit"]);
});

test("deferred TN effects apply once to the chosen Ring and are consumed by the transaction", async () => {
    const conditions = new ConditionService();
    const opportunities = new OpportunityService({ repository: new OpportunityRepository({ definitions: [] }), conditionService: conditions });
    const rolls = new RollResolutionService({ opportunityService: opportunities, conditionService: conditions });
    const pending = { type: "tnModifier", selector: "chosenRing", ring: "air", amount: -1, rulesKey: "future", transactionId: "old" };
    const actor = { uuid: "Actor.A", statuses: new Set(), flags: { l5r5e: { pendingRuleEffects: [pending] } }, system: { strife: { value: 0 } } };
    const resolution = await rolls.resolve({ context: { actor, stance: "air", baseTn: 2 }, rawSymbols: { success: 1, explosive: 0, opportunity: 0, strife: 0 } });
    assert.equal(resolution.tn.value, 1);
    const mutations = await rolls.buildMutations(resolution, { actor });
    assert.deepEqual(mutations.find((mutation) => mutation.path === "flags.l5r5e.pendingRuleEffects").after, []);
});

test("an opportunity that inflicts a critical strike becomes an explicit workflow effect", async () => {
    const critical = definition({ rulesKey: "air-critical", ring: "air", target: { mode: "single", filters: {} }, timing: "afterSuccess", effect: { type: "critical", params: { amount: 4 } }, automation: "confirm" });
    const conditions = new ConditionService();
    const opportunities = new OpportunityService({ repository: new OpportunityRepository({ definitions: [critical] }), conditionService: conditions });
    const rolls = new RollResolutionService({ opportunityService: opportunities, conditionService: conditions });
    const actor = { uuid: "Actor.A", statuses: new Set() };
    const target = { uuid: "Actor.T", statuses: new Set() };
    const resolution = await rolls.resolve({
        context: { actor, targetActor: target, stance: "air", tn: 1 },
        rawSymbols: { success: 1, explosive: 0, opportunity: 1, strife: 0 },
        opportunityPlan: [{ rulesKey: "air-critical" }],
        decisions: { "air-critical": { targetUuid: target.uuid } },
    });
    assert.deepEqual(resolution.effects.action.directCriticals, [{ type: "critical", severity: 4, targetUuid: target.uuid, rulesKey: "air-critical" }]);
});

test("Strike critical requires the stable actionId, success, a target, and a non-Earth target", async () => {
    const strike = CORE_OPPORTUNITIES.find(({ rulesKey }) => rulesKey === "strike-critical");
    const service = new OpportunityService({ repository: new OpportunityRepository({ definitions: [strike] }) });
    const base = { ring: "air", conflictType: "skirmish", actionTypes: ["attack"], actionId: "strike", provisionalSuccess: true };
    assert.deepEqual((await service.available(base)).map(({ rulesKey }) => rulesKey), ["strike-critical"]);
    assert.equal((await service.available({ ...base, actionId: null })).length, 0);
    assert.equal((await service.available({ ...base, actionId: "soaring-slice" })).length, 0);
    assert.equal((await service.available({ ...base, provisionalSuccess: false })).length, 0);
    assert.equal((await service.available({ ...base, targetActor: { system: { stance: "earth" } } })).length, 0);
    assert.equal(service.validatePlan([strike], [{ rulesKey: "strike-critical" }], 2).errors[0].code, "targetRequired");
});

test("Strike critical severity is frozen from the attack-profile snapshot", async () => {
    const strike = CORE_OPPORTUNITIES.find(({ rulesKey }) => rulesKey === "strike-critical");
    const conditions = new ConditionService();
    const opportunities = new OpportunityService({ repository: new OpportunityRepository({ definitions: [strike] }), conditionService: conditions });
    const damage = { resolve: () => ({ fatigue: 0 }), razorEdgedDamage: () => null, qualities: { armorResistance: () => 0 } };
    const rolls = new RollResolutionService({ opportunityService: opportunities, conditionService: conditions, damageService: damage });
    const actor = { uuid: "Actor.A", statuses: new Set() };
    const target = { uuid: "Actor.T", statuses: new Set(), system: { stance: "air" }, items: [] };
    const resolution = await rolls.resolve({
        context: { actor, targetActor: target, stance: "air", tn: 1, conflictType: "skirmish", actionTypes: ["attack"], actionId: "strike", attackProfileSnapshot: { deadliness: 7, damage: 3 } },
        rawSymbols: { success: 2, explosive: 0, opportunity: 2, strife: 0 },
        opportunityPlan: [{ rulesKey: "strike-critical", spend: 2 }],
        decisions: { "strike-critical": { targetUuid: target.uuid } },
    });
    assert.deepEqual(resolution.effects.action.directCriticals, [{ type: "critical", severity: 7, targetUuid: target.uuid, rulesKey: "strike-critical" }]);
    assert.equal(resolution.context.attackProfileSnapshot.deadliness, 7);
});

test("Heartpiercing Strike creates an immediate critical at deadliness plus bonus successes, without ordinary damage", async () => {
    const conditions = new ConditionService();
    const opportunities = new OpportunityService({ repository: new OpportunityRepository({ definitions: [] }), conditionService: conditions });
    const damage = { resolve: () => { throw new Error("Heartpiercing Strike must not resolve ordinary attack damage"); }, razorEdgedDamage: () => null };
    const rolls = new RollResolutionService({ opportunityService: opportunities, conditionService: conditions, damageService: damage });
    const actor = { uuid: "Actor.A", statuses: new Set() };
    const target = { uuid: "Actor.T", statuses: new Set(), system: { stance: "water" } };
    const item = { uuid: "Actor.A.Item.H", system: { rulesKey: "heartpiercing-strike" } };
    const resolution = await rolls.resolve({
        context: { actor, targetActor: target, item, ring: "fire", stance: "fire", conflictType: "skirmish", actionTypes: ["attack", "move"], actionId: "heartpiercing-strike", tn: 4, attackProfileSnapshot: { damage: 4, deadliness: 5 } },
        rawSymbols: { success: 5, explosive: 0, opportunity: 0, strife: 0 },
    });
    assert.deepEqual(resolution.effects.action.directCriticals, [{ type: "critical", severity: 6, targetUuid: target.uuid, mitigationTn: 3, rulesKey: "heartpiercing-strike" }]);
    assert.equal(resolution.effects.action.damage, undefined);
});

test("Heartpiercing Strike failure applies Disoriented to the attacker", async () => {
    const conditions = new ConditionService();
    const opportunities = new OpportunityService({ repository: new OpportunityRepository({ definitions: [] }), conditionService: conditions });
    const rolls = new RollResolutionService({ opportunityService: opportunities, conditionService: conditions });
    const actor = { uuid: "Actor.A", statuses: new Set() };
    const target = { uuid: "Actor.T", statuses: new Set() };
    const item = { uuid: "Actor.A.Item.H", system: { rulesKey: "heartpiercing-strike" } };
    const resolution = await rolls.resolve({
        context: { actor, targetActor: target, item, ring: "fire", stance: "fire", conflictType: "skirmish", actionTypes: ["attack", "move"], actionId: "heartpiercing-strike", tn: 4, attackProfileSnapshot: { damage: 4, deadliness: 5 } },
        rawSymbols: { success: 0, explosive: 0, opportunity: 0, strife: 0 },
    });
    assert.deepEqual(resolution.effects.action.techniqueEffects, [{ type: "condition", operation: "add", condition: "disoriented", targetUuid: actor.uuid, rulesKey: "heartpiercing-strike" }]);
});

// A deferred resource debit belongs to the same transaction as the legal check.
test("provisional Void defers resources until a legal preValidation bypass and recalculates TN", async () => {
    const conditions = new ConditionService();
    const opportunities = new OpportunityService({ repository: new OpportunityRepository({ definitions: CORE_OPPORTUNITIES }), conditionService: conditions });
    const rolls = new RollResolutionService({ opportunityService: opportunities, conditionService: conditions });
    const actor = { uuid: "Actor.Void", statuses: new Set(["dazed"]), system: { void_points: { value: 2, max: 3 } } };
    const result = await rolls.resolve({
        context: { actor, ring: "void", conflictType: "skirmish", actionTypes: ["attack"], baseTn: 2, deferredVoidPointDelta: -1 },
        rawSymbols: { success: 2, opportunity: 2 },
        opportunityPlan: [{ rulesKey: "conflict-void-ignore-condition", spend: 2 }],
        decisions: { "conflict-void-ignore-condition": { condition: "dazed" } },
    });
    assert.notEqual(result.status, "blocked");
    assert.equal(result.effective.success, true);
    assert.equal(result.tn.value, 2);
    assert.equal(actor.system.void_points.value, 2);
    const mutations = await rolls.buildMutations(result, { actor, resolver: async () => actor });
    const debit = mutations.find(({ path }) => path === "system.void_points.value");
    assert.deepEqual([debit.before, debit.after], [2, 1]);
    assert.ok(mutations.some(({ path }) => path === "flags.l5r5e.conditionSuspensions"));
});

test("critical mitigation remains a reactive check for incapacitated or unconscious targets and uses their stance", async () => {
    const conditions = new ConditionService();
    const opportunities = new OpportunityService({ repository: new OpportunityRepository({ definitions: [] }), conditionService: conditions });
    const rolls = new RollResolutionService({ opportunityService: opportunities, conditionService: conditions });
    for (const condition of ["incapacitated", "unconscious"]) {
        const actor = { uuid: "Actor.Target", statuses: new Set([condition]) };
        assert.deepEqual(conditions.allowedRingsForCheck(actor, { allowedRings: ["earth"], checkKind: "critical-mitigation" }), ["earth"]);
        const result = await rolls.resolve({ context: { actor, checkKind: "critical-mitigation", ring: "earth", baseTn: 1 }, rawSymbols: { success: 0, opportunity: 0, strife: 0 } });
        assert.notEqual(result.status, "blocked");
        assert.equal(result.effective.success, false);
        assert.equal(conditions.validateAction({ actor, checkKind: "skill" }).legal, false);
    }
});
