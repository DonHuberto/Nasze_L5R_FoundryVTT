import test from "node:test";
import assert from "node:assert/strict";

globalThis.foundry = { applications: {
    api: { ApplicationV2: class { async close() {} }, HandlebarsApplicationMixin: Base => Base },
    sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} },
} };
const { RollnKeepDialog } = await import("../system/scripts/dice/roll-n-keep-dialog.js");

function dialog(data = {}) {
    const app = Object.create(RollnKeepDialog.prototype);
    app.roll = { l5r5e: { stance: "void", rnkEnded: true, provisionalLegality: { legal: false }, ...data } };
    Object.defineProperty(app, "isOwner", { value: true });
    Object.defineProperty(app, "isEditable", { value: true });
    return app;
}

test("cancel provisional Void releases the existing action and equipment reservations, deletes its message once", async () => {
    const app = dialog({ actionReservation: { combatantUuid: "Combat.C.Combatant.P", reservationId: "R", lifecycle: { round: 1 } }, rollContext: { equipmentIntentId: "throw" } });
    let actionCancels = 0, equipmentCancels = 0, deletes = 0;
    app._opportunityWindows = new Map();
    app._message = { isOwner: true, delete: async () => { deletes++; } };
    globalThis.fromUuid = async () => ({ uuid: "Combat.C.Combatant.P" });
    globalThis.game = { i18n: { localize: key => key }, l5r5e: {
        actions: { cancel: async (_combatant, id) => { assert.equal(id, "R"); actionCancels++; } },
        equipment: { cancel: async ({ intentId }) => { assert.equal(intentId, "throw"); equipmentCancels++; } },
    } };
    globalThis.ui = { notifications: { info() {} } };
    assert.equal(await app._cancelProvisionalCheck(), true);
    assert.equal(await app._cancelProvisionalCheck(), false);
    assert.deepEqual([actionCancels, equipmentCancels, deletes], [1, 1, 1]);
});

test("legal, non-Void and already-applied checks cannot use provisional cancellation", async () => {
    for (const data of [{ stance: "fire" }, { rnkEnded: false }, { provisionalLegality: { legal: true } }, { resolution: { transaction: {} } }]) {
        assert.equal(await dialog(data)._cancelProvisionalCheck(), false);
    }
});

test("final dice with insufficient Opportunity abandon the impossible check before sending a result", async () => {
    const app = dialog({ rnkEnded: false, summary: { opportunity: 1 } });
    app.object = { currentStep: 0 };
    app._forceChoiceForDiceWithoutOne = () => {};
    app._applyChoices = async () => {};
    app._rebuildRoll = async () => { app.roll.l5r5e.rnkEnded = true; };
    let cancelled = false;
    app._cancelProvisionalCheck = async () => { cancelled = true; };
    app._toChatMessage = () => { throw new Error("Impossible result must not be published"); };
    await app._updateObject({}, {});
    assert.equal(cancelled, true);
});

test("editing a committed Opportunity plan replays the original transaction instead of committing its reservation twice", async () => {
    const app = dialog({ resolution: { transaction: { transactionId: "old" } } });
    const committed = { transaction: { transactionId: "old" } };
    app._message = { id: "M", flags: { l5r5e: { resolution: committed } } };
    app.object = { opportunitySpend: { "strike-critical": 0 }, availableOpportunities: [] };
    app._resolvedOpportunityDecisions = () => ({});
    let closed = false, received;
    app.close = async () => { closed = true; };
    globalThis.game = { user: { isGM: true }, l5r5e: {
        rollResolution: { resolve: () => { throw new Error("Must use authoritative replay"); } },
        ResolutionToolsL5r5e: { replay: async (message, changes) => {
            received = { message, changes };
            return { status: "applied" };
        } },
    } };
    await app._updateObject({}, {});
    assert.equal(received.message, app.message);
    assert.deepEqual(received.changes, { opportunityPlan: [], decisions: {} });
    assert.equal(closed, true);
    closed = false;
    game.user.isGM = false;
    assert.equal(await app._updateObject({}, {}), false);
    assert.equal(closed, false);
});
