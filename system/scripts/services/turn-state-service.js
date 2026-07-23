import { deepClone, makeId, normalizeActionTypes, toFiniteNumber } from "./rule-utils.js";

export function createTurnKey(combatId, round, turn) {
    return `${combatId ?? "none"}:${toFiniteNumber(round, 0)}:${toFiniteNumber(turn, 0)}`;
}

export function createTurnState(turnKey) {
    return {
        turnKey,
        primaryAction: { used: false, actionId: null, actionTypes: [] },
        freeMovement: { used: false, budget: 3, spent: 0, movementIds: [], movementCosts: {} },
        waterExtraAction: { available: false, used: false, actionId: null, actionTypes: [] },
        actionTypesUsed: [],
        movedThisTurn: false,
        movementUndoAvailable: false,
        movementAnchor: null,
        movementTransactionIds: [],
        wait: null,
        guard: null,
        reservations: {},
    };
}

export function normalizeTurnState(stored, turnKey) {
    const base = createTurnState(turnKey);
    if (!stored || stored.turnKey !== turnKey) return base;
    const state = { ...base, ...deepClone(stored), turnKey };
    state.primaryAction = { ...base.primaryAction, ...(state.primaryAction ?? {}) };
    state.freeMovement = { ...base.freeMovement, ...(state.freeMovement ?? {}) };
    state.waterExtraAction = { ...base.waterExtraAction, ...(state.waterExtraAction ?? {}) };
    state.actionTypesUsed = Array.isArray(state.actionTypesUsed) ? state.actionTypesUsed : [];
    state.movementTransactionIds = Array.isArray(state.movementTransactionIds) ? state.movementTransactionIds : [];
    state.freeMovement.movementIds = Array.isArray(state.freeMovement.movementIds) ? state.freeMovement.movementIds : [];
    state.freeMovement.movementCosts = state.freeMovement.movementCosts && typeof state.freeMovement.movementCosts === "object" ? state.freeMovement.movementCosts : {};
    state.reservations = state.reservations && typeof state.reservations === "object" ? state.reservations : {};
    return state;
}

export class TurnStateService {
    getState(combatant, lifecycle = {}) {
        const combat = lifecycle.combat ?? combatant?.combat ?? globalThis.game?.combat;
        const key = createTurnKey(combat?.id ?? lifecycle.combatId, combat?.round ?? lifecycle.round, combat?.turn ?? lifecycle.turn);
        const stored = combatant?.flags?.l5r5e?.turnState;
        const state = normalizeTurnState(stored, key);
        const stance = String(combatant?.actor?.system?.stance ?? lifecycle.stance ?? "").toLowerCase();
        state.waterExtraAction.available = stance === "water";
        return state;
    }

    getters(state) {
        return {
            isActionUsed: Boolean(state.primaryAction.used),
            isFreeMovementUsed: Boolean(state.freeMovement.used),
            isWaterActionUsed: Boolean(state.waterExtraAction.used),
            movementRemaining: Math.max(0, toFiniteNumber(state.freeMovement.budget, 0) - toFiniteNumber(state.freeMovement.spent, 0)),
            movementUndoAvailable: Boolean(state.movementUndoAvailable),
        };
    }

    reserveAction(state, { actionId = null, actionTypes = [], requiresCheck = true, preferWater = false, gmOverride = false, intentId = null, ownerId = null } = {}) {
        const next = deepClone(state);
        const stableActionId = typeof actionId === "string" && actionId.trim() ? actionId.trim() : makeId("action");
        const stableIntentId = typeof intentId === "string" && intentId.trim() ? intentId.trim() : stableActionId;
        const existing = Object.values(next.reservations).find((reservation) => reservation.intentId === stableIntentId);
        if (existing) return { ok: true, idempotent: true, reservationId: existing.reservationId, slot: existing.slot, state: next };
        const types = normalizeActionTypes(actionTypes);
        const usedTypes = new Set(next.actionTypesUsed);
        const canWater = next.waterExtraAction.available && !next.waterExtraAction.used && !requiresCheck && !types.some((type) => usedTypes.has(type));
        let slot = null;
        if (preferWater && canWater) slot = "waterExtraAction";
        else if (!next.primaryAction.used && !Object.values(next.reservations).some((reservation) => reservation.slot === "primaryAction")) slot = "primaryAction";
        else if (canWater) slot = "waterExtraAction";
        if (!slot && !gmOverride) return { ok: false, code: "noActionSlot", state };
        slot ??= "primaryAction";
        const reservationId = makeId("reservation");
        next.reservations[reservationId] = {
            reservationId,
            slot,
            actionId: stableActionId,
            actionTypes: types,
            requiresCheck,
            gmOverride,
            intentId: stableIntentId,
            ownerId,
            createdAt: Date.now(),
        };
        return { ok: true, reservationId, slot, state: next };
    }

    cancelReservation(state, reservationId) {
        const next = deepClone(state);
        delete next.reservations[reservationId];
        return next;
    }

    consumeReservation(state, reservationId) {
        const next = deepClone(state);
        if (!next.reservations[reservationId]) return { ok: true, idempotent: true, state: next };
        delete next.reservations[reservationId];
        return { ok: true, state: next };
    }

    commitReservation(state, reservationId) {
        const next = deepClone(state);
        const reservation = next.reservations[reservationId];
        if (!reservation) return { ok: false, code: "reservationMissing", state };
        const slot = next[reservation.slot];
        if (slot.used && !reservation.gmOverride) return { ok: false, code: "slotAlreadyUsed", state };
        if (reservation.slot === "waterExtraAction") {
            const conflicts = reservation.actionTypes.filter((type) => next.actionTypesUsed.includes(type));
            if (conflicts.length && !reservation.gmOverride) return { ok: false, code: "waterActionTypeConflict", conflicts, state };
        }
        slot.used = true;
        slot.actionId = reservation.actionId;
        slot.actionTypes = reservation.actionTypes;
        next.actionTypesUsed = [...new Set([...next.actionTypesUsed, ...reservation.actionTypes])];
        delete next.reservations[reservationId];
        if (next.movedThisTurn) {
            next.movementUndoAvailable = false;
            next.movementAnchor = null;
            next.freeMovement.movementIds = [];
            next.freeMovement.movementCosts = {};
        }
        return { ok: true, state: next, reservation };
    }

    beginMovement(state, { budget = 3, kind = "free", anchor = null, transactionId = makeId("movement") } = {}) {
        const next = deepClone(state);
        if (kind === "free" && next.freeMovement.used) return { ok: false, code: "freeMovementUsed", state };
        if (!next.movementUndoAvailable) {
            next.movementAnchor = anchor;
            next.freeMovement.movementIds = [];
            next.freeMovement.movementCosts = {};
        }
        if (kind === "free") next.freeMovement.budget = Math.max(toFiniteNumber(next.freeMovement.budget, 0), toFiniteNumber(budget, 0));
        else next.freeMovement.budget = toFiniteNumber(next.freeMovement.budget, 0) + Math.max(0, toFiniteNumber(budget, 0));
        next.movementUndoAvailable = true;
        next.movementTransactionIds.push(transactionId);
        return { ok: true, transactionId, state: next };
    }

    spendMovement(state, { cost, movementId, kind = "free" } = {}) {
        const next = deepClone(state);
        const amount = Math.max(0, toFiniteNumber(cost, 0));
        const remaining = Math.max(0, toFiniteNumber(next.freeMovement.budget, 0) - toFiniteNumber(next.freeMovement.spent, 0));
        if (amount > remaining) return { ok: false, code: "movementBudgetExceeded", remaining, state };
        next.freeMovement.spent += amount;
        next.freeMovement.used ||= kind === "free";
        next.freeMovement.movementCosts ??= {};
        if (movementId) {
            next.freeMovement.movementIds.push(movementId);
            next.freeMovement.movementCosts[movementId] = amount;
        }
        next.movedThisTurn ||= amount > 0;
        return { ok: true, remaining: remaining - amount, state: next };
    }

    completeTurn(state) {
        const next = deepClone(state);
        next.movementUndoAvailable = false;
        next.movementAnchor = null;
        next.reservations = {};
        return next;
    }

    async persist(combatant, state, diff = {}) {
        if (typeof combatant?.setFlag === "function") await combatant.setFlag("l5r5e", "turnState", state);
        else {
            combatant.flags ??= {};
            combatant.flags.l5r5e ??= {};
            combatant.flags.l5r5e.turnState = deepClone(state);
        }
        globalThis.Hooks?.callAll?.("l5r5e.turnStateChanged", combatant, state, diff);
        return state;
    }
}
