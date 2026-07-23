import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.foundry ??= { abstract: { TypeDataModel: class {} } };
const { ACTOR_DEFAULTS } = await import("../system/scripts/data-models/actors/models.js");
const { ITEM_DEFAULTS } = await import("../system/scripts/data-models/items/models.js");
const { migrateLegacySource } = await import("../system/scripts/data-models/schema.js");

const manifest = JSON.parse(fs.readFileSync(new URL("../system/system.json", import.meta.url), "utf8"));
const fixtures = JSON.parse(fs.readFileSync(new URL("./fixtures/legacy-documents.json", import.meta.url), "utf8"));

test("all legacy Actor and Item types have V14 documentTypes and DataModel defaults", () => {
    assert.deepEqual(Object.keys(ACTOR_DEFAULTS).sort(), ["army", "character", "npc"]);
    assert.deepEqual(Object.keys(manifest.documentTypes.Actor).sort(), Object.keys(ACTOR_DEFAULTS).sort());
    assert.deepEqual(Object.keys(manifest.documentTypes.Item).sort(), Object.keys(ITEM_DEFAULTS).sort());
    assert.equal(ACTOR_DEFAULTS.character.identity.school_rank, 1);
    assert.equal(ACTOR_DEFAULTS.npc.type, "adversary");
    assert.equal(ACTOR_DEFAULTS.army.battle_readiness.casualties_strength.value, 0);
    assert.equal(ITEM_DEFAULTS.weapon.grip_profiles["two-handed"].hands, 2);
    assert.equal(ITEM_DEFAULTS.opportunity.cost.base, 1);
    assert.equal(ITEM_DEFAULTS.technique.activation.requires_check, true);
});

test("legacy document migration retains known values and archives unknown top-level data", () => {
    const actor = migrateLegacySource(fixtures.actor.system, ACTOR_DEFAULTS.character);
    assert.equal(actor.identity.school_rank, 3);
    assert.deepEqual(actor._legacy.homebrew_field, { keep: true });
    const item = migrateLegacySource(fixtures.item.system, ITEM_DEFAULTS.weapon);
    assert.equal(item.damage, 7);
    assert.equal(item._legacy.third_party, "preserve me");
});

test("manifest identifies every actually edited HTML field", () => {
    assert.ok(manifest.documentTypes.Actor.character.htmlFields.includes("description"));
    assert.ok(manifest.documentTypes.Actor.army.htmlFields.includes("army_abilities"));
    assert.ok(manifest.documentTypes.Item.army_cohort.htmlFields.includes("abilities"));
    assert.ok(Object.values(manifest.documentTypes.Item).every(({ htmlFields }) => htmlFields.includes("description")));
});
