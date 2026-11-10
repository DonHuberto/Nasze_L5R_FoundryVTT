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
        this.resettingTokens = new Set();
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

    async startManeuver(combatant, token, { checked = false, success = false, bonusSuccesses = 0, preferWater = true, lifecycle = {}, ...options } = {}) {
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
        if (!this.canUndoMovement(combatant, lifecycle)) return { ok: false, code: "movementUndoUnavailable" };
        const ids = [...state.freeMovement.movementIds];
        const firstMovementId = ids[0];
        let reverted = false;
        this.resettingTokens.add(tokenDocument.id);
        try {
            reverted = await tokenDocument.revertRecordedMovement(firstMovementId);
            if (!reverted) {
                const anchor = state.movementAnchor;
                if (!anchor || !Number.isFinite(Number(anchor.x)) || !Number.isFinite(Number(anchor.y))) {
                    globalThis.ui?.notifications?.warn?.(globalThis.game?.i18n?.localize?.("l5r5e.automation.movement.undoConflict") ?? "Movement history changed and cannot be undone automatically.");
                    return { ok: false, code: "movementUndoConflict", movementId: firstMovementId };
                }
                const alreadyAtAnchor = tokenDocument.x === anchor.x && tokenDocument.y === anchor.y;
                const returned = alreadyAtAnchor || await tokenDocument.move(
                    { x: anchor.x, y: anchor.y },
                    {
                        id: makeId("movement-reset"),
                        method: "api",
                        animate: false,
                        showRuler: false,
                        constrainOptions: { ignoreCost: true },
                        l5r5e: { movementReset: true, gmOverride: true },
                    },
                );
                if (!returned) {
                    globalThis.ui?.notifications?.warn?.(globalThis.game?.i18n?.localize?.("l5r5e.automation.movement.undoConflict") ?? "Movement history changed and cannot be undone automatically.");
                    return { ok: false, code: "movementUndoConflict", movementId: firstMovementId };
                }
                await tokenDocument.clearMovementHistory?.();
            }
        } finally {
            this.resettingTokens.delete(tokenDocument.id);
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

    canUndoMovement(combatant, lifecycle = {}) {
        const state = this.turns.getState(combatant, lifecycle);
        return Boolean(
            state.movementUndoAvailable &&
            state.freeMovement.movementIds.length > 0 &&
            Object.keys(state.reservations).length === 0
        );
    }

    isResettingToken(tokenDocument) {
        return this.resettingTokens.has(tokenDocument?.id);
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
        const rawWaypoints = movement?.pending?.waypoints ?? movement?.waypoints ?? movement?.path ?? [];
        const origin = movement?.origin;
        const destination = movement?.destination;
        let waypoints = rawWaypoints;
        if (origin && waypoints.length && (waypoints[0].x !== origin.x || waypoints[0].y !== origin.y)) {
            waypoints = [origin, ...waypoints];
        }
        // V14 movement operations always expose origin/destination. Some token
        // drags provide an incomplete pending section, so retain a measurable
        // straight path instead of rejecting a valid drag as an unknown error.
        if (waypoints.length < 2 && origin && destination) waypoints = [origin, destination];
        if (waypoints.length < 2) return { ok: false, code: "movementPathUnavailable" };
        const tokensBlockSpaces = Boolean(globalThis.game?.settings?.get?.("l5r5e", "tokensBlockSpaces"));
        const blocker = this.validateTokenSpaces(tokenDocument, waypoints, { gmOverride, tokensBlockSpaces });
        if (!blocker.ok) return blocker;
        const measured = Number.isFinite(Number(movement?.pending?.spaces))
            ? movement.pending
            : tokenDocument.measureMovementPath(waypoints);
        const spaces = toFiniteNumber(measured.spaces ?? measured.distance ?? measured.cost, 0);
        const diagonals = Math.max(0, toFiniteNumber(measured.diagonals, 0));
        const cost = spaces + diagonals + this.enemyExitSurcharge(tokenDocument, waypoints);
        const remaining = this.remaining(combatant);
        if (cost > remaining && !gmOverride) return { ok: false, code: "movementBudgetExceeded", cost, remaining };
        const id = movement?.id ?? movement?.movementId;
        if (id) this.pendingCosts.set(id, cost);
        return { ok: true, cost, remaining };
    }

    async recordHookMovement(tokenDocument, movement, combatant) {
        if (this.isResettingToken(tokenDocument)) return { ok: true, skipped: true };
        // Manual drags can reach the recorded-history hook with only a
        // TokenDocument. In that case resolve the movement ID from Foundry's
        // public movement history instead of silently dropping the movement.
        const history = tokenDocument?.movementHistory ?? [];
        const id = movement?.id ?? movement?.movementId ?? history.at(-1)?.movementId;
        if (!id) return { ok: false, code: "movementIdMissing" };
        const state = this.turns.getState(combatant);
        if (state.freeMovement.movementIds.includes(id)) return { ok: true, idempotent: true, state };
        const recordedCost = history
            .filter((waypoint) => waypoint.movementId === id)
            .reduce((sum, waypoint) => sum + toFiniteNumber(waypoint.cost, 0), 0);
        const cost = this.pendingCosts.get(id) ?? recordedCost;
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
            // The grid movement rules charge a diagonal as one horizontal
            // plus one vertical step. Use the same distance here so attack
            // range validation agrees with movement and the HUD on square grids.
            cost = Math.min(cost, Math.abs(toFiniteNumber(left.i) - toFiniteNumber(right.i)) + Math.abs(toFiniteNumber(left.j) - toFiniteNumber(right.j)));
        }
        if (!Number.isFinite(cost)) cost = 0;
        return { gridless: !source.parent?.grid?.type, cost, range: Math.ceil(cost / 3) };
    },
    profileBounds: (profile = {}) => {
        const minimum = Math.max(0, toFiniteNumber(profile.minimum ?? profile.range_min ?? profile.rangeMin, 0));
        const maximum = Math.max(minimum, toFiniteNumber(profile.maximum ?? profile.range_max ?? profile.rangeMax, minimum));
        return { minimum, maximum, innerCost: minimum * 3, outerCost: maximum * 3 };
    },
    validateAttack: (context = {}) => {
        const isAttack = context.actionTypes?.includes("attack") || ["strike", "assault"].includes(context.actionId);
        if (!isAttack) return { legal: true, measurable: false };
        // Rolls can carry either a TokenDocument or its canvas Token placeable.
        // Prefer the underlying document: a placeable's `parent` is its layer,
        // not the scene, so using it here silently skipped range checks in HUD rolls.
        const selectedTarget = context.target ?? Array.from(globalThis.game?.user?.targets ?? [])[0]?.document;
        const targetDocument = selectedTarget?.document?.documentName === "Token"
            ? selectedTarget.document
            : selectedTarget?.documentName === "Token"
                ? selectedTarget
                : null;
        if (!targetDocument) return { legal: true, measurable: false };
        const sceneId = targetDocument?.parent?.id ?? globalThis.canvas?.scene?.id;
        const actorTokens = [
            ...(context.actor?.getActiveTokens?.() ?? []),
            ...(context.actor?.getActiveTokens?.(true, true) ?? []),
            ...(globalThis.canvas?.tokens?.placeables ?? []).filter((token) => token.actor?.id === context.actor?.id),
            ...(globalThis.canvas?.tokens?.controlled ?? []).filter((token) => token.actor?.id === context.actor?.id),
        ];
        const combatant = globalThis.game?.combat?.combatants?.find((entry) => entry.actorId === context.actor?.id);
        const combatantToken = combatant?.token?.object ?? globalThis.canvas?.tokens?.get?.(combatant?.tokenId) ?? combatant?.token;
        if (combatantToken) actorTokens.push(combatantToken);
        if (context.actor?.token) actorTokens.push(context.actor.token);
        const sourceIdentity = (token) => {
            const document = token?.document ?? token;
            return { document, actorId: document?.actorId ?? token?.actor?.id, sceneId: document?.parent?.id ?? token?.scene?.id };
        };
        const explicitActorTokens = actorTokens.some((token) => sourceIdentity(token).actorId === context.actor?.id);
        const source = actorTokens.find((token) => {
            const { actorId, sceneId: tokenSceneId } = sourceIdentity(token);
            const sameScene = !tokenSceneId || tokenSceneId === sceneId;
            const sameActor = explicitActorTokens ? actorId === context.actor?.id : actorId == null;
            return sameScene && sameActor;
        });
        const sourceDocument = source?.document ?? source ?? (actorTokens.length === 0 ? null : undefined);
        const targetPlaceable = targetDocument?.object ?? globalThis.canvas?.tokens?.get?.(targetDocument?.id);
        if (!sourceDocument || !targetDocument || typeof sourceDocument.getOccupiedGridSpaceOffsets !== "function" || typeof targetDocument.getOccupiedGridSpaceOffsets !== "function") {
            return { legal: false, measurable: false, code: "attackRangeUnavailable" };
        }
        const worldSettings = globalThis.game?.settings?.get?.("l5r5e", "tactical-grid-settings-world");
        const measured = RangeBandService.measureTokens(sourceDocument, targetDocument);
        if (!Number.isFinite(measured.range)) return { legal: false, measurable: false, code: "attackRangeUnavailable" };
        // `measureDistance` already returns scene distance units, not pixels.
        // The L5R band thresholds are expressed in grid spaces, so use the
        // shared occupied-cell measurement here just as the HUD does. Scaling
        // Foundry's result by distance / pixel-size mixed units and collapsed
        // ordinary 100px grids to near-zero distances.
        const effectiveDistance = measured.cost;
        const inferredProfiles = globalThis.game?.l5r5e?.equipment?.getAttackProfiles?.(context.actor) ?? [];
        const readyWeapons = inferredProfiles.filter((candidate) => candidate.source === "weapon" && candidate.available !== false);
        const inferredProfile = readyWeapons.length === 1 ? readyWeapons[0] : null;
        const profile = context.attackProfileSnapshot ?? inferredProfile;
        if (!profile) return { legal: false, measurable: true, code: "attackProfileRequired" };
        const bands = Object.entries(worldSettings?.ranges ?? {}).sort(([left], [right]) => Number(left) - Number(right));
        let rangeBand = measured.range;
        if (bands.length && Number.isFinite(effectiveDistance)) {
            rangeBand = 0;
            for (const [index, range] of bands) if (effectiveDistance >= Number(range.start)) rangeBand = Number(index);
        }
        // Technique attacks can declare their own target range independently
        // from the weapon profile used for damage. Soaring Slice is the main
        // example: its one-handed weapon keeps its normal damage/deadliness,
        // while the kata permits a thrown attack at Range 2–3.
        const activation = context.item?.type === "technique"
            ? context.item.system?.activation ?? context.item.activation
            : null;
        const configuredRange = activation?.target?.filters?.range ?? activation?.range;
        // Core technique records use {minimum: 0, maximum: 0} as a placeholder
        // when their range is inherited from the weapon. Only a non-zero
        // activation range (or an explicit target filter) overrides the
        // attack profile; otherwise ordinary attack kata use their weapon's
        // actual reach.
        const hasExplicitTechniqueRange = activation?.target?.filters?.range
            || configuredRange && (toFiniteNumber(configuredRange.minimum, 0) > 0 || toFiniteNumber(configuredRange.maximum, 0) > 0);
        const techniqueRange = hasExplicitTechniqueRange ? configuredRange : null;
        const bounds = RangeBandService.profileBounds(techniqueRange ?? profile.range ?? {
            range_min: profile.range_min ?? 0,
            range_max: profile.range_max ?? profile.rangeMin ?? 0,
        });
        return { legal: rangeBand >= bounds.minimum && rangeBand <= bounds.maximum, measurable: true, distance: effectiveDistance, rangeBand, ...bounds };
    },
});
