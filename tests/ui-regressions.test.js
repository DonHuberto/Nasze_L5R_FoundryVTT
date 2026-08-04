import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

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

test("ApplicationV2 actor sheets render detached data and never submit _id", async (t) => {
    const previousFoundry = globalThis.foundry;
    t.after(() => { globalThis.foundry = previousFoundry; });

    class ApplicationV2 {
        constructor(options) {
            this.options = options;
            this.document = options.document;
            this.element = { querySelector: () => null };
        }
        async _prepareContext() { return { rootId: "sheet-root" }; }
        _configureRenderParts() { return { form: { template: "placeholder" } }; }
        _getHeaderControls() { return []; }
        async _onRender() {}
        render(options) { this.renderOptions = options; return this; }
    }
    class ActorSheetV2 extends ApplicationV2 {
        get actor() { return this.document; }
        get isEditable() { return true; }
    }
    class ItemSheetV2 extends ApplicationV2 {
        get item() { return this.document; }
        get actor() { return this.document?.actor ?? null; }
        get isEditable() { return true; }
    }
    globalThis.foundry = {
        applications: {
            api: {
                ApplicationV2,
                HandlebarsApplicationMixin: (Base) => class extends Base {},
            },
            sheets: { ActorSheetV2, ItemSheetV2 },
        },
        utils: {
            deepClone: (value) => structuredClone(value),
            mergeObject: (left, right) => ({ ...left, ...right }),
            expandObject: (value) => value,
        },
    };

    const { LegacyActorSheetV2 } = await import(`../system/scripts/applications/legacy-v2-application.js?test=${Date.now()}`);
    class TestSheet extends LegacyActorSheetV2 {
        static get defaultOptions() {
            return { ...super.defaultOptions, template: "full-sheet.hbs" };
        }
        get template() { return this.actor.limited ? "limited-sheet.hbs" : "full-sheet.hbs"; }
    }

    let submitted;
    const actor = {
        id: "actor-1",
        limited: true,
        isOwner: true,
        system: { strife: { value: 3 } },
        _source: { _id: "actor-1", system: { strife: { value: 2 } } },
        items: [{
            _source: { _id: "item-1", name: "Katana", system: {} },
            system: {},
            toObject: () => { throw new TypeError("value.map is not a function"); },
        }],
        toObject: () => { throw new TypeError("value.map is not a function"); },
        update: async (data) => { submitted = data; },
    };
    const sheet = new TestSheet({ document: actor });
    const context = await sheet._prepareContext({});
    context.data.system.strife.value = 99;
    assert.equal(actor.system.strife.value, 3);
    assert.equal(context.rootId, "sheet-root");
    assert.equal(context.items[0].name, "Katana");
    assert.equal(sheet._configureRenderParts({}).form.template, "limited-sheet.hbs");

    await sheet._updateObject({}, { _id: "actor-1", "system.strife.value": 4 });
    assert.deepEqual(submitted, { "system.strife.value": 4 });
});

test("GM resolution context menu uses the Foundry V14 label and visible properties", () => {
    const source = fs.readFileSync(new URL("../system/scripts/gm/resolution-tools.js", import.meta.url), "utf8");
    const contextOptions = source.slice(source.indexOf("static contextOptions()"), source.indexOf("static async changeTn"));
    assert.match(contextOptions, /\bvisible\b/);
    assert.match(contextOptions, /\blabel:/);
    assert.match(contextOptions, /\bonClick:/);
    assert.doesNotMatch(contextOptions, /\bname:/);
    assert.doesNotMatch(contextOptions, /\bcallback:/);
    assert.doesNotMatch(contextOptions, /\bcondition\b/);
    assert.match(contextOptions, /onClick:\s*\(_event,\s*entry\)/);
    assert.match(source, /closest\?\.\("\[data-message-id\]"\)/);
    assert.match(source, /notifyMissingResolution/);
});

test("roll context menu uses the Foundry V14 label property", () => {
    const source = fs.readFileSync(new URL("../system/scripts/dice/roll-n-keep-dialog.js", import.meta.url), "utf8");
    const contextMenu = source.slice(source.indexOf("new foundry.applications.ux.ContextMenu"), source.indexOf("// Open journal on effect name"));
    assert.match(contextMenu, /\blabel:/);
    assert.match(contextMenu, /\bonClick:/);
    assert.doesNotMatch(contextMenu, /\bname:/);
    assert.doesNotMatch(contextMenu, /\bcallback:/);
});

test("Opportunity targets include only visible undefeated combatants", async () => {
    const { buildOpportunityTargetChoices } = await import(`../system/scripts/dice/opportunity-targets.js?test=${Date.now()}`);
    const actor = (id, name) => ({ uuid: `Actor.${id}`, name });
    const choices = buildOpportunityTargetChoices({
        combat: {
            combatants: [
                { actor: actor("visible", "Visible"), name: "Visible combatant", hidden: false, isDefeated: false },
                { actor: actor("hidden", "Hidden"), hidden: true, isDefeated: false },
                { actor: actor("token-hidden", "Token hidden"), hidden: false, token: { hidden: true }, isDefeated: false },
                { actor: actor("defeated", "Defeated"), hidden: false, isDefeated: true },
            ],
        },
    });
    assert.deepEqual(choices, [{ value: "Actor.visible", label: "Visible combatant" }]);
});

test("Opportunity rows and disabled finalize controls expose the requested UI structure", () => {
    const opportunity = fs.readFileSync(new URL("../system/templates/dice/opportunity-window.hbs", import.meta.url), "utf8");
    const roll = fs.readFileSync(new URL("../system/templates/dice/roll-n-keep-dialog.html", import.meta.url), "utf8");
    const styles = fs.readFileSync(new URL("../system/styles/scss/dices.scss", import.meta.url), "utf8");
    assert.match(opportunity, /opportunity-entry-grid/);
    assert.match(opportunity, /opportunity-spend-control/);
    assert.match(opportunity, /opportunity-decision-column/);
    assert.match(styles, /grid-template-columns:\s*8rem minmax\(20rem,\s*1\.45fr\) minmax\(14rem,\s*1fr\)/);
    assert.match(styles, /\.opportunity-row[\s\S]*&:nth-child\(odd\)/);
    assert.match(styles, /&\.application\.roll-n-keep-dialog[\s\S]*bg-scroll\.webp/);
    assert.match(styles, /&\.l5r5e-opportunity-window/);
    assert.match(roll, /data-tooltip="{{data\.submitDisabledReason}}"/);
    assert.doesNotMatch(roll, /finalize-disabled-reason/);
    assert.match(roll, /class="restart-roll"/);
    assert.match(roll, /invalid-kept-summary/);
    assert.match(styles, /\.invalid-keep/);
});

test("cancelled and restarted throw checks preserve no orphaned equipment reservations", () => {
    const picker = fs.readFileSync(new URL("../system/scripts/dice/dice-picker-dialog.js", import.meta.url), "utf8");
    const roll = fs.readFileSync(new URL("../system/scripts/dice/roll-n-keep-dialog.js", import.meta.url), "utf8");
    assert.match(picker, /equipmentIntentId[\s\S]*!this\._rollTransferred[\s\S]*equipment\?\.cancel/);
    assert.match(picker, /this\._rollTransferred = true/);
    assert.match(roll, /!this\._preserveEquipmentIntent[\s\S]*equipment\?\.cancel/);
    assert.match(roll, /this\._preserveEquipmentIntent = Boolean/);
});

test("Soaring Slice reserves a real one-handed weapon through the core equipment API", () => {
    const picker = fs.readFileSync(new URL("../system/scripts/dice/dice-picker-dialog.js", import.meta.url), "utf8");
    assert.match(picker, /_prepareSoaringSliceIntent/);
    assert.match(picker, /this\._actionId !== "soaring-slice"/);
    assert.match(picker, /item\.attackProfile\?\.grip === "one-handed"/);
    assert.match(picker, /equipment\.throw\(this\._actor,\s*weapon,\s*\{\s*mode:\s*"soaring-slice"/);
    assert.match(picker, /equipmentIntentId:\s*reserved\.intentId/);
});

test("throw resolution validates scene bounds and walls before commit and asks for Soaring Slice direction", () => {
    const roll = fs.readFileSync(new URL("../system/scripts/dice/roll-n-keep-dialog.js", import.meta.url), "utf8");
    assert.match(roll, /_prepareThrowOutcome/);
    assert.match(roll, /dimensions\?\.rect/);
    assert.match(roll, /polygonBackends\?\.move/);
    assert.match(roll, /soaringSliceDirectionTitle/);
    assert.match(roll, /resolutionDecisions\.throwLanding/);
    assert.match(roll, /completeThrow\(equipmentIntentId,\s*pendingThrow\.outcome\)/);
});

test("all system-owned sheets and roll dialogs use the Foundry V14 ApplicationV2 framework", () => {
    const roots = [
        new URL("../system/scripts/actors", import.meta.url),
        new URL("../system/scripts/items", import.meta.url),
        new URL("../system/scripts/dice", import.meta.url),
        new URL("../system/scripts/applications", import.meta.url),
        new URL("../system/scripts/main-l5r5e.js", import.meta.url),
    ];
    const files = roots.flatMap((root) => {
        const path = fileURLToPath(root);
        if (path.endsWith(".js")) return [path];
        return fs.readdirSync(path, { recursive: true })
            .filter((entry) => String(entry).endsWith(".js"))
            .map((entry) => `${path}/${entry}`);
    });
    const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
    assert.doesNotMatch(source, /foundry\.appv1/);
    assert.doesNotMatch(source, /extends\s+FormApplication/);
    assert.doesNotMatch(source, /foundry\.documents\.collections\.(Actors|Items)\.registerSheet/);
    assert.match(source, /ActorSheetV2/);
    assert.match(source, /ItemSheetV2/);
    assert.match(source, /DocumentSheetConfig/);
});

test("system dialogs use DialogV2 instead of the deprecated V1 Dialog", () => {
    const helpers = fs.readFileSync(new URL("../system/scripts/helpers.js", import.meta.url), "utf8");
    assert.match(helpers, /DialogV2\.confirm/);
    assert.match(helpers, /DialogV2\.prompt/);
    assert.doesNotMatch(helpers, /\bnew\s+Dialog\b/);
    assert.doesNotMatch(helpers, /\bDialog\.prompt\b/);
});

test("Actor instance updates never inject the read-only _id field", () => {
    const source = fs.readFileSync(new URL("../system/scripts/actor.js", import.meta.url), "utf8");
    const method = source.slice(source.indexOf("async update(docData"), source.indexOf("/** @inheritDoc */"));
    assert.match(method, /delete docData\._id/);
    assert.match(method, /super\.update\(docData, context\)/);
    assert.doesNotMatch(method, /Actor\.updateDocuments/);
    assert.doesNotMatch(method, /docData\["_id"\]\s*=/);
});

test("sheet roll controls remain available outside editable-only listeners and are semantic", () => {
    const source = fs.readFileSync(new URL("../system/scripts/actors/base-character-sheet.js", import.meta.url), "utf8");
    assert.ok(source.indexOf('html.find(".dice-picker").on') < source.indexOf("if (!this.isEditable)"));
    assert.match(source, /html\.find\("\.dice-picker"\)\.on\("dblclick"/);
    assert.match(source, /html\.find\("\.dice-picker-tech"\)\.on\("dblclick"/);
    assert.equal(source.includes("event.clientX"), false);
    const characterSkill = fs.readFileSync(new URL("../system/templates/actors/character/skill.html", import.meta.url), "utf8");
    assert.match(characterSkill, /<button type="button" class="dice-picker/);
});

test("legacy V2 dialogs keep domain data out of ApplicationV2 options", () => {
    const source = fs.readFileSync(new URL("../system/scripts/applications/legacy-v2-application.js", import.meta.url), "utf8");
    const v2OptionsSource = source.slice(source.indexOf("function v2Options"), source.indexOf("function activateLegacyTabs"));
    assert.match(v2OptionsSource, /const \{[\s\S]*id,[\s\S]*parts,[\s\S]*document,[\s\S]*\} = options/);
    assert.doesNotMatch(v2OptionsSource, /\.\.\.options,/);
    assert.match(v2OptionsSource, /\.\.\.\(parts \? \{ parts \} : \{\}\)/);
    assert.match(v2OptionsSource, /\.\.\.\(document \? \{ document \} : \{\}\)/);
});

test("ApplicationV2 sheet content owns scrolling and uses a fixed light background", () => {
    const source = fs.readFileSync(new URL("../system/styles/scss/global-appv2.scss", import.meta.url), "utf8");
    const scrollRule = source.match(/\.application\.l5r5e\.sheet\s*>\s*\.window-content\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    assert.match(scrollRule, /overflow-y:\s*auto/);
    assert.match(scrollRule, /min-height:\s*0/);
    assert.doesNotMatch(source, /\.application\.l5r5e\.sheet\s*\{[\s\S]*?> form\s*\{/);
    assert.match(source, /\.application\.l5r5e\.sheet\s*>\s*\.window-content,[\s\S]*\.dice-picker-dialog\s*>\s*\.window-content[\s\S]*#fffae6[\s\S]*bg-scroll\.webp/);
});

test("Roll and Keep exposes a high-contrast ApplicationV2 resize handle", () => {
    const source = fs.readFileSync(new URL("../system/styles/scss/dices.scss", import.meta.url), "utf8");
    const handleRule = source.match(/&\.application\.roll-n-keep-dialog\s*>\s*\.window-resize-handle\s*\{([\s\S]*?)\}/)?.[1] ?? "";
    assert.match(handleRule, /width:\s*1rem/);
    assert.match(handleRule, /height:\s*1rem/);
    assert.match(handleRule, /background-color:/);
    assert.match(handleRule, /border:/);
});

test("ApplicationV2 windows reapply the legacy L5R layout above core form styles", () => {
    const entry = fs.readFileSync(new URL("../system/styles/conf/l5r5e.scss", import.meta.url), "utf8");
    const skills = fs.readFileSync(new URL("../system/styles/scss/skills.scss", import.meta.url), "utf8");
    const sheets = fs.readFileSync(new URL("../system/styles/scss/sheets.scss", import.meta.url), "utf8");
    const items = fs.readFileSync(new URL("../system/styles/scss/items.scss", import.meta.url), "utf8");

    const layeredEnd = entry.lastIndexOf("}", entry.indexOf(".application.l5r5e"));
    assert.ok(layeredEnd >= 0, "the system layer closes before the V2 compatibility rules");
    assert.match(entry.slice(layeredEnd + 1), /\.application\.l5r5e\s*\{[\s\S]*@import "\.\.\/scss\/sheets"/);
    assert.match(entry, /container-type:\s*inline-size/);
    assert.match(entry, /@container \(max-width:\s*44rem\)/);
    assert.match(skills, /\.skill-content\s*\{[\s\S]*display:\s*flex/);
    assert.match(skills, /button\.dice-picker\s*\{[\s\S]*width:\s*auto/);
    assert.match(sheets, /\.narrative-content\s*\{[\s\S]*flex-direction:\s*column/);
    assert.match(sheets, /&-wrapper\s*\{[\s\S]*display:\s*flex[\s\S]*justify-content:\s*center/);
    assert.match(items, /\.item-properties\s*\{[\s\S]*flex-wrap:\s*wrap/);
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
