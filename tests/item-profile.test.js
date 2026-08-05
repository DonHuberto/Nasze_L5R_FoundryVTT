import assert from "node:assert/strict";
import test from "node:test";

globalThis.Item = class {
    get uuid() {
        return "Item.Weapon";
    }
};
globalThis.game = {
    actors: { get: () => null },
    l5r5e: { qualities: { usage: () => ({ usable: true }) } },
};

const { ItemL5r5e } = await import("../system/scripts/item.js");

test("ItemL5r5e attackProfile reads a legacy range when grip fields contain DataModel defaults", () => {
    const weapon = Object.create(ItemL5r5e.prototype);
    weapon.type = "weapon";
    weapon.system = {
        active_grip: "two-handed",
        grip_profiles: { "two-handed": { hands: 2, range_min: 0, range_max: 0 } },
        range: "1-2",
        damage: 6,
        deadliness: 7,
        damage_type: "physical",
    };

    assert.deepEqual(weapon.attackProfile.range, { minimum: 1, maximum: 2 });
});
