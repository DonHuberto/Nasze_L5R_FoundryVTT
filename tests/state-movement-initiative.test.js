import test from "node:test";
import assert from "node:assert/strict";
import { ConditionService } from "../system/scripts/services/condition-service.js";
import { TurnStateService, createTurnState, normalizeTurnState } from "../system/scripts/services/turn-state-service.js";
import { MovementService, RangeBandService, measureGridPath, movementStepCost } from "../system/scripts/services/movement-service.js";
import { InitiativeService } from "../system/scripts/services/initiative-service.js";
import { ActionService } from "../system/scripts/services/action-service.js";

test("Water extra action cannot share an action type and requires no check", () => {
    const turns = new TurnStateService();
    let state = createTurnState("combat:1:0");
    state.waterExtraAction.available = true;
    let reserved = turns.reserveAction(state, { actionTypes: ["attack"], requiresCheck: true });
    state = turns.commitReservation(reserved.state, reserved.reservationId).state;
    assert.equal(turns.reserveAction(state, { actionTypes: ["attack"], requiresCheck: false }).ok, false);
    reserved = turns.reserveAction(state, { actionTypes: ["move"], requiresCheck: false });
    assert.equal(reserved.slot, "waterExtraAction");
    assert.equal(turns.commitReservation(reserved.state, reserved.reservationId).ok, true);
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
