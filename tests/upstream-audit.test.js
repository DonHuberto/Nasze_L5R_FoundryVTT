import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.Actor = class {};
globalThis.Item = class {};
globalThis.JournalEntry = class {};
globalThis.foundry = {
    utils: { duplicate: structuredClone, diffObject: (_before, after) => after },
    applications: {
        api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (Base) => Base },
        sheets: { ActorSheetV2: class {}, ItemSheetV2: class {} },
        ux: { TextEditor: { implementation: { enrichHTML: async (text) => `enriched:${text}` } } },
        handlebars: { renderTemplate: async (_path, context) => context.data },
    },
};
globalThis.CONFIG = { l5r5e: { skills: new Map([["fitness", "martial"]]), paths: { templates: "" } } };
globalThis.game = { user: {}, i18n: { localize: (key) => key }, l5r5e: {} };

const { ActorL5r5e } = await import("../system/scripts/actor.js");
const { ItemL5r5e } = await import("../system/scripts/item.js");
const { JournalL5r5e } = await import("../system/scripts/journal.js");
const { CharacterGenerator } = await import("../system/scripts/actors/character-generator.js");
const { BaseCharacterSheetL5r5e } = await import("../system/scripts/actors/base-character-sheet.js");
const { GmMonitor } = await import("../system/scripts/gm/gm-monitor.js");
const { HelpersL5r5e } = await import("../system/scripts/helpers.js");
game.l5r5e.HelpersL5r5e = HelpersL5r5e;

test("NPC advancement changes its category; PC advancement changes only its skill, with bounds", async () => {
    for (const type of ["npc", "character"]) {
        const actor = Object.create(ActorL5r5e.prototype);
        actor.type = type;
        actor.system = { skills: type === "npc" ? { martial: 3 } : { martial: { fitness: 3, tactics: 2 } } };
        actor.update = async ({ system }) => { actor.system = system; };
        const advancement = { type: "advancement", system: { advancement_type: "skill", skill: "fitness" } };
        const value = () => type === "npc" ? actor.system.skills.martial : actor.system.skills.martial.fitness;
        await actor._updateActorFromAdvancement(advancement, true);
        assert.equal(value(), 4);
        await actor._updateActorFromAdvancement(advancement, false);
        assert.equal(value(), 3);
        for (let i = 0; i < 12; i++) await actor._updateActorFromAdvancement(advancement, true);
        assert.equal(value(), 9);
        for (let i = 0; i < 12; i++) await actor._updateActorFromAdvancement(advancement, false);
        assert.equal(value(), 0);
        if (type === "character") assert.equal(actor.system.skills.martial.tactics, 2);
    }
});

test("title edits persist full and curriculum XP in the same update, including deletion", async () => {
    const title = Object.create(ItemL5r5e.prototype);
    title.type = "title";
    title.system = { items: new Map() };
    title.sheet = { render: () => {} };
    const updates = [];
    title.update = async (data) => updates.push(data);
    for (const [id, xp, curriculum] of [["a", 3, false], ["b", 4, true]]) {
        title.system.items.set(id, { toObject: () => ({ _id: id, system: { xp_used: xp, in_curriculum: curriculum } }) });
    }
    await title.saveEmbedItems();
    assert.equal(updates.length, 1);
    assert.equal(updates[0]["system.xp_used_total"], 7);
    assert.equal(updates[0]["system.xp_used"], 6);
    title.system.items.clear();
    await title.saveEmbedItems();
    assert.equal(updates[1]["system.xp_used"], 0);
    assert.equal(updates[1]["system.xp_used_total"], 0);
    title.type = "technique";
    await title.saveEmbedItems();
    assert.deepEqual(Object.keys(updates[2]), ["system.items"]);
});

test("journal chat uses visible page ID, filters permissions and safely handles empty entries", async () => {
    const page = (id, sort, visible) => ({ id, sort, isOwner: false,
        testUserPermission: () => visible,
        toObject: () => ({ _id: id, name: id, text: { content: id } }),
    });
    const journal = Object.create(JournalL5r5e.prototype);
    const pages = [page("created-first", 20, true), page("sorted-first", 10, true), page("hidden", 0, false)];
    journal.pages = new Map(pages.map((entry) => [entry.id, entry]));
    // Foundry collections iterate documents, rather than Map entries.
    journal.pages[Symbol.iterator] = function* () { yield* this.values(); };
    journal.sheet = { pageId: "sorted-first", pageIndex: 0 };
    assert.equal(journal.getCurrentPage().id, "sorted-first");
    assert.equal((await journal.renderTextTemplate()).text.content, "enriched:sorted-first");
    journal.sheet.pageId = "hidden";
    assert.equal(await journal.renderTextTemplate(), null);
    journal.sheet.pageId = "deleted";
    assert.equal(journal.getCurrentPage(), null);
    journal.sheet.pageId = null;
    assert.equal(journal.getCurrentPage().id, "sorted-first");
    journal.pages.clear();
    assert.equal(await journal.renderTextTemplate(), null);
});

test("empty PC accepts a school journal while NPC does not", async (t) => {
    const previous = HelpersL5r5e.getDragnDropTargetObject;
    t.after(() => { HelpersL5r5e.getDragnDropTargetObject = previous; });
    HelpersL5r5e.getDragnDropTargetObject = async () => ({ documentName: "JournalEntry", _id: "school", name: "School" });
    for (const type of ["character", "npc"]) {
        const sheet = { isEditable: true, actor: { type, system: { identity: {} }, update: async (data) => { sheet.saved = data; } } };
        await BaseCharacterSheetL5r5e.prototype._onDrop.call(sheet, {});
        assert.equal(Boolean(sheet.saved), type === "character");
        if (sheet.saved) assert.equal(sheet.saved.system.identity.school_curriculum_journal.id, "school");
    }
});

test("journal chat snapshots the page before asynchronous rendering and skips missing pages", async (t) => {
    const previousChat = globalThis.ChatMessage;
    const previousFromUuid = globalThis.fromUuid;
    t.after(() => { globalThis.ChatMessage = previousChat; globalThis.fromUuid = previousFromUuid; });
    globalThis.fromUuid = async () => ({ id: "first" });
    const messages = [];
    globalThis.ChatMessage = { create: async (message) => messages.push(message) };
    let selected = { id: "first", link: "@UUID[JournalEntry.test.JournalEntryPage.first]{First}" };
    const journal = {
        documentName: "JournalEntry",
        getCurrentPage: () => selected,
        renderTextTemplate: async (page) => {
            selected = null;
            return `<p>${page.id}</p>`;
        },
    };
    await HelpersL5r5e.sendToChat(journal);
    assert.equal(messages.length, 1);
    selected = { id: "missing", link: "@UUID[JournalEntry.deleted]{Deleted}" };
    globalThis.fromUuid = async () => null;
    await HelpersL5r5e.sendToChat(journal);
    assert.equal(messages.length, 2);
    assert.doesNotMatch(messages[1].content, /@UUID/);
    assert.match(messages[0].content, /first/);
    assert.doesNotMatch(messages[0].content, /undefined/);
    await HelpersL5r5e.sendToChat(journal);
    assert.equal(messages.length, 2);
});

test("generator draws identity once and shares age and marital status with notes", async (t) => {
    const originalAge = CharacterGenerator.genAge;
    const originalStatus = CharacterGenerator.genMaritalStatus;
    const originalName = CharacterGenerator.getRandomizedFirstname;
    t.after(() => { CharacterGenerator.genAge = originalAge; CharacterGenerator.genMaritalStatus = originalStatus; CharacterGenerator.getRandomizedFirstname = originalName; });
    let ages = 0;
    let statuses = 0;
    CharacterGenerator.genAge = () => { ages++; return 24; };
    CharacterGenerator.genMaritalStatus = () => { statuses++; return "unmarried"; };
    CharacterGenerator.getRandomizedFirstname = async () => "Akira";
    const generator = Object.create(CharacterGenerator.prototype);
    generator.data = { avgRingsValue: 3, family: "", clan: "ronin", gender: "male" };
    const actor = { type: "npc", name: "Old", img: "custom.webp", system: { identity: {} } };
    const result = await generator.toActor(actor, { name: true, identity: true });
    assert.deepEqual(actor.system.identity, {}, "generation must not mutate the live DataModel before Actor.update");
    assert.equal(ages, 1);
    assert.equal(statuses, 1);
    assert.equal(result.system.identity.age, 24);
    assert.equal(result.system.identity.marital_status, "unmarried");
    assert.match(result.system.notes, /^<p>.*: 24<\/p>/);
    assert.match(result.system.notes, /social.marital_status.unmarried/);
    assert.equal(result.name, "Akira");
});

test("GM monitor sizes to content and has translated keys for both 20Q variants", () => {
    assert.equal(GmMonitor.DEFAULT_OPTIONS.position.width, "auto");
    assert.equal(GmMonitor.DEFAULT_OPTIONS.position.height, "auto");
    const template = fs.readFileSync(new URL("../system/templates/gm/monitor/tooltips/global.html", import.meta.url), "utf8");
    const translations = JSON.parse(fs.readFileSync(new URL("../system/lang/en-en.json", import.meta.url), "utf8"));
    const keys = [...template.matchAll(/\{\{localize \(concat '(l5r5e\.twenty_questions\.[^']+)' suffix\)\}\}/g)].map((match) => match[1]);
    assert.equal(keys.length, 3);
    for (const suffix of ["", "_pow"]) {
        for (const key of keys) {
            const translation = `${key}${suffix}`.split(".").reduce((value, part) => value?.[part], translations);
            assert.equal(typeof translation, "string", `missing translation: ${key}${suffix}`);
        }
    }
});

test("generator reads V14 TableResult names without the deprecated text accessor", async (t) => {
    const original = HelpersL5r5e.drawManyFromPack;
    t.after(() => { HelpersL5r5e.drawManyFromPack = original; });
    HelpersL5r5e.drawManyFromPack = async () => ({ results: [{ name: "Akira", get text() { throw new Error("deprecated accessor"); } }] });
    assert.equal(await CharacterGenerator.getRandomizedFirstname(false, "ronin"), "Akira");
    HelpersL5r5e.drawManyFromPack = async () => ({ results: [] });
    assert.equal(await CharacterGenerator.getRandomizedFirstname(false, "ronin"), "");
});

test("sheet weapon Strikes use TN 2 while ordinary skills preserve the configured default", (t) => {
    const priorDollar = globalThis.$;
    const priorPicker = game.l5r5e.DicePickerDialog;
    const priorUser = game.user;
    t.after(() => { globalThis.$ = priorDollar; game.l5r5e.DicePickerDialog = priorPicker; game.user = priorUser; });
    const opened = [];
    game.user = { isGM: true };
    game.l5r5e.DicePickerDialog = class { constructor(options) { opened.push(options); } render() {} };
    globalThis.$ = element => ({ data: key => element[key] });
    const sheet = Object.create(BaseCharacterSheetL5r5e.prototype);
    Object.defineProperty(sheet, "actor", { value: { uuid: "Actor.P" } });
    sheet._getWeaponInfos = id => id ? { uuid: "Actor.P.Item.Katana", skill: "melee", attackProfile: { damage: 4 } } : null;
    const event = currentTarget => ({ currentTarget, preventDefault() {}, stopPropagation() {} });
    sheet._openDicePickerForSkill(event({ "weapon-id": "katana" }));
    sheet._openDicePickerForSkill(event({ skill: "fitness" }));
    assert.equal(opened[0].difficulty, 2);
    assert.equal(opened[0].actionId, "strike");
    assert.deepEqual(opened[0].actions, { attack: true });
    assert.equal(opened[1].difficulty, undefined);
    assert.equal(opened[1].actionId, null);
});
