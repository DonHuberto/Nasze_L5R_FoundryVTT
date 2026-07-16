import { normalizeActionTypes, toFiniteNumber, uniqueStrings } from "./rule-utils.js";

const RINGS = ["any", "air", "earth", "fire", "water", "void"];
const TIMINGS = ["preValidation", "strife", "beforeSuccess", "afterSuccess", "beforeDamage", "afterDamage", "deferred", "manual"];
const AUTOMATION = ["automatic", "confirm", "manual"];

function matchesList(filter, actual) {
    const expected = uniqueStrings(filter);
    if (!expected.length) return true;
    const received = new Set(uniqueStrings(actual));
    return expected.some((value) => received.has(value));
}

export function validateOpportunityDefinition(definition = {}) {
    const errors = [];
    if (!String(definition.rulesKey ?? "").trim()) errors.push("rulesKey");
    if (!RINGS.includes(definition.ring)) errors.push("ring");
    if (!TIMINGS.includes(definition.timing)) errors.push("timing");
    if (!AUTOMATION.includes(definition.automation)) errors.push("automation");
    if (toFiniteNumber(definition?.cost?.base, 0) < 1) errors.push("cost.base");
    if (!String(definition?.effect?.type ?? "").trim()) errors.push("effect.type");
    return { valid: errors.length === 0, errors };
}

export class OpportunityService {
    constructor({ repository, conditionService } = {}) {
        this.repository = repository;
        this.conditionService = conditionService;
        this.executors = new Map();
        this.#registerCoreExecutors();
    }

    registerExecutor(type, executor) {
        if (!type || typeof executor !== "function") throw new TypeError("Opportunity executor requires a type and function");
        this.executors.set(type, executor);
    }

    async available(context = {}, definitions = null) {
        const source = definitions ?? (await this.repository?.all?.()) ?? [];
        return source.filter((definition) => this.matches(definition, context));
    }

    matches(definition, context = {}) {
        if (!validateOpportunityDefinition(definition).valid) return false;
        const ring = String(context.ring ?? context.stance ?? "").toLowerCase();
        if (definition.ring !== "any" && definition.ring !== ring) return false;
        const direct = (context.directOpportunityKeys ?? []).includes(definition.rulesKey);
        const filters = definition.contexts ?? {};
        if (!direct && !matchesList(filters.conflictTypes, context.conflictType)) return false;
        if (!direct && !matchesList(filters.checkKinds, context.checkKind)) return false;
        if (!direct && !matchesList(filters.actionTypes, normalizeActionTypes(context.actionTypes))) return false;
        if (!direct && !matchesList(filters.skillGroups, context.skillGroup ?? context.skillCatId)) return false;
        if (!direct && !matchesList(filters.skillIds, context.skillId)) return false;
        if (!direct && !matchesList(filters.techniqueTypes, context.techniqueType ?? context.item?.system?.technique_type)) return false;
        if (!direct && !matchesList(filters.itemTypes, context.item?.type ?? context.itemType)) return false;
        if (!direct && filters.initiative !== null && filters.initiative !== undefined && Boolean(filters.initiative) !== Boolean(context.initiative)) return false;
        const requirements = definition.requirements ?? {};
        if (requirements.success === true && context.provisionalSuccess !== true) return false;
        if (requirements.success === false && context.provisionalSuccess !== false) return false;
        if (requirements.directItemUuid && requirements.directItemUuid !== context.item?.uuid) return false;
        if (requirements.directOpportunityKeys?.length && !requirements.directOpportunityKeys.includes(definition.rulesKey)) return false;

        const targetStance = String(context.targetActor?.system?.stance ?? context.target?.actor?.system?.stance ?? "").toLowerCase();
        const actionTypes = normalizeActionTypes(context.actionTypes);
        const blockedByEarth = targetStance === "earth" && actionTypes.some((type) => ["attack", "scheme"].includes(type));
        if (blockedByEarth && ["critical", "condition"].includes(definition.effect?.type)) return false;
        return true;
    }

    costFor(definition, spend = null) {
        const base = Math.max(1, Math.trunc(toFiniteNumber(definition?.cost?.base, 1)));
        if (!definition?.cost?.scalable) return base;
        const increment = Math.max(1, Math.trunc(toFiniteNumber(definition?.cost?.increment, 1)));
        const requested = Math.max(base, Math.trunc(toFiniteNumber(spend, base)));
        const capped = definition.cost.maxSpend === null || definition.cost.maxSpend === undefined
            ? requested
            : Math.min(requested, Math.max(base, Math.trunc(toFiniteNumber(definition.cost.maxSpend, base))));
        return base + Math.floor((capped - base) / increment) * increment;
    }

    validatePlan(definitions, plan = [], budget = 0, decisions = {}) {
        const byKey = new Map(definitions.map((definition) => [definition.rulesKey, definition]));
        const seen = new Set();
        const selections = [];
        const errors = [];
        let spent = 0;
        for (const selection of plan) {
            const definition = byKey.get(selection.rulesKey);
            if (!definition) {
                errors.push({ code: "unknown", rulesKey: selection.rulesKey });
                continue;
            }
            if (seen.has(selection.rulesKey)) {
                errors.push({ code: "duplicate", rulesKey: selection.rulesKey });
                continue;
            }
            seen.add(selection.rulesKey);
            const cost = this.costFor(definition, selection.spend);
            const decision = decisions[selection.rulesKey] ?? selection.decision ?? {};
            const targetMode = definition.target?.mode ?? "none";
            if (["single", "multiple", "gm"].includes(targetMode) && !decision.targetUuid && !decision.targetUuids?.length) {
                errors.push({ code: "targetRequired", rulesKey: selection.rulesKey });
            }
            if (definition.requirements?.conditionChoice && !decision.condition) errors.push({ code: "conditionRequired", rulesKey: selection.rulesKey });
            if (definition.requirements?.ringChoice && !decision.ring) errors.push({ code: "ringRequired", rulesKey: selection.rulesKey });
            spent += cost;
            selections.push({ definition, rulesKey: definition.rulesKey, cost, decision });
        }
        if (spent > budget) errors.push({ code: "overspend", spent, budget });
        return { valid: errors.length === 0, spent, remaining: Math.max(0, budget - spent), selections, errors };
    }

    executeTiming(timing, validatedPlan, context = {}) {
        const effects = [];
        for (const selection of validatedPlan.selections.filter(({ definition }) => definition.timing === timing)) {
            const executor = this.executors.get(selection.definition.effect.type);
            if (!executor) {
                effects.push({ type: "manual", status: "manual", rulesKey: selection.rulesKey, cost: selection.cost, decision: selection.decision });
                continue;
            }
            effects.push(executor(selection, context));
        }
        return effects.flat().filter(Boolean);
    }

    #registerCoreExecutors() {
        const amount = (selection, fallback = 1) => {
            const configured = toFiniteNumber(selection.definition.effect?.params?.amount, fallback);
            return selection.definition.cost?.scalable ? configured * selection.cost : configured;
        };
        this.registerExecutor("manual", (selection) => ({ type: "manual", status: "manual", rulesKey: selection.rulesKey, cost: selection.cost, decision: selection.decision }));
        this.registerExecutor("resource", (selection) => ({
            type: "resource", resource: selection.definition.effect.params.resource, amount: amount(selection), targetUuid: selection.decision.targetUuid, rulesKey: selection.rulesKey,
        }));
        this.registerExecutor("remove-check-strife", (selection) => ({ type: "checkStrifeReduction", amount: selection.cost, rulesKey: selection.rulesKey }));
        this.registerExecutor("remove-strife", (selection) => ({ type: "priorStrifeReduction", amount: amount(selection, 2), targetUuid: selection.decision.targetUuid, rulesKey: selection.rulesKey }));
        this.registerExecutor("condition", (selection) => ({ type: "condition", operation: selection.definition.effect.params.operation ?? "add", condition: selection.decision.condition ?? selection.definition.effect.params.condition, targetUuid: selection.decision.targetUuid, rulesKey: selection.rulesKey }));
        this.registerExecutor("ignore-condition", (selection, context) => ({
            type: "ignoreCondition", condition: selection.decision.condition, targetUuid: context.actor?.uuid, expiresAt: context.conditionSuspensionExpiry, rulesKey: selection.rulesKey,
        }));
        this.registerExecutor("tn-modifier", (selection) => ({ type: "tnModifier", amount: amount(selection), selector: selection.definition.effect.params.selector, ring: selection.decision.ring, targetUuid: selection.decision.targetUuid, duration: selection.definition.duration, rulesKey: selection.rulesKey }));
        this.registerExecutor("resistance-modifier", (selection) => ({ type: "resistanceModifier", amount: amount(selection), damageType: selection.definition.effect.params.damageType, rulesKey: selection.rulesKey }));
        this.registerExecutor("critical-modifier", (selection) => ({ type: "criticalModifier", amount: amount(selection), targetUuid: selection.decision.targetUuid, duration: selection.definition.duration, rulesKey: selection.rulesKey }));
        this.registerExecutor("movement", (selection) => ({ type: "movement", bands: amount(selection), rulesKey: selection.rulesKey }));
        this.registerExecutor("range", (selection) => ({ type: "range", bands: amount(selection), rulesKey: selection.rulesKey }));
        this.registerExecutor("ignore-terrain", (selection) => ({ type: "ignoreTerrain", quality: selection.decision.terrainQuality, rulesKey: selection.rulesKey }));
        this.registerExecutor("target", (selection) => ({ type: "target", operation: selection.definition.effect.params.operation ?? "add", targetUuid: selection.decision.targetUuid, rulesKey: selection.rulesKey }));
        this.registerExecutor("reserve-die", (selection) => ({ type: "reserveDie", die: selection.decision.die, rulesKey: selection.rulesKey }));
        this.registerExecutor("critical", (selection) => ({ type: "critical", severity: amount(selection), targetUuid: selection.decision.targetUuid, rulesKey: selection.rulesKey }));
    }
}
