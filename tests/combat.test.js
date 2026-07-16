import test from "node:test";
import assert from "node:assert/strict";
import { ConditionService } from "../system/scripts/services/condition-service.js";
import { DamageService } from "../system/scripts/services/damage-service.js";
import { ItemQualityService } from "../system/scripts/services/item-quality-service.js";
import { CriticalService, criticalOutcome } from "../system/scripts/services/critical-service.js";

const item = (keys, extra = {}) => ({ uuid: "Item.X", system: { properties: keys.map((rulesKey) => ({ rulesKey })), ...extra } });

test("damage increases precede reductions/resistance and zero skips defense", () => {
    const service = new DamageService({ conditionService: new ConditionService(), itemQualityService: new ItemQualityService() });
    const target = { uuid: "Actor.T", type: "character", statuses: new Set(), system: { fatigue: { value: 0 }, endurance: 10, void_points: { value: 1 } } };
    const result = service.resolve({ baseDamage: 3, bonusSuccesses: 2, increases: [2], reductions: [1], resistance: { physical: 3 }, damageType: "physical", target, defenseChoice: "defend" });
    assert.deepEqual(result.ledger, { base: 3, bonusSuccesses: 2, increases: [2], afterIncreases: 7, reductions: [1], afterReductions: 6, resistance: 3, final: 3 });
    assert.equal(result.fatigue, 3);
    const zero = service.resolve({ baseDamage: 2, resistance: 2, target });
    assert.equal(zero.zeroDamage, true);
    assert.equal(zero.fatigue, 0);
    assert.equal(zero.critical, null);
});

test("Incapacitated cannot defend and minion defeat records lethal threshold", () => {
    const conditions = new ConditionService();
    const service = new DamageService({ conditionService: conditions, itemQualityService: new ItemQualityService() });
    const pc = { type: "character", statuses: new Set(["incapacitated"]), system: { fatigue: { value: 8 }, endurance: 8 } };
    assert.equal(service.resolve({ baseDamage: 3, deadliness: 5, target: pc }).critical.severity, 5);
    const minion = { type: "npc", system: { type: "minion", fatigue: { value: 4 }, endurance: 5 }, statuses: new Set() };
    const result = service.resolve({ baseDamage: 2, sourceDamage: 7, target: minion });
    assert.deepEqual(result.minion, { defeated: true, outcome: "lethal" });
    const bleeding = service.resolveBleeding({ actor: pc, strifeReceived: 2, currentFatigue: 8, canDefend: false });
    assert.deepEqual(bleeding.critical, { required: true, severity: 8, source: "bleeding" });
});

test("item quality damage sequence and armor/weapon penalties", () => {
    const service = new ItemQualityService();
    let durable = item(["durable"]);
    let result = service.applyDamage(durable);
    assert.deepEqual(result.after, []);
    let normal = item(result.after);
    result = service.applyDamage(normal);
    assert.deepEqual(result.after, ["damaged"]);
    result = service.applyDamage(item(result.after));
    assert.deepEqual(result.after, ["destroyed"]);
    assert.deepEqual(service.applyDamage(item(["durable", "damaged"])).after, ["damaged"]);
    assert.deepEqual(service.usage(item(["damaged"])), { usable: true, tnModifier: 1 });
    assert.deepEqual(service.armorResistance(item(["damaged"], { armor: { physical: 3, supernatural: 1 } })), { physical: 1, supernatural: 0 });
});

test("Razor-Edged is damaged when successful damage is reduced to zero", () => {
    const qualities = new ItemQualityService();
    const service = new DamageService({ conditionService: new ConditionService(), itemQualityService: qualities });
    const weapon = item(["razor-edged"]);
    const target = { type: "character", statuses: new Set(), system: { fatigue: { value: 0 }, endurance: 10 } };
    const damage = service.resolve({ baseDamage: 3, resistance: 3, target });
    assert.equal(service.razorEdgedDamage({ item: weapon, success: true }, damage).changed, true);
});

test("critical table covers every boundary and severity never drops below zero", () => {
    assert.equal(criticalOutcome(0).armorDamage, true);
    assert.deepEqual(criticalOutcome(3, "fire", { razorEdged: true }).conditions, ["lightly_wounded_fire", "bleeding"]);
    assert.deepEqual(criticalOutcome(5, "air").conditions, ["severely_wounded_air"]);
    assert.deepEqual(criticalOutcome(7).scar, { tier: "minor", requiresGmSelection: true });
    assert.deepEqual(criticalOutcome(9).scar, { tier: "major", requiresGmSelection: true });
    assert.ok(criticalOutcome(12, "earth").conditions.includes("dying"));
    assert.equal(criticalOutcome(12, "earth").dyingRounds, 3);
    assert.equal(criticalOutcome(14, "earth").dyingRounds, 1);
    assert.deepEqual(criticalOutcome(16).conditions, ["dead"]);
    assert.equal(criticalOutcome(-9).severity, 0);
});

test("Shattering Parry branches before commit; minions receive severity as fatigue", () => {
    const qualities = new ItemQualityService();
    const service = new CriticalService({ conditionService: new ConditionService(), itemQualityService: qualities });
    const weapon = item([]);
    const target = { uuid: "Actor.P", type: "character", statuses: new Set() };
    const result = service.resolve({ target, severity: 8, stance: "water", shatteringParryAvailable: true, readiedWeapons: [weapon] }, { shatteringParry: true, weapon, rerolledMitigation: { success: true, bonusSuccesses: 2 }, ring: "water" });
    assert.equal(result.finalSeverity, 5);
    assert.equal(result.shatteringParry.beforeCommit, true);
    const minion = { type: "npc", system: { type: "minion" }, statuses: new Set() };
    assert.equal(service.resolve({ target: minion, severity: 7 }).minionFatigue, 7);
});

test("defense is assigned to an active owner, then falls back to the authority GM", () => {
    const service = new DamageService({ conditionService: new ConditionService() });
    const users = [{ id: "gm", active: true, isGM: true }, { id: "owner", active: true, isGM: false }, { id: "offline", active: false, isGM: false }];
    const target = { ownership: { owner: 3, offline: 3, default: 0 } };
    assert.equal(service.decisionUser(target, users, users[0]).id, "owner");
    users[1].active = false;
    assert.equal(service.decisionUser(target, users, users[0]).id, "gm");
});

test("critical mutations use real Dying status, flags, scar creation and repeated wounds", () => {
    const qualities = new ItemQualityService();
    const service = new CriticalService({ conditionService: new ConditionService(), itemQualityService: qualities });
    const target = { uuid: "Actor.P", type: "character", statuses: new Set(["severely_wounded_fire"]), flags: { l5r5e: {} }, system: { fatigue: { value: 0 } }, items: [] };
    const result = { outcome: criticalOutcome(12, "fire"), minion: false, armorDamage: null, shatteringParry: null };
    const built = service.buildMutations(result, { target, workflow: {}, scarDecision: null });
    assert.equal(built.followUpCritical.severity, 10);
    assert.ok(built.mutations.some((mutation) => mutation.path === "statuses.dying" && mutation.after === true));
    assert.ok(built.mutations.some((mutation) => mutation.path === "flags.l5r5e.dyingRounds" && mutation.after === 3));
    const scar = service.buildMutations({ outcome: criticalOutcome(8, "air"), minion: false }, { target, scarDecision: { scarData: { _id: "scar1", type: "peculiarity" } } });
    assert.equal(scar.createdDocuments[0].parentUuid, target.uuid);
});
