import { clampCheckTn, getActorKind, normalizeActionTypes, toFiniteNumber } from "./rule-utils.js";

export const CONDITION_KEYS = Object.freeze([
    "afflicted", "bleeding", "burning", "compromised", "dazed", "disoriented", "dying", "enraged", "exhausted",
    "immobilized", "incapacitated", "intoxicated", "prone", "silenced", "unconscious", "dead",
]);

function statusSet(actor) {
    if (actor?.statuses instanceof Set) return actor.statuses;
    if (Array.isArray(actor?.statuses)) return new Set(actor.statuses);
    if (Array.isArray(actor?.statusKeys)) return new Set(actor.statusKeys);
    return new Set();
}

function suspensionMap(actor) {
    return actor?.flags?.l5r5e?.conditionSuspensions ?? actor?.conditionSuspensions ?? {};
}

function itemQualityKeys(item) {
    return new Set((item?.system?.properties ?? []).map((property) => String(property?.rulesKey ?? property?.system?.rulesKey ?? "").toLowerCase()).filter(Boolean));
}

export class ConditionService {
    matchingPendingTnEffects(context = {}) {
        const actionTypes = normalizeActionTypes(context.actionTypes);
        const ring = String(context.ring ?? context.stance ?? "").toLowerCase();
        const actor = context.actor;
        const target = context.targetActor ?? context.target?.actor;
        const matches = (effect, owner) => {
            if (effect.type !== "tnModifier" || effect.selector === "nextCriticalMitigation") return false;
            if (effect.selector === "chosenRing") return owner === actor && effect.ring === ring;
            if (effect.selector === "nextRangedAgainstSelf") return owner === target && actionTypes.includes("attack") && ["ranged", "range"].includes(String(context.skillId).toLowerCase());
            if (effect.selector === "nextAttack") return owner === actor && actionTypes.includes("attack");
            if (effect.selector === "nextMovement") return owner === actor && actionTypes.includes("move");
            if (effect.selector === "nextSupport") return owner === actor && actionTypes.includes("support");
            if (effect.selector === "nextCheck") return owner === actor;
            return false;
        };
        return [actor, target].filter(Boolean).flatMap((owner) => (owner.flags?.l5r5e?.pendingRuleEffects ?? []).filter((effect) => matches(effect, owner)).map((effect) => ({ owner, effect })));
    }

    isSuspended(actor, condition, lifecycle = {}) {
        const suspension = suspensionMap(actor)?.[condition];
        if (!suspension) return false;
        if (!suspension.expiresAt) return true;
        const expires = suspension.expiresAt;
        if (lifecycle.sceneEnd && expires.sceneEnd) return false;
        const currentRound = toFiniteNumber(lifecycle.round, 0);
        const currentTurn = toFiniteNumber(lifecycle.turn, 0);
        const expiresRound = toFiniteNumber(expires.round, Number.POSITIVE_INFINITY);
        const expiresTurn = toFiniteNumber(expires.turn, Number.POSITIVE_INFINITY);
        return currentRound < expiresRound || (currentRound === expiresRound && currentTurn <= expiresTurn);
    }

    isActive(actor, condition, lifecycle = {}, ignored = []) {
        return statusSet(actor).has(condition) && !ignored.includes(condition) && !this.isSuspended(actor, condition, lifecycle);
    }

    activeConditions(actor, lifecycle = {}, ignored = []) {
        return [...statusSet(actor)].filter((condition) => this.isActive(actor, condition, lifecycle, ignored));
    }

    difficultyModifiers(context = {}) {
        const actor = context.actor;
        const target = context.targetActor ?? context.target?.actor;
        const actionTypes = normalizeActionTypes(context.actionTypes ?? context.actions);
        const ring = String(context.ring ?? context.stance ?? "").toLowerCase();
        const ignored = context.ignoredConditions ?? [];
        const reasons = [];
        const add = (value, key) => reasons.push({ key, value });

        if (ring && this.isActive(actor, `lightly_wounded_${ring}`, context.lifecycle, ignored)) add(1, "lightlyWounded");
        if (ring && this.isActive(actor, `severely_wounded_${ring}`, context.lifecycle, ignored)) add(3, "severelyWounded");
        if (this.isActive(actor, "dazed", context.lifecycle, ignored) && actionTypes.some((type) => ["attack", "scheme"].includes(type))) add(2, "dazed");
        if (this.isActive(actor, "disoriented", context.lifecycle, ignored) && actionTypes.some((type) => ["move", "support"].includes(type))) add(2, "disoriented");
        if (this.isActive(actor, "prone", context.lifecycle, ignored) && actionTypes.includes("move")) add(2, "prone");
        const qualities = itemQualityKeys(context.item);
        if (qualities.has("damaged")) add(1, "damagedItem");
        if (qualities.has("cumbersome") && context.turnState?.movedThisTurn && actionTypes.includes("attack")) add(1, "cumbersomeAfterMovement");
        for (const { effect } of this.matchingPendingTnEffects(context)) add(toFiniteNumber(effect.amount, 0), `pending:${effect.rulesKey}`);

        const techniqueType = String(context.techniqueType ?? context.item?.system?.technique_type ?? "").toLowerCase();
        const silencedCheck = context.conflictType === "intrigue" || ["invocation", "maho", "shuji"].includes(techniqueType);
        if (this.isActive(actor, "silenced", context.lifecycle, ignored) && silencedCheck) add(3, "silenced");

        if (this.isActive(target, "dead", context.lifecycle, ignored)) add(0, "targetDead");
        if (String(target?.system?.stance ?? "").toLowerCase() === "air" && actionTypes.some((type) => ["attack", "scheme"].includes(type))) {
            const rank = toFiniteNumber(target?.system?.identity?.school_rank ?? target?.system?.conflict_rank?.martial ?? target?.martialRank, 0);
            add(rank > 3 ? 2 : 1, "airStance");
        }
        return { total: reasons.reduce((sum, reason) => sum + reason.value, 0), reasons };
    }

    finalTn(context = {}) {
        const base = toFiniteNumber(context.baseTn ?? context.tn, 1);
        const modifiers = this.difficultyModifiers(context);
        return { value: clampCheckTn(base + modifiers.total, { isCheck: context.isCheck !== false }), base, ...modifiers };
    }

    validateAction(context = {}) {
        const ignored = context.ignoredConditions ?? [];
        const errors = [];
        if (this.isActive(context.actor, "dead", context.lifecycle, ignored)) errors.push({ key: "dead", code: "condition.dead" });
        if (this.isActive(context.actor, "unconscious", context.lifecycle, ignored)) errors.push({ key: "unconscious", code: "condition.unconscious" });
        if (this.isActive(context.actor, "incapacitated", context.lifecycle, ignored) && context.requiresCheck !== false) {
            errors.push({ key: "incapacitated", code: "condition.incapacitatedCheck" });
        }
        if (this.isActive(context.actor, "immobilized", context.lifecycle, ignored) && normalizeActionTypes(context.actionTypes).includes("move")) {
            errors.push({ key: "immobilized", code: "condition.immobilizedMovement" });
        }
        if (itemQualityKeys(context.item).has("destroyed")) errors.push({ key: "destroyed", code: "item.destroyed" });
        return { legal: errors.length === 0, errors, provisional: errors.length > 0 };
    }

    validateKeptDice(context = {}, raw = {}) {
        const ignored = context.ignoredConditions ?? [];
        const strife = toFiniteNumber(raw.strife, 0);
        const errors = [];
        if (strife > 0 && this.isActive(context.actor, "compromised", context.lifecycle, ignored)) {
            errors.push({ key: "compromised", code: "condition.compromisedStrife", amount: strife });
        }
        return { legal: errors.length === 0, errors, provisional: errors.length > 0 };
    }

    calculateStrife({ actor, stance, rawKeptStrife = 0, checkReduction = 0, priorReduction = 0, otherGains = 0, ignoredConditions = [] } = {}) {
        const raw = Math.max(0, toFiniteNumber(rawKeptStrife, 0));
        const voidPrevented = String(stance).toLowerCase() === "void" ? raw : 0;
        const fromCheckBeforeReduction = raw - voidPrevented;
        const universalRemoved = Math.min(fromCheckBeforeReduction, Math.max(0, toFiniteNumber(checkReduction, 0)));
        const remainingFromCheck = fromCheckBeforeReduction - universalRemoved;
        const waterRemoved = Math.max(0, toFiniteNumber(priorReduction, 0));
        const intoxicated = this.isActive(actor, "intoxicated", {}, ignoredConditions);
        const multiplier = intoxicated ? 2 : 1;
        const gained = (remainingFromCheck + Math.max(0, toFiniteNumber(otherGains, 0))) * multiplier;
        const removed = (universalRemoved + waterRemoved) * multiplier;
        return { rawKept: raw, voidPrevented, universalRemoved, waterRemoved, otherGains, multiplier, gained, removed, net: gained - waterRemoved * multiplier };
    }

    thresholdState(actor, changes = {}) {
        const system = actor?.system ?? {};
        const fatigue = toFiniteNumber(changes.fatigue ?? changes["system.fatigue.value"] ?? changes?.system?.fatigue?.value ?? system?.fatigue?.value, 0);
        const strife = toFiniteNumber(changes.strife ?? changes["system.strife.value"] ?? changes?.system?.strife?.value ?? system?.strife?.value, 0);
        const endurance = toFiniteNumber(changes.endurance ?? changes["system.endurance"] ?? changes?.system?.endurance ?? system.endurance, 0);
        const composure = toFiniteNumber(changes.composure ?? changes["system.composure"] ?? changes?.system?.composure ?? system.composure, 0);
        const minion = getActorKind(actor) === "minion";
        return { fatigue, strife, endurance, composure, compromised: strife > composure, incapacitated: !minion && fatigue > endurance, defeated: minion && fatigue > endurance };
    }

    endTurnEffects(actor, turnState = {}, lifecycle = {}) {
        const effects = [];
        const actionTypes = turnState.actionTypesUsed ?? [];
        if (this.isActive(actor, "dazed", lifecycle) && !actionTypes.includes("attack") && !actionTypes.includes("scheme")) effects.push({ type: "removeCondition", condition: "dazed" });
        if (this.isActive(actor, "disoriented", lifecycle) && !actionTypes.includes("move") && !actionTypes.includes("support")) effects.push({ type: "removeCondition", condition: "disoriented" });
        if (this.isActive(actor, "immobilized", lifecycle) && !turnState.movedThisTurn) effects.push({ type: "removeCondition", condition: "immobilized" });
        if (this.isActive(actor, "dying", lifecycle)) {
            const rounds = Math.max(1, toFiniteNumber(actor?.flags?.l5r5e?.dyingRounds, 1));
            if (rounds <= 1) effects.push({ type: "removeCondition", condition: "dying" }, { type: "addCondition", condition: "dead" }, { type: "setDyingRounds", rounds: 0 });
            else effects.push({ type: "setDyingRounds", rounds: rounds - 1 });
        }
        return effects;
    }

    sceneEndRecovery(actor) {
        const exhausted = this.isActive(actor, "exhausted");
        const fatigue = toFiniteNumber(actor?.system?.fatigue?.value, 0);
        const strife = toFiniteNumber(actor?.system?.strife?.value, 0);
        if (exhausted) return { fatigue, strife };
        const fatigueMaximum = toFiniteNumber(actor?.system?.fatigue?.max ?? actor?.system?.endurance, 0);
        const strifeMaximum = toFiniteNumber(actor?.system?.strife?.max ?? actor?.system?.composure, 0);
        return { fatigue: Math.min(fatigue, Math.ceil(fatigueMaximum / 2)), strife: Math.min(strife, Math.ceil(strifeMaximum / 2)) };
    }

    afterActionEffects(actor, lifecycle = {}) {
        const effects = [];
        if (this.isActive(actor, "burning", lifecycle)) effects.push({ type: "resource", resource: "strife", amount: 3, reason: "burning" });
        return effects;
    }

    activeSuspensions(actor, lifecycle = {}) {
        return Object.fromEntries(Object.entries(suspensionMap(actor)).filter(([condition]) => this.isSuspended(actor, condition, lifecycle)));
    }

    async applyEffects(actor, effects = []) {
        for (const effect of effects) {
            switch (effect.type) {
                case "resource": {
                    const current = toFiniteNumber(actor.system?.[effect.resource]?.value, 0);
                    await actor.update({ [`system.${effect.resource}.value`]: Math.max(0, current + toFiniteNumber(effect.amount, 0)) });
                    break;
                }
                case "removeCondition":
                    await actor.toggleStatusEffect(effect.condition, { active: false });
                    break;
                case "addCondition":
                    await actor.toggleStatusEffect(effect.condition, { active: true });
                    break;
                case "replaceCondition":
                    await actor.toggleStatusEffect(effect.from, { active: false });
                    await actor.toggleStatusEffect(effect.to, { active: true });
                    break;
                case "setDyingRounds":
                    if (typeof actor.setFlag === "function") await actor.setFlag("l5r5e", "dyingRounds", Math.max(0, toFiniteNumber(effect.rounds, 0)));
                    else {
                        actor.flags ??= {};
                        actor.flags.l5r5e ??= {};
                        actor.flags.l5r5e.dyingRounds = Math.max(0, toFiniteNumber(effect.rounds, 0));
                    }
                    break;
            }
        }
        return effects;
    }

    async endTurn(actor, turnState = {}, lifecycle = {}) {
        const effects = this.endTurnEffects(actor, turnState, lifecycle);
        await this.applyEffects(actor, effects);
        const active = this.activeSuspensions(actor, lifecycle);
        if (JSON.stringify(active) !== JSON.stringify(suspensionMap(actor))) await actor.setFlag("l5r5e", "conditionSuspensions", active);
        return effects;
    }

    async recoverScene(actors = []) {
        const results = [];
        for (const actor of actors) {
            if (!actor?.isCharacterType && !["character", "npc"].includes(actor?.type)) continue;
            const recovery = this.sceneEndRecovery(actor);
            await actor.update({ "system.fatigue.value": recovery.fatigue, "system.strife.value": recovery.strife });
            const active = this.activeSuspensions(actor, { sceneEnd: true });
            if (JSON.stringify(active) !== JSON.stringify(suspensionMap(actor))) await actor.setFlag?.("l5r5e", "conditionSuspensions", active);
            results.push({ actorUuid: actor.uuid, ...recovery });
        }
        return results;
    }
}
