import test from "node:test";
import assert from "node:assert/strict";
import { ConditionService } from "../system/scripts/services/condition-service.js";
import { TurnStateService, createTurnState, normalizeTurnState } from "../system/scripts/services/turn-state-service.js";
import { MovementService, RangeBandService, measureGridPath, movementStepCost } from "../system/scripts/services/movement-service.js";
import { InitiativeService } from "../system/scripts/services/initiative-service.js";
import { ActionService } from "../system/scripts/services/action-service.js";

test("Water extra action can be no-check or a different action type", () => {
    const turns = new TurnStateService();
    let state = createTurnState("combat:1:0");
    state.waterExtraAction.available = true;
    let reserved = turns.reserveAction(state, { actionTypes: ["attack"], requiresCheck: true });
    assert.equal(reserved.slot, "waterExtraAction");
    state = turns.commitReservation(reserved.state, reserved.reservationId).state;
    reserved = turns.reserveAction(state, { actionTypes: ["attack"], requiresCheck: false });
    assert.equal(reserved.ok, true);
    assert.equal(reserved.slot, "primaryAction");
    assert.equal(turns.commitReservation(reserved.state, reserved.reservationId).ok, true);

    state = createTurnState("combat:1:0");
    state.waterExtraAction.available = true;
    reserved = turns.reserveAction(state, { actionTypes: ["attack"], requiresCheck: true, preferWater: false });
    state = turns.commitReservation(reserved.state, reserved.reservationId).state;
    reserved = turns.reserveAction(state, { actionTypes: ["move"], requiresCheck: true });
    assert.equal(reserved.ok, true);
    assert.equal(reserved.slot, "waterExtraAction");

    reserved = turns.reserveAction(state, { actionTypes: ["attack"], requiresCheck: true });
    assert.equal(reserved.ok, false);
});

test("eligible Water actions spend the Water slot before the primary action", () => {
    const turns = new TurnStateService();
    let state = createTurnState("combat:1:0");
    state.waterExtraAction.available = true;

    let reserved = turns.reserveAction(state, { actionId: "prepare_item", actionTypes: ["support"], requiresCheck: false });
    assert.equal(reserved.slot, "waterExtraAction");
    state = turns.commitReservation(reserved.state, reserved.reservationId).state;
    assert.equal(state.waterExtraAction.used, true);
    assert.equal(state.primaryAction.used, false);

    reserved = turns.reserveAction(state, { actionId: "calming_breath", actionTypes: ["support"], requiresCheck: false });
    assert.equal(reserved.ok, true);
    assert.equal(reserved.slot, "primaryAction");
});

test("Water extra action rejects repeated check action types", () => {
    const turns = new TurnStateService();
    let state = createTurnState("combat:1:0");
    state.waterExtraAction.available = true;
    let reserved = turns.reserveAction(state, { actionTypes: ["attack"], requiresCheck: true, preferWater: false });
    state = turns.commitReservation(reserved.state, reserved.reservationId).state;
    assert.equal(turns.reserveAction(state, { actionTypes: ["attack"], requiresCheck: true }).ok, false);
});

test("action reservation is cancelled without consuming its slot", () => {
    const turns = new TurnStateService();
    const state = createTurnState("combat:1:0");
    const reservation = turns.reserveAction(state, { actionTypes: ["support"] });
    const cancelled = turns.cancelReservation(reservation.state, reservation.reservationId);
    assert.equal(cancelled.primaryAction.used, false);
    assert.equal(Object.keys(cancelled.reservations).length, 0);
});

test("legacy Combatant turn state is filled with new fields without losing its current action", () => {
    const state = normalizeTurnState({ turnKey: "combat:1:0", primaryAction: { used: true, actionId: "old" } }, "combat:1:0");
    assert.equal(state.primaryAction.used, true);
    assert.equal(state.primaryAction.actionId, "old");
    assert.deepEqual(state.freeMovement.movementCosts, {});
    assert.deepEqual(state.reservations, {});
});

test("action commit mutates stable turn fields granularly and never transactions reservations", () => {
    const turns = new TurnStateService();
    const conditions = new ConditionService();
    const actions = new ActionService({ turnStateService: turns, conditionService: conditions });
    const actor = { uuid: "Actor.A", statuses: new Set(["burning"]), system: { stance: "fire", strife: { value: 2 } } };
    const combatant = { uuid: "Combat.C.Combatant.A", actor, flags: { l5r5e: { turnState: createTurnState("c:1:0") } } };
    const reservation = turns.reserveAction(combatant.flags.l5r5e.turnState, { actionTypes: ["attack"] });
    combatant.flags.l5r5e.turnState = reservation.state;
    const prepared = actions.prepareCommit(combatant, reservation.reservationId, { context: { lifecycle: { combatId: "c", round: 1, turn: 0 } } });
    assert.equal(prepared.ok, true);
    assert.equal(prepared.state.primaryAction.used, true);
    assert.ok(prepared.mutations.some(({ path }) => path === "flags.l5r5e.turnState.primaryAction"));
    assert.ok(prepared.mutations.some(({ path }) => path === "flags.l5r5e.turnState.actionTypesUsed"));
    assert.ok(prepared.mutations.every(({ path }) => path !== "flags.l5r5e.turnState" && !path.endsWith(".reservations")));
    assert.ok(prepared.mutations.some(({ path, after }) => path === "system.strife.value" && after === 5));
});

test("reservations use non-empty action ids and are idempotent per intent", () => {
    const turns = new TurnStateService();
    const state = createTurnState("c:1:0");
    const first = turns.reserveAction(state, { actionId: "", actionTypes: ["attack"], intentId: "picker-1" });
    const second = turns.reserveAction(first.state, { actionId: "", actionTypes: ["attack"], intentId: "picker-1" });
    assert.equal(first.ok, true);
    assert.notEqual(first.state.reservations[first.reservationId].actionId, "");
    assert.equal(second.idempotent, true);
    assert.equal(second.reservationId, first.reservationId);
    assert.equal(Object.keys(second.state.reservations).length, 1);
});

test("persist explicitly removes reservations missing from the next nested flag state", async () => {
    const turns = new TurnStateService();
    const previousFoundry = globalThis.foundry;
    class ForcedDeletion {}
    globalThis.foundry = { data: { operators: { ForcedDeletion } } };
    const previous = createTurnState("c:1:0");
    previous.reservations.stale = { reservationId: "stale", slot: "primaryAction" };
    const updates = [];
    const combatant = {
        flags: { l5r5e: { turnState: previous } },
        async update(data) { updates.push(data); },
    };

    try {
        await turns.persist(combatant, createTurnState("c:1:0"));
        assert.equal(updates.length, 1);
        assert.ok(updates[0]["flags.l5r5e.turnState"].reservations.stale instanceof ForcedDeletion);
        assert.ok(!Object.keys(updates[0]).some((key) => key.includes("-=")));
    } finally {
        globalThis.foundry = previousFoundry;
    }
});

test("movement costs orthogonal, diagonal and difficult exit by actual waypoint", () => {
    assert.equal(movementStepCost({ x: 0, y: 0 }, { x: 1, y: 0 }), 1);
    assert.equal(movementStepCost({ x: 0, y: 0 }, { x: 1, y: 1 }), 2);
    assert.equal(movementStepCost({ x: 0, y: 0 }, { x: 1, y: 1 }, { difficult: true }), 3);
    const measured = measureGridPath([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }], { difficultSquares: new Set(["1,0"]) });
    assert.equal(measured.cost, 4);
    assert.equal(measureGridPath([{ x: 0, y: 0 }, { x: 1, y: 0 }], { blockedSquares: new Set(["1,0"]) }).valid, false);
    assert.equal(measureGridPath([{ x: 0, y: 0 }, { x: 1, y: 0 }], { hostileSquares: new Set(["0,0"]) }).cost, 2);
});

test("Maneuver budgets provide one band on failure and 2+ bands on success", () => {
    const service = new MovementService({ turnStateService: new TurnStateService(), conditionService: new ConditionService() });
    assert.equal(service.maneuverBudget({ checked: true, success: false, bonusSuccesses: 9 }), 3);
    assert.equal(service.maneuverBudget({ checked: true, success: true, bonusSuccesses: 0 }), 6);
    assert.equal(service.maneuverBudget({ checked: true, success: true, bonusSuccesses: 4 }), 12);
    assert.equal(service.techniqueBudget(3, { system: { activation: { movement: { mode: "add", bands: 2, multiplier: 1 } } } }), 9);
    assert.equal(service.techniqueBudget(3, { system: { activation: { movement: { mode: "multiply", bands: 0, multiplier: 2 } } } }), 6);
});

test("Maneuver movement adds budget without consuming the separate free band", () => {
    const turns = new TurnStateService();
    let state = createTurnState("c:1:0");
    state = turns.beginMovement(state, { budget: 3, kind: "maneuver", anchor: { x: 0, y: 0 } }).state;
    assert.equal(state.freeMovement.budget, 6);
    state = turns.spendMovement(state, { cost: 3, movementId: "maneuver", kind: "maneuver" }).state;
    assert.equal(turns.getters(state).movementRemaining, 3);
    assert.equal(state.freeMovement.used, false);
});

test("movement undo restores budget but not the action", async () => {
    const turns = new TurnStateService();
    const service = new MovementService({ turnStateService: turns, conditionService: new ConditionService() });
    const combatant = { actor: { system: { stance: "water" } }, flags: { l5r5e: { turnState: createTurnState("c:1:0") } } };
    combatant.flags.l5r5e.turnState.movedThisTurn = true;
    combatant.flags.l5r5e.turnState.movementUndoAvailable = true;
    combatant.flags.l5r5e.turnState.freeMovement.spent = 3;
    combatant.flags.l5r5e.turnState.freeMovement.movementIds = ["move-1"];
    const token = { revertRecordedMovement: async (id) => id === "move-1" };
    const result = await service.undoMovement(combatant, token, { combatId: "c", round: 1, turn: 0, stance: "water" });
    assert.equal(result.ok, true);
    assert.equal(result.state.freeMovement.spent, 0);
    assert.equal(result.state.primaryAction.used, false);
});

test("manual movement validation uses Foundry spaces and charges every diagonal twice", () => {
    const previousGame = globalThis.game;
    globalThis.game = { settings: { get: () => false } };
    const service = new MovementService({ turnStateService: new TurnStateService(), conditionService: new ConditionService() });
    const token = {
        parent: { grid: { type: 1 } },
        measureMovementPath: (_waypoints) => ({ spaces: 3, diagonals: 1 }),
    };
    const combatant = { actor: { system: { stance: "water" } } };
    try {
        const result = service.validateHookMovement(token, {
            id: "move-1",
            origin: { x: 0, y: 0 },
            destination: { x: 100, y: 100 },
            pending: { waypoints: [{ x: 100, y: 100 }] },
        }, combatant);
        assert.equal(result.ok, false);
        assert.equal(result.code, "movementBudgetExceeded");
        assert.equal(result.cost, 4);
        assert.equal(result.remaining, 3);
    } finally {
        globalThis.game = previousGame;
    }
});

test("manual movement validation falls back to Foundry origin and destination", () => {
    const previousGame = globalThis.game;
    globalThis.game = { settings: { get: () => false } };
    const service = new MovementService({ turnStateService: new TurnStateService(), conditionService: new ConditionService() });
    const token = {
        parent: { grid: { type: 1 } },
        measureMovementPath: (waypoints) => {
            assert.deepEqual(waypoints, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
            return { spaces: 1, diagonals: 0 };
        },
    };
    const combatant = { actor: { system: { stance: "water" } } };
    try {
        const result = service.validateHookMovement(token, {
            id: "move-fallback",
            origin: { x: 0, y: 0 },
            destination: { x: 100, y: 0 },
            pending: { spaces: 1, diagonals: 0, waypoints: [] },
        }, combatant);
        assert.equal(result.ok, true);
        assert.equal(result.cost, 1);
    } finally {
        globalThis.game = previousGame;
    }
});

test("manual movement validation rejects a token update when no tiles remain", () => {
    const previousGame = globalThis.game;
    const turns = new TurnStateService();
    const service = new MovementService({ turnStateService: turns, conditionService: new ConditionService() });
    const state = createTurnState("combat:1:0");
    state.freeMovement.spent = 3;
    const combatant = { id: "combatant-player", actor: { system: { stance: "earth" } }, flags: { l5r5e: { turnState: state } } };
    const token = {
        x: 0,
        y: 0,
        parent: { grid: { type: 1 } },
        combatant,
        measureMovementPath: (waypoints) => {
            assert.deepEqual(waypoints, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
            return { spaces: 1, diagonals: 0 };
        },
    };
    globalThis.game = { combat: { id: "combat", round: 1, turn: 0, combatant } };
    try {
        const result = service.validateHookMovement(token, {
            origin: { x: 0, y: 0 },
            destination: { x: 100, y: 0 },
        }, combatant);
        assert.deepEqual(result, { ok: false, code: "movementBudgetExceeded", cost: 1, remaining: 0 });
    } finally {
        globalThis.game = previousGame;
    }
});

test("manual movement history accumulates across drags and can be reset to its origin", async () => {
    const previousGame = globalThis.game;
    const turns = new TurnStateService();
    const service = new MovementService({ turnStateService: turns, conditionService: new ConditionService() });
    globalThis.game = { settings: { get: () => false }, combat: { id: "c", round: 1, turn: 0 } };
    const combatant = { actor: { system: { stance: "earth" } }, flags: { l5r5e: { turnState: createTurnState("c:1:0") } } };
    const reverted = [];
    const token = {
        parent: { grid: { type: 1 } },
        measureMovementPath: (_waypoints, options) => options?.cost ? { spaces: 0 } : { spaces: 1, diagonals: 0 },
        revertRecordedMovement: async (id) => { reverted.push(id); return true; },
    };
    const moves = ["out", "back"].map((id, index) => ({
        id,
        origin: { x: index * 100, y: 0 },
        destination: { x: (index + 1) * 100, y: 0 },
        pending: { spaces: 1, diagonals: 0, waypoints: [{ x: (index + 1) * 100, y: 0 }] },
    }));
    try {
        for (const movement of moves) {
            assert.equal(service.validateHookMovement(token, movement, combatant).ok, true);
            assert.equal((await service.recordHookMovement(token, movement, combatant)).ok, true);
        }
        assert.equal(turns.getState(combatant).freeMovement.spent, 2);
        assert.equal(service.canUndoMovement(combatant), true);
        const reset = await service.undoMovement(combatant, token);
        assert.equal(reset.ok, true);
        assert.equal(reset.state.freeMovement.spent, 0);
        assert.deepEqual(reverted, ["out"]);
        assert.equal(reset.state.movementUndoAvailable, false);
    } finally {
        globalThis.game = previousGame;
    }
});

test("movement reset returns to its anchor when Foundry history cannot revert recorded IDs", async (t) => {
    const previousGame = globalThis.game;
    t.after(() => { globalThis.game = previousGame; });
    const turns = new TurnStateService();
    const service = new MovementService({ turnStateService: turns, conditionService: new ConditionService() });
    globalThis.game = { combat: { id: "c", round: 1, turn: 0 } };
    const state = createTurnState("c:1:0");
    state.freeMovement.spent = 2;
    state.freeMovement.movementIds = ["out", "back"];
    state.freeMovement.movementCosts = { out: 1, back: 1 };
    state.movedThisTurn = true;
    state.movementUndoAvailable = true;
    state.movementAnchor = { x: 0, y: 0 };
    const combatant = { actor: { system: { stance: "earth" } }, flags: { l5r5e: { turnState: state } } };
    let movedTo;
    let historyCleared = false;
    const token = {
        id: "token-player",
        x: 200,
        y: 0,
        revertRecordedMovement: async () => false,
        move: async (waypoint, options) => {
            movedTo = { waypoint, options };
            token.x = waypoint.x;
            token.y = waypoint.y;
            return true;
        },
        clearMovementHistory: async () => { historyCleared = true; },
    };
    const reset = await service.undoMovement(combatant, token);
    assert.equal(reset.ok, true);
    assert.deepEqual(movedTo.waypoint, { x: 0, y: 0 });
    assert.deepEqual(movedTo.options.constrainOptions, { ignoreCost: true });
    assert.equal(historyCleared, true);
    assert.equal(token.x, 0);
    assert.equal(reset.state.freeMovement.spent, 0);
    assert.deepEqual(reset.state.freeMovement.movementIds, []);
    assert.equal(service.isResettingToken(token), false);
});

test("recordToken hook fallback charges the latest Foundry movement history entry", async () => {
    const previousGame = globalThis.game;
    const turns = new TurnStateService();
    const service = new MovementService({ turnStateService: turns, conditionService: new ConditionService() });
    globalThis.game = { settings: { get: () => false }, combat: { id: "c", round: 1, turn: 0 } };
    const combatant = { actor: { system: { stance: "earth" } }, flags: { l5r5e: { turnState: createTurnState("c:1:0") } } };
    const token = {
        movementHistory: [
            { x: 0, y: 0, movementId: null, cost: 0 },
            { x: 100, y: 0, movementId: "foundry-move-1", cost: 1 },
            { x: 200, y: 0, movementId: "foundry-move-1", cost: 1 },
        ],
        getMovementOrigin: () => ({ x: 0, y: 0 }),
    };
    try {
        const result = await service.recordHookMovement(token, undefined, combatant);
        assert.equal(result.ok, true);
        assert.equal(result.cost, 2);
        assert.equal(turns.getState(combatant).freeMovement.spent, 2);
        assert.deepEqual(turns.getState(combatant).freeMovement.movementIds, ["foundry-move-1"]);
    } finally {
        globalThis.game = previousGame;
    }
});

test("an action committed after movement disables movement reset", () => {
    const turns = new TurnStateService();
    let state = createTurnState("c:1:0");
    state = turns.beginMovement(state, { anchor: { x: 0, y: 0 } }).state;
    state = turns.spendMovement(state, { cost: 1, movementId: "move-1" }).state;
    const reservation = turns.reserveAction(state, { actionTypes: ["support"], requiresCheck: false });
    const committed = turns.commitReservation(reservation.state, reservation.reservationId);
    assert.equal(committed.ok, true);
    assert.equal(committed.state.movementUndoAvailable, false);
    assert.deepEqual(committed.state.freeMovement.movementIds, []);
});

test("Prepared is boolean, Fire bonus contributes to initiative, minion does not roll", () => {
    const service = new InitiativeService();
    const actor = { type: "npc", system: { type: "minion", prepared: true, focus: 5, vigilance: 2 } };
    assert.equal(service.isPrepared(actor), true);
    assert.equal(service.minionScore(actor), 5);
    assert.equal(service.score(actor, { prepared: true, success: true, bonusSuccesses: 3 }), 9);
});

test("initiative ties are Honor, PC/adversary/minion, then stable key", () => {
    const service = new InitiativeService();
    const combatant = (id, type, npcType, honor) => ({ id, initiative: 5, actor: { type, system: { type: npcType, social: { honor } } }, flags: { l5r5e: { initiativeTieKey: id } } });
    const pc = combatant("b", "character", null, 2);
    const adversary = combatant("a", "npc", "adversary", 2);
    const minion = combatant("c", "npc", "minion", 2);
    assert.deepEqual([minion, adversary, pc].sort((a, b) => service.compare(a, b)).map(({ id }) => id), ["b", "a", "c"]);
    const lowerHonor = combatant("z", "character", null, 1);
    assert.equal(service.compare(lowerHonor, pc) < 0, true);
});

test("initiative groups share result and stance", () => {
    const service = new InitiativeService();
    const members = ["a", "b"].map((id) => ({ id, flags: { l5r5e: { initiativeGroupId: "mob" } }, actor: { system: { stance: "fire" } } }));
    members[0].initiative = 7;
    const updates = service.groupUpdates(members, members[0]);
    assert.deepEqual(updates.map((update) => update._id), ["a", "b"]);
    assert.ok(updates.every((update) => update.initiative === 7));
});

test("condition lifecycle handles Dying and scene recovery with Exhausted", () => {
    const service = new ConditionService();
    const actor = { statuses: new Set(["dying", "exhausted"]), flags: { l5r5e: { dyingRounds: 2 } }, system: { fatigue: { value: 7, max: 10 }, strife: { value: 5, max: 8 } } };
    assert.deepEqual(service.endTurnEffects(actor), [{ type: "setDyingRounds", rounds: 1 }]);
    assert.deepEqual(service.sceneEndRecovery(actor), { fatigue: 7, strife: 5 });
    actor.statuses.delete("exhausted");
    assert.deepEqual(service.sceneEndRecovery(actor), { fatigue: 5, strife: 4 });
});

test("hostile spaces are enterable and charge on exit; optional token blocking remains opt-in", () => {
    const service = new MovementService({ turnStateService: new TurnStateService(), conditionService: new ConditionService() });
    const hostile = { id: "enemy", disposition: -1, hidden: false, getOccupiedGridSpaceOffsets: () => [{ i: 1, j: 0 }] };
    const grid = {
        getDirectPath: (waypoints) => waypoints.map(({ x, y }) => ({ i: x, j: y })),
        getTopLeftPoint: (offset) => ({ x: offset.i, y: offset.j }),
    };
    const token = { id: "self", disposition: 1, parent: { grid, tokens: [] }, getOccupiedGridSpaceOffsets: ({ x, y } = {}) => [{ i: x ?? 0, j: y ?? 0 }] };
    token.parent.tokens = [token, hostile];
    const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    assert.equal(service.validateTokenSpaces(token, path).ok, true);
    assert.equal(service.validateTokenSpaces(token, path, { tokensBlockSpaces: true }).code, "tokenOccupied");
    assert.equal(service.validateTokenSpaces(token, path, { tokensBlockSpaces: true, gmOverride: true }).ok, true);
    assert.equal(service.enemyExitSurcharge(token, [{ x: 1, y: 0 }, { x: 2, y: 0 }]), 1);
});

test("public range-band API measures large tokens, gridless fallback, and profile bounds", () => {
    const source = { parent: { grid: { type: 1 } }, getOccupiedGridSpaceOffsets: () => [{ i: 0, j: 0 }, { i: 1, j: 0 }] };
    const target = { getOccupiedGridSpaceOffsets: () => [{ i: 4, j: 0 }] };
    assert.deepEqual(RangeBandService.measureTokens(source, target), { gridless: false, cost: 3, range: 1 });
    assert.deepEqual(RangeBandService.profileBounds({ range_min: 1, range_max: 3 }), { minimum: 1, maximum: 3, innerCost: 3, outerCost: 9 });
    assert.equal(RangeBandService.measureTokens(null, target).gridless, true);
});

test("range-band measurement counts a diagonal square as two movement spaces", () => {
    const source = { parent: { grid: { type: 1 } }, getOccupiedGridSpaceOffsets: () => [{ i: 0, j: 0 }] };
    const target = { getOccupiedGridSpaceOffsets: () => [{ i: 1, j: 1 }] };
    assert.deepEqual(RangeBandService.measureTokens(source, target), { gridless: false, cost: 2, range: 1 });
});

test("attack range validation blocks an out-of-range target and allows an in-range profile", (t) => {
    const previousGame = globalThis.game;
    const previousCanvas = globalThis.canvas;
    t.after(() => { globalThis.game = previousGame; globalThis.canvas = previousCanvas; });
    const scene = { id: "Scene.A" };
    const sourceDocument = { parent: scene, getOccupiedGridSpaceOffsets: () => [{ i: 0, j: 0 }], actorId: "Actor.A" };
    const source = { document: sourceDocument, center: { x: 0, y: 0 } };
    const target = { id: "Token.B", documentName: "Token", parent: scene, center: { x: 30, y: 0 }, actorId: "Actor.B" };
    target.getOccupiedGridSpaceOffsets = () => [{ i: 3, j: 0 }];
    target.object = target;
    globalThis.game = { settings: { get: () => ({ enabled: true, ranges: { 0: { start: 0 }, 1: { start: 1 }, 2: { start: 2 } } }) } };
    globalThis.canvas = { scene, grid: { size: 1, measureDistance: (left, right) => Math.abs(right.x - left.x) }, tokens: { get: () => target.object } };
    scene.grid = { distance: 1 };
    const context = { actor: { id: "Actor.A", getActiveTokens: () => [source] }, target, actionTypes: ["attack"], attackProfileSnapshot: { range: { minimum: 0, maximum: 1 } } };
    assert.equal(RangeBandService.validateAttack(context).legal, false);
    globalThis.game.settings.get = () => ({ enabled: false, ranges: { 0: { start: 0 }, 1: { start: 1 }, 2: { start: 2 } } });
    assert.equal(RangeBandService.validateAttack(context).legal, false, "disabled range visualization must not bypass a physical attack's reach check");
    globalThis.game.settings.get = () => ({ enabled: true, ranges: { 0: { start: 0 }, 1: { start: 1 }, 2: { start: 2 } } });
    target.center.x = 4;
    target.getOccupiedGridSpaceOffsets = () => [{ i: 1, j: 0 }];
    assert.equal(RangeBandService.validateAttack(context).legal, true);
    assert.equal(RangeBandService.validateAttack({ ...context, actionTypes: ["scheme"] }).measurable, false);
});

test("attack range validation resolves canvas Token placeables through their TokenDocument", (t) => {
    const previousGame = globalThis.game;
    const previousCanvas = globalThis.canvas;
    t.after(() => { globalThis.game = previousGame; globalThis.canvas = previousCanvas; });
    const scene = { id: "Scene.Placeables" };
    const sourceDocument = { parent: scene, getOccupiedGridSpaceOffsets: () => [{ i: 0, j: 0 }], actorId: "Actor.A" };
    const source = { document: sourceDocument, center: { x: 0, y: 0 } };
    const targetDocument = { id: "Token.Placeable", documentName: "Token", parent: scene, getOccupiedGridSpaceOffsets: () => [{ i: 3, j: 0 }], actorId: "Actor.B" };
    const target = { id: targetDocument.id, documentName: "Token", document: targetDocument, center: { x: 30, y: 0 } };
    targetDocument.object = target;
    globalThis.game = { settings: { get: () => ({ enabled: true, ranges: { 0: { start: 0 }, 1: { start: 1 }, 2: { start: 2 } } }) } };
    scene.grid = { distance: 1 };
    globalThis.canvas = { scene, grid: { size: 1, measureDistance: (left, right) => Math.abs(right.x - left.x) }, tokens: { get: () => target } };
    const context = { actor: { id: "Actor.A", getActiveTokens: () => [source] }, target, actionTypes: ["attack"], attackProfileSnapshot: { range: { minimum: 0, maximum: 1 } } };
    const result = RangeBandService.validateAttack(context);
    assert.equal(result.measurable, true);
    assert.equal(result.legal, false);
    assert.equal(result.rangeBand, 2);
});

test("a technique's declared target range overrides the weapon's range for attack legality", (t) => {
    const previousGame = globalThis.game;
    const previousCanvas = globalThis.canvas;
    t.after(() => { globalThis.game = previousGame; globalThis.canvas = previousCanvas; });
    const scene = { id: "Scene.TechniqueRange", grid: { distance: 5 } };
    const sourceDocument = { parent: scene, getOccupiedGridSpaceOffsets: () => [{ i: 0, j: 0 }], actorId: "Actor.A" };
    const source = { document: sourceDocument, center: { x: 50, y: 50 } };
    const target = { id: "Token.B", documentName: "Token", parent: scene, center: { x: 650, y: 50 }, actorId: "Actor.B" };
    target.getOccupiedGridSpaceOffsets = () => [{ i: 6, j: 0 }];
    target.object = target;
    globalThis.game = { settings: { get: () => ({ ranges: { 0: { start: 0 }, 1: { start: 3 }, 2: { start: 6 }, 3: { start: 9 } } }) } };
    globalThis.canvas = {
        scene,
        grid: { size: 100, measureDistance: (left, right) => Math.abs(right.x - left.x) / 100 * scene.grid.distance },
        tokens: { get: () => target },
    };
    const context = {
        actor: { id: "Actor.A", getActiveTokens: () => [source] },
        target,
        item: { type: "technique", system: { activation: { range: { minimum: 2, maximum: 3 } } } },
        actionId: "soaring-slice",
        actionTypes: ["attack"],
        attackProfileSnapshot: { range: { minimum: 0, maximum: 1 }, damage: 4, deadliness: 5 },
    };
    const inKataRange = RangeBandService.validateAttack(context);
    assert.equal(inKataRange.legal, true);
    assert.equal(inKataRange.rangeBand, 2);
    assert.equal(inKataRange.minimum, 2);
    assert.equal(inKataRange.maximum, 3);

    target.center.x = 350;
    target.getOccupiedGridSpaceOffsets = () => [{ i: 3, j: 0 }];
    assert.equal(RangeBandService.validateAttack(context).legal, false);
});

test("attack kata with the default zero range placeholder inherit the readied weapon profile", (t) => {
    const previousGame = globalThis.game;
    const previousCanvas = globalThis.canvas;
    t.after(() => { globalThis.game = previousGame; globalThis.canvas = previousCanvas; });
    const scene = { id: "Scene.KataWeaponRange", grid: { distance: 5 } };
    const sourceDocument = { parent: scene, getOccupiedGridSpaceOffsets: () => [{ i: 0, j: 0 }], actorId: "Actor.A" };
    const source = { document: sourceDocument, center: { x: 50, y: 50 } };
    const target = { id: "Token.B", documentName: "Token", parent: scene, center: { x: 650, y: 50 }, actorId: "Actor.B" };
    target.getOccupiedGridSpaceOffsets = () => [{ i: 6, j: 0 }];
    target.object = target;
    globalThis.game = { settings: { get: () => ({ ranges: { 0: { start: 0 }, 1: { start: 3 }, 2: { start: 6 }, 3: { start: 9 } } }) } };
    globalThis.canvas = {
        scene,
        grid: { size: 100, measureDistance: (left, right) => Math.abs(right.x - left.x) / 100 * scene.grid.distance },
        tokens: { get: () => target },
    };
    const result = RangeBandService.validateAttack({
        actor: { id: "Actor.A", getActiveTokens: () => [source] },
        target,
        item: { type: "technique", system: { activation: { range: { minimum: 0, maximum: 0 }, target: { filters: {} } } } },
        actionTypes: ["attack"],
        attackProfileSnapshot: { range: { minimum: 1, maximum: 2 }, damage: 4, deadliness: 5 },
    });
    assert.equal(result.legal, true);
    assert.equal(result.rangeBand, 2);
    assert.equal(result.minimum, 1);
    assert.equal(result.maximum, 2);
});

test("expired Void suspensions cannot reopen other Rings through callers without lifecycle", (t) => {
    const previousGame = globalThis.game;
    t.after(() => { globalThis.game = previousGame; });
    globalThis.game = { combat: { id: "C", round: 2, turn: 0 } };
    const conditions = new ConditionService();
    const actor = { statuses: new Set(["incapacitated"]), flags: { l5r5e: { conditionSuspensions: { incapacitated: { expiresAt: { combatId: "C", round: 2, turn: 0 } } } } } };
    assert.equal(conditions.isActive(actor, "incapacitated"), false);
    game.combat.turn = 1;
    assert.equal(conditions.isActive(actor, "incapacitated"), true);
    assert.deepEqual(conditions.allowedRingsForCheck(actor), ["void"]);
    game.combat = { id: "new-combat", round: 1, turn: 0 };
    assert.equal(conditions.isActive(actor, "incapacitated"), true);
    game.combat = null;
    assert.equal(conditions.isActive(actor, "incapacitated"), true);
});

test("pruning suspensions sends actual Foundry deletions and retains unexpired effects", async (t) => {
    const priorFoundry = globalThis.foundry;
    t.after(() => { globalThis.foundry = priorFoundry; });
    class ForcedDeletion {}
    globalThis.foundry = { data: { operators: { ForcedDeletion } } };
    const conditions = new ConditionService();
    const stored = { dazed: { expiresAt: { round: 1, turn: 0 } }, unconscious: { expiresAt: { round: 3, turn: 0 } } };
    let written;
    const actor = { flags: { l5r5e: { conditionSuspensions: stored } }, setFlag: async (_namespace, _key, changes) => {
        written = changes;
        for (const key of Object.keys(changes)) if (changes[key] instanceof ForcedDeletion) delete stored[key];
    } };
    await conditions.pruneSuspensions(actor, { round: 2, turn: 0 });
    assert.ok(written.dazed instanceof ForcedDeletion);
    assert.deepEqual(Object.keys(written), ["dazed"]);
    assert.deepEqual(Object.keys(stored), ["unconscious"]);
    await conditions.pruneSuspensions(actor, { sceneEnd: true });
    assert.deepEqual(stored, {});
});

test("ending a turn reads its original action tags even after Combat has advanced", () => {
    const turns = new TurnStateService();
    const state = createTurnState("C:1:0");
    state.actionTypesUsed = ["attack"];
    const combatant = { combat: { id: "C", round: 1, turn: 1 }, flags: { l5r5e: { turnState: state } } };
    assert.deepEqual(turns.getState(combatant, { combatId: "C", round: 1, turn: 0 }).actionTypesUsed, ["attack"]);
    assert.deepEqual(turns.getState(combatant).actionTypesUsed, []);
});

test("closing an old roll cannot overwrite the current turn's committed action", async () => {
    const turns = new TurnStateService();
    let writes = 0;
    turns.persist = async () => { writes++; };
    const current = createTurnState("C:2:0");
    current.primaryAction.used = true;
    const combatant = { combat: { id: "C", round: 2, turn: 0 }, flags: { l5r5e: { turnState: current } } };
    const actions = new ActionService({ turnStateService: turns, conditionService: new ConditionService() });
    const result = await actions.cancel(combatant, "old", { combatId: "C", round: 1, turn: 0 });
    assert.equal(result.primaryAction.used, true);
    assert.equal(writes, 0);
});
