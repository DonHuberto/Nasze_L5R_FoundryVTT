import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { CORE_OPPORTUNITIES } from "../system/scripts/data/core-opportunities.js";

const stableId = (rulesKey) => `L5R${createHash("sha1").update(rulesKey).digest("hex").slice(0, 13)}`;
const documents = CORE_OPPORTUNITIES.map((definition, index) => ({
    _id: stableId(definition.rulesKey),
    name: definition.name,
    type: "opportunity",
    img: "systems/l5r5e/assets/icons/social.svg",
    system: definition,
    effects: [],
    folder: null,
    sort: (index + 1) * 1000,
    ownership: { default: 0 },
    flags: {},
}));

if (new Set(documents.map((document) => document._id)).size !== documents.length) throw new Error("Stable Opportunity ID collision");
if (new Set(documents.map((document) => document.system.rulesKey)).size !== documents.length) throw new Error("Duplicate Opportunity rulesKey");
await writeFile("system/packs/core-opportunities.db", `${documents.map((document) => JSON.stringify(document)).join("\n")}\n`, "utf8");
console.log(`Built ${documents.length} native Opportunity documents.`);
