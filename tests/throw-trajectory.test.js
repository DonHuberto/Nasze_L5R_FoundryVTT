import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = {
    applications: {
        api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (Base) => Base },
        sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} },
    },
};
const { RollnKeepDialog } = await import("../system/scripts/dice/roll-n-keep-dialog.js");

function setup({ targetX, collisionAt = () => false } = {}) {
    const scene = { id: "S", grid: null, tokens: [], dimensions: { rect: { contains: (x, y) => x >= 0 && x <= 600 && y >= -300 && y <= 300 } } };
    const token = (id, actorId, x) => ({
        id,
        documentName: "Token",
        actorId,
        x,
        y: 0,
        elevation: 0,
        parent: scene,
        getOccupiedGridSpaceOffsets: () => [{ i: x / 100, j: 0 }],
    });
    const source = token("source", "attacker", 0);
    const target = token("target", "defender", targetX);
    scene.tokens = [source, target];
    scene.grid = {
        size: 100,
        getOffset: ({ x, y }) => ({ i: Math.round(x / 100), j: Math.round(y / 100) }),
    };
    globalThis.canvas = {
        scene,
        grid: {
            size: 100,
            measureDistance: (from, to) => Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) / 100,
        },
        tokens: { controlled: [], placeables: [] },
    };
    globalThis.CONFIG = { Canvas: { polygonBackends: { move: { testCollision: async (_from, to) => collisionAt(to) } } } };
    globalThis.game = {
        combat: { combatants: [] },
        settings: { get: () => ({ ranges: { 0: { start: 0 }, 1: { start: 1 }, 2: { start: 2 }, 3: { start: 3 }, 4: { start: 6 } } }) },
    };
    globalThis.fromUuid = async (uuid) => uuid === "Scene.S.Token.target" ? target : null;
    const actor = { id: "attacker", uuid: "Actor.attacker", getActiveTokens: () => [source] };
    const targetActor = { id: "defender", uuid: "Actor.defender", getActiveTokens: () => [target] };
    const app = Object.create(RollnKeepDialog.prototype);
    app.roll = { l5r5e: { rollContext: { equipmentIntentId: "throw", targetTokenUuid: "Scene.S.Token.target", throwMode: "soaring-slice" } } };
    return { app, actor, targetActor };
}

const missResolution = { effective: { success: false }, effects: { action: { damage: { critical: { required: false } } } } };

test("Soaring Slice miss places a Range 2 throw two movement steps beyond the target and filters occupied or walled fields", async () => {
    const { app, actor, targetActor } = setup({ targetX: 200, collisionAt: (to) => to.x === 450 && to.y === 50 });
    const result = await app._prepareThrowOutcome(missResolution, actor, targetActor);
    assert.equal(result.ok, true);
    assert.equal(result.outcome.missLandingFields.length, 6, JSON.stringify(result.outcome.missLandingFields));
    for (const field of result.outcome.missLandingFields) {
        const dx = Math.abs(field.x / 100 - 2);
        const dy = Math.abs(field.y / 100);
        assert.equal(dx + dy, 2, "a diagonal cell costs two movement steps");
        assert.notDeepEqual({ x: field.x, y: field.y }, { x: 0, y: 0 }, "the source token's occupied field is excluded");
        assert.notDeepEqual({ x: field.x, y: field.y }, { x: 400, y: 0 }, "the wall-blocked field is excluded");
    }
});

test("Soaring Slice miss lands one movement step beyond a Range 3 target", async () => {
    const { app, actor, targetActor } = setup({ targetX: 300 });
    const result = await app._prepareThrowOutcome(missResolution, actor, targetActor);
    assert.equal(result.ok, true);
    assert.equal(result.outcome.missLandingFields.length, 4);
    for (const field of result.outcome.missLandingFields) {
        const dx = Math.abs(field.x / 100 - 3);
        const dy = Math.abs(field.y / 100);
        assert.equal(dx + dy, 1);
    }
});
