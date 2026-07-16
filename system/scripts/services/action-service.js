import { actionState, inferActionTypes, normalizeActionTypes } from "./rule-utils.js";

export class ActionService {
    constructor({ turnStateService, conditionService, rollResolutionService = null } = {}) {
        this.turns = turnStateService;
        this.conditions = conditionService;
        this.rolls = rollResolutionService;
    }

    inferActionTypes(source = {}, explicit = undefined) {
        return explicit === undefined ? inferActionTypes(source) : normalizeActionTypes(explicit);
    }

    actionState(source = {}, explicit = undefined) {
        return actionState(this.inferActionTypes(source, explicit));
    }

    normalizeContext(context = {}) {
        const actionTypes = this.inferActionTypes(context.item ?? context.technique ?? context, context.actionTypes);
        return { ...context, actionTypes, actions: actionState(actionTypes), requiresCheck: context.requiresCheck !== false };
    }

    assess(context = {}) {
        const normalized = this.normalizeContext(context);
        return { context: normalized, tn: this.conditions.finalTn(normalized), legality: this.conditions.validateAction(normalized) };
    }

    reserve(combatant, context = {}) {
        const normalized = this.normalizeContext(context);
        const state = this.turns.getState(combatant, context.lifecycle);
        return this.turns.reserveAction(state, normalized);
    }

    async reserveAndPersist(combatant, context = {}) {
        const result = this.reserve(combatant, context);
        if (result.ok) await this.turns.persist(combatant, result.state, { reservationId: result.reservationId, reserved: true });
        return result;
    }

    prepareCommit(combatant, reservationId, resolution = {}) {
        const before = this.turns.getState(combatant, resolution.context?.lifecycle);
        const result = this.turns.commitReservation(before, reservationId);
        if (!result.ok) return result;
        const conditionEffects = this.conditions.afterActionEffects(combatant.actor, resolution.context?.lifecycle);
        const mutations = [{ documentUuid: combatant.uuid, path: "flags.l5r5e.turnState", before, after: result.state, reason: "actionCommit" }];
        for (const effect of conditionEffects) {
            if (effect.type !== "resource" || !combatant.actor?.uuid) continue;
            const current = Number(combatant.actor.system?.[effect.resource]?.value) || 0;
            mutations.push({ documentUuid: combatant.actor.uuid, path: `system.${effect.resource}.value`, before: current, after: Math.max(0, current + Number(effect.amount || 0)), reason: effect.reason ?? "afterAction" });
        }
        return { ...result, before, mutations, conditionEffects };
    }

    finalizeCommit(combatant, prepared, resolution = {}) {
        resolution.conditionEffects = [...(resolution.conditionEffects ?? []), ...(prepared.conditionEffects ?? [])];
        globalThis.Hooks?.callAll?.("l5r5e.turnStateChanged", combatant, prepared.state, { reservationId: prepared.reservation?.reservationId, actionId: prepared.reservation?.actionId, committed: true });
        globalThis.Hooks?.callAll?.("l5r5e.actionResolved", resolution);
        return prepared;
    }

    async commit(combatant, reservationId, resolution = {}) {
        const state = this.turns.getState(combatant, resolution.context?.lifecycle);
        const result = this.turns.commitReservation(state, reservationId);
        if (!result.ok) return result;
        await this.turns.persist(combatant, result.state, { reservationId, actionId: result.reservation.actionId });
        const conditionEffects = this.conditions.afterActionEffects(combatant.actor, resolution.context?.lifecycle);
        for (const effect of conditionEffects) {
            if (effect.type === "resource" && effect.resource === "strife") {
                const current = Number(combatant.actor.system.strife.value) || 0;
                await combatant.actor.update({ "system.strife.value": Math.max(0, current + effect.amount) });
            }
        }
        resolution.conditionEffects = [...(resolution.conditionEffects ?? []), ...conditionEffects];
        globalThis.Hooks?.callAll?.("l5r5e.actionResolved", resolution);
        return result;
    }

    async cancel(combatant, reservationId, lifecycle = {}) {
        const state = this.turns.cancelReservation(this.turns.getState(combatant, lifecycle), reservationId);
        await this.turns.persist(combatant, state, { reservationId, cancelled: true });
        return state;
    }
}
