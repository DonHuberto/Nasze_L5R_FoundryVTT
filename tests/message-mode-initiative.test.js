import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMessageMode, resolveInitiativeMessageMode } from "../system/scripts/dice/message-mode.js";
import { InitiativeService } from "../system/scripts/services/initiative-service.js";

const V14_MODES = { public: {}, self: {}, gm: {}, blind: {} };

test("message modes normalize V14 keys and all legacy aliases", () => {
    for (const mode of Object.keys(V14_MODES)) assert.equal(normalizeMessageMode(mode, { modes: V14_MODES }), mode);
    assert.equal(normalizeMessageMode("publicroll", { modes: V14_MODES }), "public");
    assert.equal(normalizeMessageMode("selfroll", { modes: V14_MODES }), "self");
    assert.equal(normalizeMessageMode("gmroll", { modes: V14_MODES }), "gm");
    assert.equal(normalizeMessageMode("blindroll", { modes: V14_MODES }), "blind");
});

test("unknown message mode uses a valid client fallback and warns once", () => {
    const warnings = [];
    assert.equal(normalizeMessageMode("mystery", { modes: V14_MODES, fallbackMode: "gmroll", warn: (message) => warnings.push(message) }), "gm");
    assert.equal(warnings.length, 1);
    assert.equal(normalizeMessageMode("mystery", { modes: V14_MODES, fallbackMode: "also-mystery", warn: () => {} }), "public");
});

test("top-level initiative message mode takes precedence over the compatible nested option", () => {
    assert.equal(resolveInitiativeMessageMode({ messageMode: "self", messageOptions: { messageMode: "gm" } }), "self");
    assert.equal(resolveInitiativeMessageMode({ messageOptions: { messageMode: "blind" } }), "blind");
});

test("rollAdversary performs an integrated blind initiative resolution", async (t) => {
    const originalGame = globalThis.game;
    const originalHooks = globalThis.Hooks;
    t.after(() => {
        globalThis.game = originalGame;
        globalThis.Hooks = originalHooks;
    });

    class RingDie {}
    const seenModes = [];
    class MockRoll {
        constructor(formula) {
            this.formula = formula;
            const term = new RingDie();
            term.results = [{ result: 0 }];
            this.terms = [term];
            this.l5r5e = { summary: {}, dicesTypes: { l5r: true } };
        }
        async evaluate() { return this; }
        async toMessage(_data, { messageMode }) {
            seenModes.push(messageMode);
            return { uuid: "ChatMessage.adversary", async update() {}, async delete() {} };
        }
        toJSON() { return { formula: this.formula }; }
        async render() { return "<div>initiative</div>"; }
    }

    globalThis.Hooks = { callAll() {} };
    globalThis.game = {
        i18n: { localize: (key) => key },
        l5r5e: {
            RingDie: { FACES: [{ success: 1 }] },
            RollL5r5e: MockRoll,
            rollResolution: {
                async resolve({ context, keptDice }) {
                    return { transactionId: "initiative-tx", revision: 1, context, raw: { keptDice }, effective: { success: true, bonusSuccesses: 0 } };
                },
                async buildMutations() { return []; },
            },
            transactions: {
                create: (data) => ({ ...data, status: "applied" }),
                async apply(transaction) { return { ok: true, transaction }; },
                async revert(transaction) { return { ok: true, transaction }; },
            },
        },
    };

    const actor = {
        uuid: "Actor.adversary",
        system: {
            prepared: true,
            focus: 3,
            vigilance: 2,
            rings: { fire: 1, water: 0, earth: 0, air: 0, void: 0 },
            skills: { martial: 0 },
            composure: 10,
            strife: { value: 0 },
        },
    };
    const result = await new InitiativeService().rollAdversary(actor, { skillId: "tactics", skillGroup: "martial" });
    assert.equal(seenModes[0], "blind");
    assert.equal(result.initiative, 4);
    assert.equal(result.resolution.status, "applied");
});
