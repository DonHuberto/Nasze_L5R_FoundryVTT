import { makeId, toFiniteNumber } from "./rule-utils.js";

export function movementStepCost(from, to, { difficult = false, enemyExit = false } = {}) {
    const dx = Math.abs(toFiniteNumber(to.x, 0) - toFiniteNumber(from.x, 0));
    const dy = Math.abs(toFiniteNumber(to.y, 0) - toFiniteNumber(from.y, 0));
    if (dx === 0 && dy === 0) return 0;
    const diagonal = dx > 0 && dy > 0;
    return Math.min(3, (diagonal ? 2 : 1) + (difficult ? 1 : 0) + (enemyExit ? 1 : 0));
}

export function measureGridPath(waypoints = [], { difficultSquares = new Set(), blockedSquares = new Set(), hostileSquares = new Set(), gmOverride = false } = {}) {
    let cost = 0;
    const steps = [];
    for (let index = 1; index < waypoints.length; index += 1) {
        const from = waypoints[index - 1];
        const to = waypoints[index];
        const targetKey = `${to.x},${to.y}`;
        if (blockedSquares.has(targetKey) && !gmOverride) return { valid: false, code: "blocked", cost, steps, blockedAt: to };
        const difficult = difficultSquares.has(`${from.x},${from.y}`);
        const enemyExit = hostileSquares.has(`${from.x},${from.y}`);
        const stepCost = movementStepCost(from, to, { difficult, enemyExit });
        cost += stepCost;
        steps.push({ from, to, difficult, enemyExit, cost: stepCost, cumulative: cost });
    }
    return { valid: true, cost, steps };
}

export class MovementService {
    constructor({ turnStateService, conditionService, actionService = null } = {}) {
        this.turns = turnStateService;
        this.conditions = conditionService;
        this.actions = actionService;
        this.pendingCosts = new Map();
    }

    maneuverBudget({ success = false, bonusSuccesses = 0, checked = false } = {}) {
        if (!checked || !success) return 3;
        return 3 * (2 + Math.floor(Math.max(0, toFiniteNumber(bonusSuccesses, 0)) / 2));
    }

    remaining(combatant, lifecycle = {}) {
        const state = this.turns.getState(combatant, lifecycle);
        return this.turns.getters(state).movementRemaining;
    }

    techniqueBudget(baseBudget, technique) {
        const movement = technique?.system?.activation?.movement ?? technique?.activation?.movement ?? {};
        const amount = Math.max(0, toFiniteNumber(movement.bands, 0)) * 3;
        const multiplier = Math.max(0, toFiniteNumber(movement.multiplier, 1));
        if (movement.mode === "replace") return amount;
        if (movement.mode === "multiply") return Math.max(0, toFiniteNumber(baseBudget, 0)) * multiplier;
        return Math.max(0, toFiniteNumber(baseBudget, 0)) + amount;
    }

    async startFreeMovement(combatant, token, options = {}) {
        const budget = Math.min(3, this.remaining(combatant, options.lifecycle));
        if (budget <= 0) return { ok: false, code: "freeMovementUsed" };
        return { ok: true, budget, ...(await this.plan(token, { ...options, maxCost: budget })) };
    }

    async startManeuver(combatant, token, { checked = false, success = false, bonusSuccesses = 0, preferWater = false, lifecycle = {}, ...options } = {}) {
        const budget = this.maneuverBudget({ checked, success, bonusSuccesses });
        const reservation = this.actions
            ? await this.actions.reserveAndPersist(combatant, { actionTypes: ["move"], requiresCheck: checked, preferWater, lifecycle })
            : this.turns.reserveAction(this.turns.getState(combatant, lifecycle), { actionTypes: ["move"], requiresCheck: checked, preferWater });
        if (!reservation.ok) return reservation;
        const planned = await this.plan(token, { ...options, maxCost: budget });
        return { ok: true, budget, reservationId: reservation.reservationId, lifecycle, ...planned };
    }

    async cancelManeuver(combatant, reservationId, lifecycle = {}) {
        if (this.actions) return this.actions.cancel(combatant, reservationId, lifecycle);
        const state = this.turns.cancelReservation(this.turns.getState(combatant, lifecycle), reservationId);
        await this.turns.persist(combatant, state, { reservationId, cancelled: true });
        return state;
    }

    async executeManeuver(combatant, token, started, options = {}) {
        if (!started?.reservationId) return { ok: false, code: "reservationMissing" };
        const committed = this.actions
            ? await this.actions.commit(combatant, started.reservationId, { context: { lifecycle: started.lifecycle }, type: "maneuver" })
            : this.turns.commitReservation(this.turns.getState(combatant, started.lifecycle), started.reservationId);
        if (!committed.ok) return committed;
        return this.execute(combatant, token, started.plan, { ...options, budget: started.budget, kind: "maneuver", lifecycle: started.lifecycle });
    }

    async startTechniqueMovement(combatant, token, technique, { baseBudget = 0, lifecycle = {}, ...options } = {}) {
        const budget = this.techniqueBudget(baseBudget, technique);
        return { ok: true, budget, lifecycle, ...(await this.plan(token, { ...options, maxCost: budget })) };
    }

    async plan(token, { maxCost, allowedActions = ["walk"], direct = false, gmOverride = false, ...options } = {}) {
        if (!token?.document?.parent?.grid?.type && !globalThis.canvas?.scene?.grid?.type) return { gridless: true, plan: null };
        if (typeof token?.planMovement !== "function") throw new Error("Foundry VTT 14 Token.planMovement is unavailable");
        const plan = await token.planMovement({
            allowedActions,
            direct,
            maxCost: Math.max(0, toFiniteNumber(maxCost, 0)),
            preventDrop: !gmOverride,
            ...options,
        });
        return { gridless: false, plan };
    }

    measure(token, waypoints, options = {}) {
        if (typeof token?.measureMovementPath === "function") return token.measureMovementPath(waypoints, options);
        return measureGridPath(waypoints, options);
    }

    async execute(combatant, token, plan, { budget, kind = "free", lifecycle = {}, gmOverride = false } = {}) {
        if (!plan) return { ok: false, code: "movementPlanMissing" };
        const state = this.turns.getState(combatant, lifecycle);
        const transactionId = makeId("movement");
        const begun = this.turns.beginMovement(state, { budget, kind, anchor: plan.origin, transactionId });
        if (!begun.ok) return begun;
        const measured = this.measure(token, plan.waypoints);
        const cost = toFiniteNumber(measured.cost ?? measured.distance, 0);
        if (cost > this.turns.getters(begun.state).movementRemaining && !gmOverride) return { ok: false, code: "movementBudgetExceeded", cost };
        const moved = await token.document.move(plan.waypoints, { id: plan.id, planned: true, method: "api", showRuler: true });
        if (!moved) return { ok: false, code: "movementFailed" };
        const spent = this.turns.spendMovement(begun.state, { cost, movementId: plan.id, kind });
        await this.turns.persist(combatant, spent.state, { movementId: plan.id, cost });
        globalThis.Hooks?.callAll?.("l5r5e.movementBudgetChanged", combatant, spent.state.freeMovement);
        return { ok: true, cost, movementId: plan.id, transactionId, state: spent.state };
    }

    async undoMovement(combatant, tokenDocument, lifecycle = {}) {
        const state = this.turns.getState(combatant, lifecycle);
        if (!state.movementUndoAvailable) return { ok: false, code: "movementUndoUnavailable" };
        const ids = [...state.freeMovement.movementIds];
        for (const id of ids.reverse()) {
            const reverted = await tokenDocument.revertRecordedMovement(id);
            if (!reverted) {
                globalThis.ui?.notifications?.warn?.(globalThis.game?.i18n?.localize?.("l5r5e.automation.movement.undoConflict") ?? "Movement history changed and cannot be undone automatically.");
                return { ok: false, code: "movementUndoConflict", movementId: id };
            }
        }
        let refund = ids.reduce((sum, id) => sum + toFiniteNumber(state.freeMovement.movementCosts?.[id], 0), 0);
        if (!refund && ids.length) refund = toFiniteNumber(state.freeMovement.spent, 0);
        state.freeMovement.spent = Math.max(0, toFiniteNumber(state.freeMovement.spent, 0) - refund);
        state.freeMovement.movementIds = [];
        state.freeMovement.movementCosts = {};
        state.movedThisTurn = false;
        state.movementUndoAvailable = false;
        state.movementAnchor = null;
        await this.turns.persist(combatant, state, { movementUndone: ids });
        globalThis.Hooks?.callAll?.("l5r5e.movementBudgetChanged", combatant, state.freeMovement);
        return { ok: true, state, refunded: refund };
    }

    reachableFields({ origin, candidates, budget, difficultSquares, blockedSquares, gmOverride = false } = {}) {
        return (candidates ?? []).map((destination) => ({ destination, ...measureGridPath([origin, destination], { difficultSquares, blockedSquares, gmOverride }) }))
            .filter((result) => result.valid && result.cost <= budget);
    }

    hostileOccupiedOffsets(tokenDocument) {
        const scene = tokenDocument?.parent;
        const neutral = globalThis.CONST?.TOKEN_DISPOSITIONS?.NEUTRAL ?? 0;
        const disposition = toFiniteNumber(tokenDocument?.disposition, neutral);
        const hostile = new Set();
        for (const other of scene?.tokens ?? []) {
            if (other.id === tokenDocument.id || other.hidden) continue;
            const otherDisposition = toFiniteNumber(other.disposition, neutral);
            const isEnemy = disposition === neutral ? otherDisposition !== neutral : otherDisposition !== neutral && Math.sign(otherDisposition) !== Math.sign(disposition);
            if (!isEnemy) continue;
            for (const offset of other.getOccupiedGridSpaceOffsets?.() ?? []) hostile.add(`${offset.i},${offset.j}`);
        }
        return hostile;
    }

    validateTokenSpaces(tokenDocument, waypoints = [], { gmOverride = false, tokensBlockSpaces = false } = {}) {
        if (gmOverride || !tokensBlockSpaces || waypoints.length < 2) return { ok: true };
        const grid = tokenDocument?.parent?.grid;
        if (!grid?.getDirectPath) return { ok: true };
        const blocked = this.hostileOccupiedOffsets(tokenDocument);
        if (!blocked.size) return { ok: true };
        const path = grid.getDirectPath(waypoints);
        for (const offset of path.slice(1)) {
            const point = grid.getTopLeftPoint?.(offset) ?? offset;
            const occupied = tokenDocument.getOccupiedGridSpaceOffsets?.({ x: point.x, y: point.y }) ?? [offset];
            const collision = occupied.find((entry) => blocked.has(`${entry.i},${entry.j}`));
            if (collision) return { ok: false, code: "tokenOccupied", blockedAt: collision };
        }
        return { ok: true };
    }

    enemyExitSurcharge(tokenDocument, waypoints = []) {
        const grid = tokenDocument?.parent?.grid;
        if (!grid?.getDirectPath || waypoints.length < 2) return 0;
        const hostile = this.hostileOccupiedOffsets(tokenDocument);
        if (!hostile.size) return 0;
        const path = grid.getDirectPath(waypoints);
        let surcharge = 0;
        for (const offset of path.slice(0, -1)) {
            const point = grid.getTopLeftPoint?.(offset) ?? offset;
            const occupied = tokenDocument.getOccupiedGridSpaceOffsets?.({ x: point.x, y: point.y }) ?? [offset];
            if (occupied.some((entry) => hostile.has(`${entry.i},${entry.j}`))) surcharge += 1;
        }
        return surcharge;
    }

    validateHookMovement(tokenDocument, movement, combatant, { gmOverride = false } = {}) {
        const scene = tokenDocument?.parent;
        if (!scene?.grid?.type) return { ok: true, gridless: true, cost: 0 };
        if (this.conditions.isActive(combatant?.actor, "immobilized")) return { ok: false, code: "immobilized" };
        const waypoints = movement?.pending?.waypoints ?? movement?.waypoints ?? movement?.path ?? [];
        const tokensBlockSpaces = Boolean(globalThis.game?.settings?.get?.("l5r5e", "tokensBlockSpaces"));
        const blocker = this.validateTokenSpaces(tokenDocument, waypoints, { gmOverride, tokensBlockSpaces });
        if (!blocker.ok) return blocker;
        const measured = tokenDocument.measureMovementPath(waypoints);
        const cost = toFiniteNumber(measured.cost ?? measured.distance, 0) + this.enemyExitSurcharge(tokenDocument, waypoints);
        const remaining = this.remaining(combatant);
        if (cost > remaining && !gmOverride) return { ok: false, code: "movementBudgetExceeded", cost, remaining };
        const id = movement?.id ?? movement?.movementId;
        if (id) this.pendingCosts.set(id, cost);
        return { ok: true, cost, remaining };
    }

    async recordHookMovement(tokenDocument, movement, combatant) {
        const id = movement?.id ?? movement?.movementId;
        if (!id) return { ok: false, code: "movementIdMissing" };
        const state = this.turns.getState(combatant);
        if (state.freeMovement.movementIds.includes(id)) return { ok: true, idempotent: true, state };
        const cost = this.pendingCosts.get(id) ?? 0;
        this.pendingCosts.delete(id);
        const begun = this.turns.beginMovement(state, { budget: state.freeMovement.budget, kind: "free", anchor: movement?.origin ?? tokenDocument.getMovementOrigin?.(), transactionId: id });
        if (!begun.ok) return begun;
        const spent = this.turns.spendMovement(begun.state, { cost, movementId: id, kind: "free" });
        if (!spent.ok) return spent;
        await this.turns.persist(combatant, spent.state, { movementId: id, cost });
        globalThis.Hooks?.callAll?.("l5r5e.movementBudgetChanged", combatant, spent.state.freeMovement);
        return { ok: true, state: spent.state, cost };
    }
}

export const RangeBandService = Object.freeze({
    fieldsPerBand: 3,
    toBudget: (bands) => Math.max(0, toFiniteNumber(bands, 0)) * 3,
    fromCost: (cost) => Math.ceil(Math.max(0, toFiniteNumber(cost, 0)) / 3),
    measurePath: (waypoints, options = {}) => measureGridPath(waypoints, options),
    measureTokens: (source, target) => {
        if (!source || !target) return { gridless: true, cost: 0, range: 0 };
        const sourceOffsets = source.getOccupiedGridSpaceOffsets?.() ?? [{ i: source.x ?? 0, j: source.y ?? 0 }];
        const targetOffsets = target.getOccupiedGridSpaceOffsets?.() ?? [{ i: target.x ?? 0, j: target.y ?? 0 }];
        let cost = Infinity;
        for (const left of sourceOffsets) for (const right of targetOffsets) {
            cost = Math.min(cost, Math.max(Math.abs(toFiniteNumber(left.i) - toFiniteNumber(right.i)), Math.abs(toFiniteNumber(left.j) - toFiniteNumber(right.j))));
        }
        if (!Number.isFinite(cost)) cost = 0;
        return { gridless: !source.parent?.grid?.type, cost, range: Math.ceil(cost / 3) };
    },
    profileBounds: (profile = {}) => {
        const minimum = Math.max(0, toFiniteNumber(profile.range_min ?? profile.rangeMin, 0));
        const maximum = Math.max(minimum, toFiniteNumber(profile.range_max ?? profile.rangeMax, minimum));
        return { minimum, maximum, innerCost: minimum * 3, outerCost: maximum * 3 };
    },
});
