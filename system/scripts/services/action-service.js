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
        const actionId = typeof context.actionId === "string" && context.actionId.trim() ? context.actionId.trim() : undefined;
        return { ...context, actionId, actionTypes, actions: actionState(actionTypes), requiresCheck: context.requiresCheck !== false };
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
        const stablePaths = [
            "primaryAction",
            "waterExtraAction",
            "actionTypesUsed",
            "movedThisTurn",
            "movementUndoAvailable",
            "movementAnchor",
            "freeMovement.movementIds",
            "freeMovement.movementCosts",
        ];
        const get = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
        const mutations = stablePaths
            .filter((path) => JSON.stringify(get(before, path)) !== JSON.stringify(get(result.state, path)))
            .map((path) => ({
                documentUuid: combatant.uuid,
                path: `flags.l5r5e.turnState.${path}`,
                before: get(before, path),
                after: get(result.state, path),
                reason: "actionCommit",
            }));
        for (const effect of conditionEffects) {
            if (effect.type !== "resource" || !combatant.actor?.uuid) continue;
            const current = Number(combatant.actor.system?.[effect.resource]?.value) || 0;
            mutations.push({ documentUuid: combatant.actor.uuid, path: `system.${effect.resource}.value`, before: current, after: Math.max(0, current + Number(effect.amount || 0)), reason: effect.reason ?? "afterAction" });
        }
        return { ...result, before, mutations, conditionEffects };
    }

    async finalizeCommit(combatant, prepared, resolution = {}) {
        const reservationId = prepared.reservation?.reservationId;
        if (reservationId) {
            const current = this.turns.getState(combatant, resolution.context?.lifecycle);
            const consumed = this.turns.consumeReservation(current, reservationId);
            if (!consumed.idempotent) await this.turns.persist(combatant, consumed.state, { reservationId, consumed: true });
        }
        resolution.conditionEffects = [...(resolution.conditionEffects ?? []), ...(prepared.conditionEffects ?? [])];
        globalThis.Hooks?.callAll?.("l5r5e.turnStateChanged", combatant, prepared.state, { reservationId: prepared.reservation?.reservationId, actionId: prepared.reservation?.actionId, committed: true });
        globalThis.Hooks?.callAll?.("l5r5e.actionResolved", resolution);
        return { ...prepared, reservationConsumed: Boolean(reservationId) };
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

    async executeImmediate(combatant, { context = {}, mutations = [], turnStateChanges = {} } = {}) {
        if (!this.rolls?.transactions) return { ok: false, code: "transactionServiceMissing" };
        const reservation = await this.reserveAndPersist(combatant, { ...context, requiresCheck: false });
        if (!reservation.ok) return reservation;
        const prepared = this.prepareCommit(combatant, reservation.reservationId, { context });
        if (!prepared.ok) {
            await this.cancel(combatant, reservation.reservationId, context.lifecycle);
            return prepared;
        }
        for (const [path, after] of Object.entries(turnStateChanges)) {
            const before = path.split(".").reduce((value, key) => value?.[key], this.turns.getState(combatant, context.lifecycle));
            prepared.mutations.push({
                documentUuid: combatant.uuid,
                path: `flags.l5r5e.turnState.${path}`,
                before,
                after,
                reason: context.actionId ?? "immediateAction",
            });
        }
        const transaction = this.rolls.transactions.create({
            inputs: { context },
            mutations: [...prepared.mutations, ...mutations],
        });
        const applied = await this.rolls.transactions.apply(transaction);
        if (!applied.ok) {
            await this.cancel(combatant, reservation.reservationId, context.lifecycle);
            return applied;
        }
        await this.finalizeCommit(combatant, prepared, { context, transaction });
        return { ok: true, transaction, state: prepared.state, reservationId: reservation.reservationId };
    }
}
