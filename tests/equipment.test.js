import test from "node:test";
import assert from "node:assert/strict";
import { deterministicLandingField, EquipmentService, sanitizeItemSnapshot } from "../system/scripts/services/equipment-service.js";
import { ResolutionTransactionService } from "../system/scripts/services/resolution-transaction-service.js";
import { setProperty } from "../system/scripts/services/rule-utils.js";

function fixture({ quantity = 1 } = {}) {
    const documents = new Map();
    const scene = {
        id: "S",
        uuid: "Scene.S",
        grid: { size: 100 },
        tiles: [],
        async createEmbeddedDocuments(_type, entries) {
            return entries.map((data, index) => {
                const tile = { ...structuredClone(data), id: `T${this.tiles.length + index}`, parent: this };
                tile.uuid = `${this.uuid}.Tile.${tile.id}`;
                this.tiles.push(tile);
                documents.set(tile.uuid, tile);
                return tile;
            });
        },
        async deleteEmbeddedDocuments(_type, ids) {
            for (const id of ids) {
                const tile = this.tiles.find((entry) => entry.id === id);
                if (tile) documents.delete(tile.uuid);
            }
            this.tiles = this.tiles.filter((entry) => !ids.includes(entry.id));
        },
    };
    const actor = {
        id: "A",
        uuid: "Actor.A",
        items: [],
        flags: {},
        getActiveTokens: () => [{ document: { x: 200, y: 300, elevation: 0 } }],
        async deleteEmbeddedDocuments(_type, ids) {
            for (const id of ids) {
                const item = this.items.find((entry) => entry.id === id);
                if (item) documents.delete(item.uuid);
            }
            this.items = this.items.filter((entry) => !ids.includes(entry.id));
        },
        async createEmbeddedDocuments(_type, entries) {
            return entries.map((data) => makeItem(data, this, documents));
        },
    };
    const makeItem = (data, parent = actor, registry = documents) => {
        const item = {
            id: data._id,
            uuid: `${parent.uuid}.Item.${data._id}`,
            name: data.name,
            type: data.type,
            img: data.img ?? "item.webp",
            system: structuredClone(data.system),
            flags: structuredClone(data.flags ?? {}),
            parent,
            get attackProfile() {
                const grip = this.system.grip_profiles?.[this.system.active_grip] ?? {};
                return { itemUuid: this.uuid, grip: this.system.active_grip, hands: grip.hands ?? (this.system.active_grip === "two-handed" ? 2 : 1), skillId: grip.skill_id ?? this.system.skill, damage: this.system.damage, deadliness: this.system.deadliness, damageType: "physical", range: { minimum: grip.range_min ?? 0, maximum: grip.range_max ?? 0 }, usable: true };
            },
            async update(changes) {
                for (const [path, value] of Object.entries(changes)) setProperty(this, path, structuredClone(value));
                return this;
            },
            toObject() {
                return { _id: this.id, name: this.name, type: this.type, img: this.img, system: structuredClone(this.system), flags: structuredClone(this.flags) };
            },
        };
        parent.items.push(item);
        registry.set(item.uuid, item);
        return item;
    };
    documents.set(actor.uuid, actor);
    documents.set(scene.uuid, scene);
    const weapon = makeItem({
        _id: "W",
        name: "Katana",
        type: "weapon",
        system: { quantity, equipped: true, readied: true, active_grip: "one-handed", skill: "melee", damage: 4, deadliness: 5, grip_profiles: { "one-handed": { hands: 1, range_min: 0, range_max: 1 }, "two-handed": { hands: 2, range_min: 0, range_max: 1 } } },
    });
    const resolver = async (uuid) => documents.get(uuid) ?? null;
    const transactions = new ResolutionTransactionService({ resolver });
    const equipment = new EquipmentService({ transactionService: transactions, resolver, sceneProvider: () => scene, settings: (_key, fallback) => fallback });
    return { actor, documents, equipment, makeItem, scene, transactions, weapon };
}

test("unarmed profiles are virtual, immutable actor options and respect body state", () => {
    const { actor, equipment } = fixture();
    actor.flags.l5r5e = { body: { lostHands: 2, boundLegs: true } };
    const profiles = equipment.getUnarmedProfiles(actor);
    assert.deepEqual(profiles.map(({ id, damage, deadliness, available }) => ({ id, damage, deadliness, available })), [
        { id: "unarmed-punch", damage: 1, deadliness: 2, available: false },
        { id: "unarmed-kick", damage: 2, deadliness: 1, available: false },
        { id: "unarmed-bite", damage: 0, deadliness: 3, available: true },
    ]);
    assert.equal(actor.items.length, 1);
});

test("hand assessment requires explicit, unique release decisions", () => {
    const { actor, equipment, weapon } = fixture();
    weapon.system.active_grip = "two-handed";
    const second = { uuid: "Actor.A.Item.X", type: "weapon", system: { readied: false }, attackProfile: { grip: "one-handed", hands: 1 } };
    const intent = equipment.prepare(actor, second, { ready: true });
    assert.equal(intent.assessment.code, "occupiedHands");
    assert.equal(intent.assessment.hands.deficit, 1);
    assert.equal(equipment.confirm(intent, { releases: [] }).code, "occupiedHandsDecision");
    assert.equal(equipment.confirm(intent, { releases: [{ itemUuid: weapon.uuid, mode: "stow" }, { itemUuid: weapon.uuid, mode: "drop" }] }).code, "occupiedHandsDecision");
    assert.equal(equipment.confirm(intent, { releases: [{ itemUuid: weapon.uuid, mode: "stow" }] }).status, "confirmed");
});

test("weapon-set changes validate hands and commit the entire loadout atomically", async () => {
    const { actor, equipment, makeItem, weapon } = fixture();
    const wakizashi = makeItem({
        _id: "W2",
        name: "Wakizashi",
        type: "weapon",
        system: { quantity: 1, equipped: true, readied: false, active_grip: "one-handed", grip_profiles: { "one-handed": { hands: 1 } } },
    });
    const blockedWeapon = makeItem({
        _id: "W3",
        name: "Nodachi",
        type: "weapon",
        system: { quantity: 1, equipped: true, readied: false, active_grip: "two-handed", grip_profiles: { "two-handed": { hands: 2 } } },
    });

    const blocked = equipment.changeLoadout(actor, [wakizashi, blockedWeapon]);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.assessment.code, "loadoutHandsExceeded");
    assert.equal(weapon.system.readied, true);
    assert.equal(wakizashi.system.readied, false);

    const intent = equipment.changeLoadout(actor, [wakizashi]);
    const committed = await equipment.commit(await equipment.reserve(equipment.confirm(intent)));
    assert.equal(committed.ok, true);
    assert.equal(weapon.system.readied, false);
    assert.equal(wakizashi.system.equipped, true);
    assert.equal(wakizashi.system.readied, true);
    assert.equal(blockedWeapon.system.readied, false);
});

test("armor changes are blocked in conflict unless the world policy overrides them", () => {
    const previousGame = globalThis.game;
    globalThis.game = { combat: { started: true } };
    try {
        const { actor } = fixture();
        const armor = { uuid: "Actor.A.Item.R", type: "armor", system: { equipped: true } };
        const blocked = new EquipmentService({ settings: (_key, fallback) => fallback }).prepare(actor, armor, { ready: false });
        assert.equal(blocked.assessment.code, "armorSwapBlocked");
        const allowed = new EquipmentService({ settings: (key, fallback) => key === "allowArmorSwapInConflict" ? true : fallback }).prepare(actor, armor, { ready: false });
        assert.equal(allowed.assessment.ok, true);
    } finally {
        globalThis.game = previousGame;
    }
});

test("RAW and house-rule throw modes keep distinct action IDs and profile values", () => {
    const { actor, equipment, weapon } = fixture();
    weapon.system.active_grip = "thrown";
    weapon.system.grip_profiles.thrown = { hands: 1, skill_id: "ranged", range_min: 1, range_max: 3 };
    const raw = equipment.throw(actor, weapon);
    assert.equal(raw.options.actionId, "strike");
    assert.equal(raw.assessment.roll.skillId, "ranged");
    assert.deepEqual(raw.assessment.roll.rollContext.attackProfileSnapshot.range, { minimum: 1, maximum: 3 });
    weapon.system.active_grip = "one-handed";
    const houseRule = equipment.throw(actor, weapon, { mode: "improvised" });
    assert.equal(houseRule.options.actionId, "improvised-throw");
    assert.equal(houseRule.assessment.roll.houseRule, true);
    assert.equal(houseRule.assessment.profile.damage, 1);
    assert.notEqual(houseRule.assessment.profile.damage, weapon.system.damage);
});

test("landing field selection is deterministic, legal and excludes the origin", () => {
    const input = { hit: false, originField: { x: 0, y: 0 }, targetField: { x: 3, y: 0 }, pathFields: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], legalFields: [{ x: 1, y: 0 }, { x: 2, y: 0 }], transactionId: "fixed" };
    const first = deterministicLandingField(input);
    assert.deepEqual(deterministicLandingField(input), first);
    assert.notDeepEqual(first.field, input.originField);
    assert.ok(input.legalFields.some((field) => field.x === first.field.x && field.y === first.field.y));
    assert.deepEqual(deterministicLandingField({ ...input, hit: true }).field, input.targetField);
});

test("throw fallback selects a nearest legal field and never the origin", () => {
    const result = deterministicLandingField({
        hit: false,
        originField: { x: 0, y: 0 },
        targetField: { x: 3, y: 0 },
        pathFields: [],
        legalFields: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 2 }, { x: 2, y: 0 }],
        transactionId: "nearest",
    });
    assert.deepEqual(result.field, { x: 2, y: 0 });
    assert.equal(result.fallback, true);
});

test("Soaring Slice uses a chosen Range 1 field, embeds on critical and never randomizes a failure path", () => {
    const { equipment, weapon } = fixture();
    const intent = equipment.throw(weapon.parent, weapon, { mode: "soaring-slice" });
    const targetField = { x: 3, y: 0 };
    assert.equal(equipment.resolveThrowPlacement(intent, { success: true, defended: true, targetField }).code, "directionFieldRequired");
    const defended = equipment.resolveThrowPlacement(intent, { success: true, defended: true, targetField, chosenField: { x: 3, y: 1 }, chosenFieldRangeFromTarget: 1, legalFields: [{ x: 3, y: 1 }] });
    assert.deepEqual(defended.placement, { x: 3, y: 1 });
    assert.equal(defended.audit.rule, "soaring-slice-defended");
    const embedded = equipment.resolveThrowPlacement(intent, { success: true, critical: true, targetField, targetUuid: "Actor.Target", legalFields: [targetField] });
    assert.equal(embedded.state, "embedded");
    assert.equal(embedded.targetUuid, "Actor.Target");
    const failed = equipment.resolveThrowPlacement(intent, { success: false, originField: { x: 0, y: 0 }, pathFields: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], legalFields: [{ x: 1, y: 0 }, { x: 2, y: 0 }] });
    assert.deepEqual(failed.placement, { x: 2, y: 0 });
});

test("drop and pickup preserve stack quantity and are idempotent", async () => {
    const previousGame = globalThis.game;
    globalThis.game = {};
    try {
        const { actor, equipment, scene, weapon } = fixture({ quantity: 2 });
        const drop = await equipment.commit(await equipment.reserve(equipment.confirm(equipment.drop(actor, weapon))));
        assert.equal(drop.ok, true);
        assert.equal(weapon.system.quantity, 1);
        assert.equal(scene.tiles.length, 1);
        const repeated = await equipment.commit({ ...drop, status: "reserved", ok: true });
        assert.equal(repeated.idempotent, true);
        const pickup = await equipment.commit(await equipment.reserve(equipment.confirm(equipment.pickup(actor, scene.tiles[0]))));
        assert.equal(pickup.ok, true);
        assert.equal(weapon.system.quantity, 2);
        assert.equal(scene.tiles.length, 0);
    } finally {
        globalThis.game = previousGame;
    }
});

test("prepare can drop an occupied-hand item atomically and restores it on conflict", async () => {
    const previousGame = globalThis.game;
    globalThis.game = {};
    try {
        const { actor, equipment, makeItem, scene, weapon } = fixture();
        weapon.system.active_grip = "two-handed";
        const target = makeItem({ _id: "N", name: "Knife", type: "weapon", system: { quantity: 1, equipped: false, readied: false, active_grip: "one-handed", skill: "melee", damage: 2, deadliness: 4, grip_profiles: { "one-handed": { hands: 1 } } } });
        const intent = equipment.prepare(actor, target, { ready: true });
        const confirmed = equipment.confirm(intent, { releases: [{ itemUuid: weapon.uuid, mode: "drop" }] });
        const reserved = await equipment.reserve(confirmed);
        target.system.equipped = "changed-by-another-client";
        const result = await equipment.commit(reserved);
        assert.equal(result.ok, false);
        assert.equal(result.code, "applyConflict");
        assert.equal(scene.tiles.length, 0);
        assert.ok(actor.items.some((item) => item.id === weapon.id));
        assert.equal(target.system.readied, false);
    } finally {
        globalThis.game = previousGame;
    }
});

test("ground snapshots omit executable and unrelated actor data", () => {
    const snapshot = sanitizeItemSnapshot({ _id: "I", name: "Safe", type: "item", system: { quantity: 5, macro: "bad", nested: { command: "bad", value: 1 } }, flags: { secret: true }, actor: { name: "Do not copy" } });
    assert.equal(snapshot.system.quantity, 1);
    assert.equal(snapshot.system.macro, undefined);
    assert.deepEqual(snapshot.system.nested, { value: 1 });
    assert.equal(snapshot.flags, undefined);
    assert.equal(snapshot.actor, undefined);
});
