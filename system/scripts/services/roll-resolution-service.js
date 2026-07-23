import { deepClone, documentUuid, makeId, normalizeActionTypes, toFiniteNumber } from "./rule-utils.js";

export const RESOLUTION_PHASES = Object.freeze([
    "normalize", "dice", "symbols", "opportunities", "spending", "preValidation", "validation", "strife",
    "opportunityTimings", "success", "actionEffects", "commit",
]);

function symbolSummary(keptDice = []) {
    return keptDice.reduce((summary, die) => {
        const symbols = die.symbols ?? die;
        summary.success += toFiniteNumber(symbols.success, 0);
        summary.explosive += toFiniteNumber(symbols.explosive, 0);
        summary.opportunity += toFiniteNumber(symbols.opportunity, 0);
        summary.strife += toFiniteNumber(symbols.strife, 0);
        return summary;
    }, { success: 0, explosive: 0, opportunity: 0, strife: 0 });
}

export class RollResolutionService {
    constructor({ opportunityService, conditionService, damageService, criticalService, itemQualityService = null, transactionService } = {}) {
        this.opportunities = opportunityService;
        this.conditions = conditionService;
        this.damage = damageService;
        this.critical = criticalService;
        this.qualities = itemQualityService ?? damageService?.qualities;
        this.transactions = transactionService;
    }

    normalizeContext(context = {}) {
        const attackProfileSnapshot = deepClone(context.attackProfileSnapshot ?? context.rollContext?.attackProfileSnapshot ?? context.item?.attackProfile ?? context.unarmedProfile ?? null);
        return {
            ...context,
            actor: context.actor,
            target: context.target,
            targetActor: context.targetActor ?? context.target?.actor ?? null,
            actorUuid: documentUuid(context.actor),
            targetUuid: documentUuid(context.target ?? context.targetActor),
            item: context.item,
            itemUuid: documentUuid(context.item),
            ring: String(context.ring ?? context.stance ?? "void").toLowerCase(),
            stance: String(context.stance ?? context.ring ?? "void").toLowerCase(),
            actionTypes: normalizeActionTypes(context.actionTypes),
            actionId: typeof context.actionId === "string" && context.actionId.trim() ? context.actionId.trim().toLowerCase() : null,
            attackProfileSnapshot,
            directOpportunityKeys: [...new Set(context.directOpportunityKeys ?? context.item?.system?.activation?.opportunity_rules_keys ?? [])],
            requiresCheck: context.requiresCheck !== false,
            isCheck: context.isCheck !== false,
            ignoredConditions: [...(context.ignoredConditions ?? [])],
        };
    }

    rawSymbols(keptDice = [], supplied = null) {
        return supplied ? { ...symbolSummary([]), ...deepClone(supplied) } : symbolSummary(keptDice);
    }

    preview(context, raw) {
        const normalized = this.normalizeContext(context);
        const tn = context.finalTnOverride === undefined || context.finalTnOverride === null
            ? this.conditions.finalTn({ ...normalized, baseTn: context.baseTn ?? context.tn })
            : { value: Math.max(1, Math.trunc(toFiniteNumber(context.finalTnOverride, 1))), base: context.baseTn ?? context.tn, total: 0, reasons: [{ key: "gmOverride", value: 0 }] };
        const totalSuccess = raw.success + raw.explosive;
        const provisionalSuccess = totalSuccess >= tn.value;
        const rawBonusSuccesses = provisionalSuccess ? Math.max(0, totalSuccess - tn.value) : 0;
        const fireBonusSuccesses = provisionalSuccess && normalized.stance === "fire" ? raw.strife : 0;
        return { context: normalized, tn, raw, totalSuccess, provisionalSuccess, rawBonusSuccesses, fireBonusSuccesses, bonusSuccesses: rawBonusSuccesses + fireBonusSuccesses };
    }

    async resolve({ context = {}, keptDice = [], rawSymbols: suppliedSymbols = null, opportunityDefinitions = null, opportunityPlan = [], decisions = {}, commit = false } = {}) {
        const audit = [];
        const normalized = this.normalizeContext(context);
        audit.push({ phase: "normalize" });
        const dice = deepClone(keptDice);
        audit.push({ phase: "dice", count: dice.length });
        const raw = this.rawSymbols(dice, suppliedSymbols);
        audit.push({ phase: "symbols", raw: deepClone(raw) });

        let preview = this.preview(normalized, raw);
        const available = await this.opportunities.available({ ...preview.context, provisionalSuccess: preview.provisionalSuccess }, opportunityDefinitions);
        audit.push({ phase: "opportunities", available: available.map(({ rulesKey }) => rulesKey) });
        const plan = this.opportunities.validatePlan(available, opportunityPlan, raw.opportunity, decisions);
        audit.push({ phase: "spending", spent: plan.spent, remaining: plan.remaining, errors: plan.errors });
        if (!plan.valid) return this.#blocked(preview, plan, audit, "opportunityPlan");

        const preValidation = this.opportunities.executeTiming("preValidation", plan, { ...preview.context, conditionSuspensionExpiry: context.conditionSuspensionExpiry });
        const ignoredConditions = [...preview.context.ignoredConditions, ...preValidation.filter((effect) => effect.type === "ignoreCondition").map((effect) => effect.condition).filter(Boolean)];
        preview.context.ignoredConditions = [...new Set(ignoredConditions)];
        audit.push({ phase: "preValidation", effects: deepClone(preValidation) });

        const actionLegality = this.conditions.validateAction(preview.context);
        const diceLegality = this.conditions.validateKeptDice(preview.context, raw);
        const legal = actionLegality.legal && diceLegality.legal;
        audit.push({ phase: "validation", legal, errors: [...actionLegality.errors, ...diceLegality.errors] });
        if (!legal) return this.#blocked(preview, plan, audit, "provisionalIllegality", [...actionLegality.errors, ...diceLegality.errors]);

        const timingEffects = {};
        for (const timing of ["strife", "beforeSuccess", "afterSuccess", "beforeDamage", "afterDamage", "deferred", "manual"]) {
            timingEffects[timing] = this.opportunities.executeTiming(timing, plan, preview.context);
        }
        const allEffects = [preValidation, ...Object.values(timingEffects)].flat();
        const checkReduction = allEffects.filter((effect) => effect.type === "checkStrifeReduction").reduce((sum, effect) => sum + effect.amount, 0);
        const priorReduction = allEffects
            .filter((effect) => effect.type === "priorStrifeReduction" && (!effect.targetUuid || effect.targetUuid === preview.context.actorUuid))
            .reduce((sum, effect) => sum + effect.amount, 0);
        const strife = this.conditions.calculateStrife({ actor: context.actor, stance: preview.context.stance, rawKeptStrife: raw.strife, checkReduction, priorReduction, otherGains: context.otherStrifeGains, ignoredConditions: preview.context.ignoredConditions });
        audit.push({ phase: "strife", ledger: deepClone(strife) });
        audit.push({ phase: "opportunityTimings", effects: deepClone(timingEffects) });

        const success = preview.totalSuccess >= preview.tn.value;
        const rawBonusSuccesses = success ? Math.max(0, preview.totalSuccess - preview.tn.value) : 0;
        const fireBonusSuccesses = success && preview.context.stance === "fire" ? raw.strife : 0;
        const bonusSuccesses = rawBonusSuccesses + fireBonusSuccesses;
        audit.push({ phase: "success", success, rawBonusSuccesses, fireBonusSuccesses, bonusSuccesses });

        const actionEffects = {};
        const resistanceEffects = timingEffects.beforeDamage.filter((effect) => effect.type === "resistanceModifier");
        const adjustedResistance = (resistance) => {
            if (typeof resistance === "number") {
                const modifier = resistanceEffects.reduce((sum, effect) => sum + toFiniteNumber(effect.amount, 0), 0);
                return Math.max(0, resistance + modifier);
            }
            const result = { ...(resistance ?? {}) };
            for (const effect of resistanceEffects) {
                const type = effect.damageType === "supernatural" ? "supernatural" : "physical";
                result[type] = Math.max(0, toFiniteNumber(result[type], 0) + toFiniteNumber(effect.amount, 0));
            }
            return result;
        };
        if (success && context.damage) actionEffects.damage = this.damage.resolve({ ...context.damage, resistance: adjustedResistance(context.damage.resistance), source: context.actor, target: preview.context.targetActor, bonusSuccesses, success, defenseChoice: decisions.defense?.choice ?? context.damage.defenseChoice });
        else if (success && preview.context.actionTypes.includes("attack")) {
            const profile = preview.context.attackProfileSnapshot;
            if (profile && preview.context.targetActor) {
                const wornArmor = [...(preview.context.targetActor.items ?? [])].find((candidate) => candidate.type === "armor" && candidate.system?.equipped);
                const resistance = context.resistance ?? (wornArmor ? this.qualities?.armorResistance?.(wornArmor) : 0);
                actionEffects.damage = this.damage.resolve({
                    baseDamage: profile.damage,
                    deadliness: profile.deadliness,
                    damageType: context.damageType ?? profile.damageType ?? "physical",
                    resistance: adjustedResistance(resistance),
                    source: context.actor,
                    target: preview.context.targetActor,
                    item: context.item,
                    bonusSuccesses,
                    success,
                    defenseChoice: decisions.defense?.choice,
                });
            } else {
                actionEffects.attack = { status: "manual", warning: profile ? "targetRequired" : "weaponProfileRequired" };
            }
        }
        if (context.critical) actionEffects.critical = this.critical.resolve({ ...context.critical, sourceActor: context.actor, target: preview.context.targetActor }, decisions.critical ?? {});
        const directCriticals = allEffects.filter((effect) => effect.type === "critical");
        if (directCriticals.length) actionEffects.directCriticals = directCriticals.map((effect) => deepClone(effect));
        if (actionEffects.damage) actionEffects.itemDamage = this.damage.razorEdgedDamage({ item: context.item, success }, actionEffects.damage);
        audit.push({ phase: "actionEffects", effects: deepClone(actionEffects) });

        const resolution = {
            schemaVersion: 1,
            transactionId: context.transactionId ?? makeId("resolution"),
            revision: toFiniteNumber(context.revision, 1),
            status: "resolved",
            context: this.#snapshotContext(preview.context),
            keptDice: dice,
            tn: preview.tn,
            raw: { ...raw, totalSuccess: preview.totalSuccess },
            effective: { success, rawBonusSuccesses, fireBonusSuccesses, bonusSuccesses },
            strife,
            opportunities: { generated: raw.opportunity, spent: plan.spent, remaining: plan.remaining, selections: plan.selections.map(({ rulesKey, cost, decision, definition }) => ({ rulesKey, cost, decision, timing: definition.timing, automation: definition.automation })) },
            effects: { preValidation, ...timingEffects, action: actionEffects },
            audit,
        };
        if (commit && typeof context.commit === "function") {
            resolution.transaction = await context.commit(resolution);
            resolution.status = resolution.transaction?.ok === false ? "conflict" : "applied";
        }
        audit.push({ phase: "commit", status: resolution.status });
        return resolution;
    }

    async buildMutations(resolution, { actor = null, targetActor = null, item = null, resolver = null } = {}) {
        const resolveUuid = resolver ?? ((uuid) => globalThis.fromUuid?.(uuid));
        const mutations = [];
        const indexed = new Map();
        const resourcePath = { strife: "system.strife.value", fatigue: "system.fatigue.value", void: "system.void_points.value", void_points: "system.void_points.value", initiative: "initiative" };
        const actorDocument = actor ?? (resolution.context.actorUuid ? await resolveUuid(resolution.context.actorUuid) : null);
        const targetDocument = targetActor ?? (resolution.context.targetUuid ? await resolveUuid(resolution.context.targetUuid) : null);
        const usedItem = item ?? (resolution.context.itemUuid ? await resolveUuid(resolution.context.itemUuid) : null);
        const asActor = (document) => document?.actor ?? document;

        const addMutation = (mutation) => {
            if (!mutation?.documentUuid || !mutation.path) return;
            const key = `${mutation.documentUuid}:${mutation.path}`;
            const previous = indexed.get(key);
            if (previous && typeof previous.after === "number" && typeof mutation.before === "number" && typeof mutation.after === "number") {
                previous.after += mutation.after - mutation.before;
                previous.reason = `${previous.reason},${mutation.reason}`;
                previous.options = { ...(previous.options ?? {}), ...(mutation.options ?? {}) };
                return;
            }
            if (previous && Array.isArray(previous.before) && Array.isArray(previous.after) && Array.isArray(mutation.after)) {
                previous.after.push(...mutation.after.slice(mutation.before.length));
                previous.reason = `${previous.reason},${mutation.reason}`;
                return;
            }
            if (previous && previous.before && previous.after && mutation.after && [previous.before, previous.after, mutation.after].every((value) => Object.getPrototypeOf(value) === Object.prototype)) {
                previous.after = { ...previous.after, ...mutation.after };
                previous.reason = `${previous.reason},${mutation.reason}`;
                return;
            }
            indexed.set(key, mutation);
            mutations.push(mutation);
        };
        const addResource = (document, resource, amount, reason, { intoxicated = false } = {}) => {
            const target = asActor(document);
            const path = resourcePath[resource];
            if (!target?.uuid || !path || path === "initiative") return false;
            const before = toFiniteNumber(resource === "void" || resource === "void_points" ? target.system?.void_points?.value : target.system?.[resource]?.value, 0);
            const multiplier = resource === "strife" && intoxicated ? 2 : 1;
            addMutation({ documentUuid: target.uuid, path, before, after: Math.max(0, before + toFiniteNumber(amount, 0) * multiplier), reason });
            return true;
        };

        if (actorDocument && resolution.strife?.net) addResource(actorDocument, "strife", resolution.strife.net, "rollStrife");

        const effectGroups = resolution.effects ?? {};
        const effects = [effectGroups.preValidation, effectGroups.strife, effectGroups.beforeSuccess, effectGroups.afterSuccess, effectGroups.beforeDamage, effectGroups.afterDamage, effectGroups.deferred, effectGroups.manual].flat().filter(Boolean);
        for (const effect of effects) {
            let document = effect.targetUuid ? await resolveUuid(effect.targetUuid) : actorDocument;
            document = asActor(document);
            if (effect.type === "resource") {
                const intoxicated = this.conditions?.isActive?.(document, "intoxicated") ?? false;
                if (!addResource(document, effect.resource, effect.amount, `opportunity:${effect.rulesKey}`, { intoxicated }) && document?.uuid) {
                    const before = deepClone(document.flags?.l5r5e?.pendingRuleEffects ?? []);
                    addMutation({ documentUuid: document.uuid, path: "flags.l5r5e.pendingRuleEffects", before, after: [...before, deepClone(effect)], reason: `opportunity:${effect.rulesKey}` });
                }
            } else if (effect.type === "priorStrifeReduction" && effect.targetUuid && effect.targetUuid !== resolution.context.actorUuid) {
                const intoxicated = this.conditions?.isActive?.(document, "intoxicated") ?? false;
                addResource(document, "strife", -Math.abs(effect.amount), `opportunity:${effect.rulesKey}`, { intoxicated });
            } else if (effect.type === "condition" && document?.uuid && effect.condition) {
                const active = this.conditions?.isActive?.(document, effect.condition) ?? document.statuses?.has?.(effect.condition) ?? false;
                const after = effect.operation === "remove" ? false : true;
                if (active !== after) addMutation({ documentUuid: document.uuid, path: `statuses.${effect.condition}`, before: active, after, reason: `opportunity:${effect.rulesKey}` });
            } else if (effect.type === "ignoreCondition" && document?.uuid && effect.condition) {
                const before = deepClone(document.flags?.l5r5e?.conditionSuspensions ?? {});
                addMutation({ documentUuid: document.uuid, path: "flags.l5r5e.conditionSuspensions", before, after: { ...before, [effect.condition]: { expiresAt: effect.expiresAt, transactionId: resolution.transactionId } }, reason: `opportunity:${effect.rulesKey}` });
            } else if (["tnModifier", "criticalModifier", "reserveDie", "ignoreTerrain", "range", "target"].includes(effect.type) && document?.uuid) {
                const before = deepClone(document.flags?.l5r5e?.pendingRuleEffects ?? []);
                addMutation({ documentUuid: document.uuid, path: "flags.l5r5e.pendingRuleEffects", before, after: [...before, { ...deepClone(effect), transactionId: resolution.transactionId }], reason: `opportunity:${effect.rulesKey}` });
            } else if (effect.type === "movement") {
                const combatant = globalThis.game?.combat?.combatants?.find?.((entry) => entry.actor?.uuid === actorDocument?.uuid);
                if (combatant) {
                    const before = deepClone(combatant.flags?.l5r5e?.turnState ?? {});
                    const after = deepClone(before);
                    after.freeMovement ??= { used: false, budget: 3, spent: 0, movementIds: [] };
                    after.freeMovement.budget = Math.max(toFiniteNumber(after.freeMovement.budget, 0), toFiniteNumber(after.freeMovement.spent, 0)) + Math.max(0, toFiniteNumber(effect.bands, 0)) * 3;
                    addMutation({ documentUuid: combatant.uuid, path: "flags.l5r5e.turnState", before, after, reason: `opportunity:${effect.rulesKey}` });
                }
            }
        }

        const consumedTnEffects = this.conditions?.matchingPendingTnEffects?.({ ...resolution.context, actor: actorDocument, targetActor: targetDocument }) ?? [];
        for (const owner of [...new Set(consumedTnEffects.map(({ owner: document }) => document))]) {
            const target = asActor(owner);
            if (!target?.uuid) continue;
            const before = deepClone(target.flags?.l5r5e?.pendingRuleEffects ?? []);
            const consumed = consumedTnEffects.filter(({ owner: document }) => document === owner).map(({ effect }) => JSON.stringify(effect));
            const existing = mutations.find((mutation) => mutation.documentUuid === target.uuid && mutation.path === "flags.l5r5e.pendingRuleEffects");
            const after = deepClone(existing?.after ?? before).filter((effect) => !consumed.includes(JSON.stringify(effect)));
            if (existing) existing.after = after;
            else if (after.length !== before.length) addMutation({ documentUuid: target.uuid, path: "flags.l5r5e.pendingRuleEffects", before, after, reason: "consumeTnModifiers" });
        }

        const damage = resolution.effects?.action?.damage;
        if (damage && targetDocument) {
            if (damage.fatigue > 0) {
                addResource(targetDocument, "fatigue", damage.fatigue, `damage:${damage.source ?? "attack"}`);
                if (damage.minion?.defeated) {
                    const mutation = mutations.find((entry) => entry.documentUuid === asActor(targetDocument)?.uuid && entry.path === "system.fatigue.value");
                    if (mutation) mutation.options = { l5r5eDefeatOutcome: damage.minion.outcome };
                }
            }
            if (damage.voidSpent > 0) addResource(targetDocument, "void", -damage.voidSpent, "declineDefense");
        }
        const itemDamage = resolution.effects?.action?.itemDamage;
        if (itemDamage?.changed && usedItem) addMutation(this.qualities?.mutation?.(usedItem, itemDamage));
        return mutations;
    }

    #snapshotContext(context) {
        const { actor, target, targetActor, item, ...dto } = context;
        const snapshot = {};
        for (const [key, value] of Object.entries(dto)) {
            if (typeof value === "function" || key === "commit") continue;
            if (value === null || ["string", "number", "boolean"].includes(typeof value) || Array.isArray(value) || (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype)) {
                try { snapshot[key] = deepClone(value); } catch (_error) { /* Document-like values are represented by UUID fields. */ }
            }
        }
        return { ...snapshot, actorUuid: documentUuid(actor) ?? context.actorUuid, targetUuid: documentUuid(target ?? targetActor) ?? context.targetUuid, itemUuid: documentUuid(item) ?? context.itemUuid };
    }

    #blocked(preview, plan, audit, reason, errors = plan.errors) {
        return {
            schemaVersion: 1,
            transactionId: preview.context.transactionId ?? makeId("resolution"),
            revision: toFiniteNumber(preview.context.revision, 1),
            status: "blocked",
            reason,
            errors,
            context: this.#snapshotContext(preview.context),
            tn: preview.tn,
            raw: { ...preview.raw, totalSuccess: preview.totalSuccess },
            effective: { success: preview.provisionalSuccess, rawBonusSuccesses: preview.rawBonusSuccesses, fireBonusSuccesses: preview.fireBonusSuccesses, bonusSuccesses: preview.bonusSuccesses },
            opportunities: { generated: preview.raw.opportunity, spent: plan.spent, remaining: plan.remaining },
            audit,
        };
    }
}
