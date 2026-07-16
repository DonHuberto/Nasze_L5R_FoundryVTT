import assert from "node:assert/strict";
import test from "node:test";
import { LateArrivalService } from "../system/scripts/services/late-arrival-service.js";

class FakeCollection {
    constructor(entries = []) {
        this.entries = entries;
    }

    get size() {
        return this.entries.length;
    }

    get(id) {
        return this.entries.find((entry) => entry.id === id);
    }

    [Symbol.iterator]() {
        return this.entries[Symbol.iterator]();
    }
}

function harness({ conflictType = "skirmish", authority = true, count = 1, automatedInitiative = null } = {}) {
    const settings = new Map([
        ["initiative-encounter", conflictType],
        ["initiative-difficulty-value", 1],
    ]);
    const game = {
        user: { id: "gm" },
        settings: { get: (_scope, key) => settings.get(key) },
        i18n: { localize: (key) => key },
    };
    const calls = [];
    const combat = {
        started: true,
        round: 2,
        combatants: null,
        async rollInitiative(ids, options) {
            calls.push({ ids, options });
            const target = this.combatants.get(ids[0]);
            if (automatedInitiative !== null) target.initiative = automatedInitiative;
            return this;
        },
    };
    const updates = [];
    const combatant = {
        id: "late",
        parent: combat,
        initiative: null,
        roundJoined: 2,
        flags: { l5r5e: {} },
        async update(change) {
            updates.push(structuredClone(change));
            const lateArrival = change["flags.l5r5e.lateArrival"];
            if (lateArrival) this.flags.l5r5e.lateArrival = structuredClone(lateArrival);
        },
        async delete() {
            this.deleted = true;
        },
    };
    const fillers = Array.from({ length: Math.max(0, count - 1) }, (_, index) => ({ id: `existing-${index}` }));
    combat.combatants = new FakeCollection([...fillers, combatant]);
    const service = new LateArrivalService({ authorityService: { isAuthority: () => authority }, gameProvider: () => game });
    return { service, combat, combatant, calls, updates, settings, game };
}

test("skirmish arrival waits until the next round then requests TN 2 Tactics once", async () => {
    const { service, combat, combatant, calls, updates } = harness({ conflictType: "skirmish", automatedInitiative: 6 });
    await service.onCreate(combatant);
    assert.equal(calls.length, 0);
    assert.equal(combatant.flags.l5r5e.lateArrival.eligibleRound, 3);
    assert.equal(combatant.flags.l5r5e.lateArrival.skillId, "tactics");
    assert.equal(combatant.flags.l5r5e.lateArrival.tn, 2);
    assert.equal(combatant.roundJoined, 2);
    assert.equal(updates.some((change) => "roundJoined" in change), false);
    await service.onCombatUpdate(combat, { round: 3 });
    await service.onCombatUpdate(combat, { round: 3 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.messageOptions.difficulty, 2);
    assert.equal(calls[0].options.messageOptions.difficultyHidden, true);
    assert.equal(combatant.flags.l5r5e.lateArrival.state, "resolved");
});

test("mass battle uses Command TN 2 and delegates the actual initiative to core", async () => {
    const { service, combat, combatant, calls } = harness({ conflictType: "mass_battle" });
    await service.onCreate(combatant);
    await service.resolveEligible(combat, 3);
    assert.equal(calls[0].options.messageOptions.skillId, "command");
    assert.equal(calls[0].options.messageOptions.difficulty, 2);
    assert.equal(combatant.flags.l5r5e.lateArrival.state, "awaitingRoll");
});

test("intrigue requests the configured normal test immediately", async () => {
    const { service, combatant, calls, settings } = harness({ conflictType: "intrigue" });
    settings.set("initiative-difficulty-value", 3);
    await service.onCreate(combatant);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.messageOptions.skillId, "sentiment");
    assert.equal(calls[0].options.messageOptions.difficulty, 3);
});

test("an active duel rejects a third participant before creation and removes a batch race", async () => {
    const { service, combat, combatant, game } = harness({ conflictType: "duel", count: 2 });
    globalThis.ui = { notifications: { warn: () => {} } };
    assert.equal(service.preCreate({ parent: combat }, {}, {}, game.user.id), false);
    combat.combatants = new FakeCollection([{ id: "one" }, { id: "two" }, combatant]);
    await service.onCreate(combatant);
    assert.equal(combatant.deleted, true);
});

test("non-authority clients never mark or roll late arrivals", async () => {
    const { service, combatant, calls, updates } = harness({ authority: false });
    await service.onCreate(combatant);
    assert.equal(calls.length, 0);
    assert.equal(updates.length, 0);
});

test("a completed player picker update resolves persistent state without rerolling", async () => {
    const { service, combatant, calls } = harness({ conflictType: "intrigue" });
    await service.onCreate(combatant);
    assert.equal(combatant.flags.l5r5e.lateArrival.state, "awaitingRoll");
    combatant.initiative = 0;
    await service.onCombatantUpdate(combatant, { initiative: 0 });
    assert.equal(combatant.flags.l5r5e.lateArrival.state, "resolved");
    assert.equal(calls.length, 1);
});
