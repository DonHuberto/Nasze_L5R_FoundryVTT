import { deepClone } from "./rule-utils.js";

export const QUALITY_KEYS = Object.freeze(["durable", "damaged", "destroyed", "razor-edged", "cumbersome"]);
const QUALITY_REFERENCES = Object.freeze({
    "razor-edged": { id: "L5RCorePro000001", name: "Razor-Edged", rulesKey: "razor-edged" },
    damaged: { id: "L5RCorePro000003", name: "Damaged", rulesKey: "damaged" },
    destroyed: { id: "L5RCorePro000004", name: "Destroyed", rulesKey: "destroyed" },
    cumbersome: { id: "L5RCorePro000006", name: "Cumbersome", rulesKey: "cumbersome" },
    durable: { id: "L5RCorePro000015", name: "Durable", rulesKey: "durable" },
});

export function qualityKey(quality = {}) {
    const stableIds = { L5RCorePro000001: "razor-edged", L5RCorePro000003: "damaged", L5RCorePro000004: "destroyed", L5RCorePro000006: "cumbersome", L5RCorePro000015: "durable" };
    const id = quality.id ?? quality._id;
    return String(quality.rulesKey ?? quality.system?.rulesKey ?? quality.flags?.l5r5e?.rulesKey ?? stableIds[id] ?? id ?? "").toLowerCase();
}

export class ItemQualityService {
    keys(item) {
        const properties = item?.system?.properties ?? item?.properties ?? [];
        return new Set(properties.map(qualityKey).filter(Boolean));
    }

    has(item, key) {
        return this.keys(item).has(key);
    }

    applyDamage(item, { severity = "damaged", reason = "itemDamage" } = {}) {
        const before = [...this.keys(item)];
        const after = new Set(before);
        const durable = after.has("durable");
        const damaged = after.has("damaged");
        const destroyRequested = severity === "destroyed";

        if (durable && (destroyRequested || damaged)) {
            after.delete("durable");
            after.add("damaged");
        } else if (!destroyRequested && durable && !damaged) {
            after.delete("durable");
        } else if (destroyRequested || damaged) {
            after.delete("damaged");
            after.add("destroyed");
        } else {
            after.add("damaged");
        }
        return { itemUuid: item?.uuid ?? null, before, after: [...after], changed: before.sort().join("|") !== [...after].sort().join("|"), reason };
    }

    usage(item) {
        const keys = this.keys(item);
        return { usable: !keys.has("destroyed"), tnModifier: keys.has("damaged") ? 1 : 0 };
    }

    armorResistance(item) {
        if (this.has(item, "destroyed")) return { physical: 0, supernatural: 0 };
        const damagedPenalty = this.has(item, "damaged") ? 2 : 0;
        return {
            physical: Math.max(0, Number(item?.system?.armor?.physical ?? 0) - damagedPenalty),
            supernatural: Math.max(0, Number(item?.system?.armor?.supernatural ?? 0) - damagedPenalty),
        };
    }

    mutation(item, result) {
        const originals = item?.system?.properties ?? [];
        const byKey = new Map(originals.map((property) => [qualityKey(property), property]));
        const properties = result.after.map((key) => deepClone(byKey.get(key) ?? QUALITY_REFERENCES[key] ?? { rulesKey: key, name: key }));
        return { documentUuid: item?.uuid, path: "system.properties", before: deepClone(originals), after: properties, reason: result.reason };
    }
}
