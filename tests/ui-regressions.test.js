import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("ApplicationV2 Opportunity child uses object render options", async (t) => {
    const previousFoundry = globalThis.foundry;
    t.after(() => { globalThis.foundry = previousFoundry; });
    class ApplicationV2 {
        constructor(options) { this.options = options; }
        get parent() { return "foundry-managed-parent"; }
        render(options) { this.renderOptions = options; return this; }
        close() {}
    }
    globalThis.foundry = {
        applications: {
            api: {
                ApplicationV2,
                HandlebarsApplicationMixin: (Base) => class extends Base {},
            },
        },
    };
    const { OpportunityWindow } = await import(`../system/scripts/dice/opportunity-window.js?test=${Date.now()}`);
    const parent = {
        message: { id: "message-1" },
        render(force) { this.renderForce = force; },
        getOpportunityWindowContext: () => ({}),
    };
    const window = new OpportunityWindow(parent, "reference");
    assert.equal(window.parent, "foundry-managed-parent");
    assert.equal(window.rollParent, parent);
    await window.refreshOpportunityWindow();
    assert.deepEqual(window.renderOptions, { force: true });
    await window.refreshParentRoll();
    assert.equal(parent.renderForce, false);
});

test("GM resolution context menu uses the Foundry V14 visible property", () => {
    const source = fs.readFileSync(new URL("../system/scripts/gm/resolution-tools.js", import.meta.url), "utf8");
    const contextOptions = source.slice(source.indexOf("static contextOptions()"), source.indexOf("static async changeTn"));
    assert.match(contextOptions, /\bvisible\b/);
    assert.doesNotMatch(contextOptions, /\bcondition\b/);
});

test("sheet roll controls remain available outside editable-only listeners and are semantic", () => {
    const source = fs.readFileSync(new URL("../system/scripts/actors/base-character-sheet.js", import.meta.url), "utf8");
    assert.ok(source.indexOf('html.find(".dice-picker").on') < source.indexOf("if (!this.isEditable)"));
    assert.equal(source.includes("event.clientX"), false);
    const characterSkill = fs.readFileSync(new URL("../system/templates/actors/character/skill.html", import.meta.url), "utf8");
    assert.match(characterSkill, /<button type="button" class="dice-picker/);
});

test("GM initiative picker is local even when an active player owns the actor", async (t) => {
    const previousCombat = globalThis.Combat;
    globalThis.Combat = class {};
    t.after(() => { globalThis.Combat = previousCombat; });
    const { canOpenLocalInitiativePicker } = await import(`../system/scripts/combat.js?test=${Date.now()}`);
    const owner = { id: "player", active: true };
    const combatant = {
        actor: { testUserPermission: (user) => user.id === owner.id },
        players: [owner],
    };
    assert.equal(canOpenLocalInitiativePicker({ user: { id: "gm", isGM: true }, combatant }), true);
    assert.equal(canOpenLocalInitiativePicker({ user: owner, combatant }), true);
    assert.equal(canOpenLocalInitiativePicker({ user: { id: "other", isGM: false }, combatant }), false);
});
