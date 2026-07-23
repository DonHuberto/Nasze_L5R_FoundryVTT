import { readFile, readdir, writeFile } from "node:fs/promises";

const slug = (value) => String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function rewriteJsonLines(path, transform) {
    const source = await readFile(path, "utf8");
    const trailingNewline = source.endsWith("\n");
    const documents = source.split(/\r?\n/).filter(Boolean).map((line) => transform(JSON.parse(line)));
    await writeFile(path, `${documents.map((document) => JSON.stringify(document)).join("\n")}${trailingNewline ? "\n" : ""}`, "utf8");
}

await rewriteJsonLines("system/packs/core-peculiarities-adversities.db", (document) => {
    const system = document.system ?? document.data ?? {};
    system.automationTags = /(?:^|,\s*)Scar(?:,|$)/i.test(system.types ?? "") ? ["scar"] : [];
    return document;
});

const propertyDocuments = (await readFile("system/packs/core-properties.db", "utf8")).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const propertyKeys = new Map(propertyDocuments.map((document) => [document._id, (document.system ?? document.data)?.rulesKey]).filter(([, rulesKey]) => rulesKey));
const twoHandedOnly = new Set(["008", "010", "012", "016", "017", "023", "024", "025", "026", "027", "028", "029", "030", "031", "046", "049", "051", "066", "072", "074", "078", "080", "081", "083", "089", "090", "094", "107", "108", "109", "110", "112"] .map((suffix) => `L5RCoreWea000${suffix}`));
const gripOverrides = {
    L5RCoreWea000001: { two: { damage_modifier: 2 } },
    L5RCoreWea000006: { two: { deadliness_modifier: 1 } },
    L5RCoreWea000007: { two: { deadliness_modifier: 2 } },
    L5RCoreWea000009: { two: { deadliness_modifier: 2 } },
    L5RCoreWea000011: { two: { deadliness_modifier: 2 } },
    L5RCoreWea000013: { two: { damage_modifier: 1 } },
    L5RCoreWea000015: { two: { damage_modifier: 2 } },
    L5RCoreWea000019: { two: { deadliness_modifier: 2 } },
    L5RCoreWea000022: { one: { range_min: 1, range_max: 1 }, two: { damage_modifier: 2 } },
    L5RCoreWea000033: { two: { range_min: 2, range_max: 3 } },
    L5RCoreWea000039: { two: { deadliness_modifier: 1 } },
    L5RCoreWea000041: { two: { damage_modifier: 3 } },
    L5RCoreWea000043: { two: { damage_modifier: 1 } },
    L5RCoreWea000045: { two: { damage_modifier: 1 } },
    L5RCoreWea000047: { two: { deadliness_modifier: 1 } },
    L5RCoreWea000048: { two: { deadliness_modifier: 1 } },
    L5RCoreWea000056: { two: { damage_modifier: 2, deadliness_modifier: 1 } },
    L5RCoreWea000058: { two: { damage_modifier: 2 } },
    L5RCoreWea000060: { two: { damage_modifier: 1, deadliness_modifier: 1 } },
    L5RCoreWea000062: { two: { deadliness_modifier: 3 } },
    L5RCoreWea000063: { two: { damage_modifier: 2, deadliness_modifier: 2, range_min: 1, range_max: 2 } },
    L5RCoreWea000065: { two: { damage_modifier: 1, deadliness_modifier: 3 } },
    L5RCoreWea000069: { two: { damage_modifier: 4 } },
    L5RCoreWea000070: { two: { damage_modifier: 2 } },
    L5RCoreWea000075: { two: { deadliness_modifier: 2 } },
    L5RCoreWea000091: { two: { damage_modifier: 2, deadliness_modifier: 2 } },
    L5RCoreWea000092: { two: { deadliness_modifier: 3 } },
    L5RCoreWea000098: { two: { deadliness_modifier: 1 } },
    L5RCoreWea000100: { two: { deadliness_modifier: 1 } },
    L5RCoreWea000103: { two: { deadliness_modifier: 1 } },
    L5RCoreWea000104: { two: { deadliness_modifier: 2 } },
    L5RCoreWea000105: { two: { deadliness_modifier: 2 } },
};
const rangeProfile = (range) => {
    const [minimum, maximum = minimum] = String(range ?? "0").split("-").map((value) => Number(value) || 0);
    return { range_min: minimum, range_max: maximum };
};
await rewriteJsonLines("system/packs/core-weapons.db", (document) => {
    const system = document.system ?? document.data ?? {};
    const baseRange = rangeProfile(system.range);
    const override = gripOverrides[document._id] ?? {};
    system.rulesKey ??= slug(document.name);
    system.damage_type ??= "physical";
    system.active_grip = twoHandedOnly.has(document._id) ? "two-handed" : "one-handed";
    system.grip_profiles = {
        "one-handed": { label: system.grip_1 ?? "", damage_modifier: 0, deadliness_modifier: 0, skill_id: system.skill, hands: 1, ...baseRange, ...(override.one ?? {}) },
        "two-handed": { label: system.grip_2 ?? "", damage_modifier: 0, deadliness_modifier: 0, skill_id: system.skill, hands: 2, ...baseRange, ...(override.two ?? {}) },
    };
    if (document._id === "L5RCoreWea000035") {
        system.skill = "melee";
        system.grip_profiles["one-handed"] = { ...system.grip_profiles["one-handed"], label: "Melee", skill_id: "melee", hands: 1, range_min: 0, range_max: 0 };
        system.grip_profiles["two-handed"] = { ...system.grip_profiles["two-handed"], skill_id: "melee", hands: 2 };
        system.grip_profiles.thrown = { label: "Thrown", damage_modifier: 0, deadliness_modifier: 0, skill_id: "ranged", hands: 1, range_min: 1, range_max: 3 };
    }
    system.properties = (system.properties ?? []).map((property) => ({ ...property, rulesKey: property.rulesKey ?? propertyKeys.get(property.id ?? property._id) }));
    return document;
});

const techniquePacks = (await readdir("system/packs")).filter((name) => /^core-techniques-.+\.db$/.test(name));
for (const pack of techniquePacks) {
    await rewriteJsonLines(`system/packs/${pack}`, (document) => {
        const system = document.system ?? document.data ?? {};
        system.rulesKey ??= slug(document.name);
        system.activation ??= {
            requires_check: Boolean(system.skill || system.difficulty),
            action_types: [],
            target: { mode: "none", filters: {} },
            range: { minimum: 0, maximum: 0 },
            movement: { mode: "none", bands: 0, multiplier: 1 },
            opportunity_rules_keys: [],
        };
        if (document._id === "L5RCoreKat000009") {
            system.rulesKey = "soaring-slice";
            system.activation = {
                requires_check: true,
                action_types: ["attack"],
                action_id: "soaring-slice",
                target: { mode: "single", filters: { range: { minimum: 2, maximum: 3 } } },
                range: { minimum: 2, maximum: 3 },
                movement: { mode: "none", bands: 0, multiplier: 1 },
                weapon: { required: true, quantity: 1, readied: true, grip: "one-handed", skill_mode: "active-profile" },
                outcome: { damage: "active-profile-plus-bonus-successes", defended: "ground-range-1-from-target", critical: "embedded-in-target", failure: "maximum-range-toward-target" },
                opportunity_rules_keys: ["soaring-slice-range"],
            };
        }
        return document;
    });
}

await rewriteJsonLines("system/packs/core-journal-opportunities.db", (document) => {
    document.content = String(document.content ?? "")
        .replaceAll("per  spent this way", "per (op) spent this way")
        .replaceAll("lower than or equal to  spent this way", "lower than or equal to (op) spent this way")
        .replaceAll("for every   spent", "for every (op) spent")
        .replaceAll("until the end of the beginning of your next turn", "until the beginning of your next turn");
    return document;
});

console.log("Normalized stable scar tags and confirmed Opportunity journal typos.");
