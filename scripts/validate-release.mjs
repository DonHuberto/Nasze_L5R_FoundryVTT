import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "system", "system.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const failures = [];
const requireFile = (relative, source) => {
    const clean = String(relative).replace(/^\.\//, "").split(/[?#]/)[0];
    if (!fs.existsSync(path.join(root, "system", clean))) failures.push(`${source}: missing system/${clean}`);
};

for (const key of ["esmodules", "scripts", "styles"]) {
    for (const entry of manifest[key] ?? []) requireFile(entry, key);
}
for (const language of manifest.languages ?? []) requireFile(language.path, "languages");
for (const pack of manifest.packs ?? []) requireFile(pack.path, `pack ${pack.name}`);

const stable = `https://github.com/DonHuberto/Nasze_L5R_FoundryVTT/releases/latest/download/system.json`;
if (manifest.manifest !== stable) failures.push(`manifest must be the stable latest URL: ${stable}`);
const tag = `v${manifest.version}`;
const expectedDownload = `https://github.com/DonHuberto/Nasze_L5R_FoundryVTT/releases/download/${tag}/system.zip`;
if (manifest.download !== expectedDownload) failures.push(`download must be ${expectedDownload}`);
if (!manifest.changelog?.includes("/CHANGELOG.md")) failures.push("manifest changelog must be public");
if (!manifest.documentTypes?.Actor || !manifest.documentTypes?.Item) failures.push("V14 documentTypes are required");
if (fs.existsSync(path.join(root, "system", "template.json"))) failures.push("deprecated system/template.json must not ship");

const sourceFiles = [];
const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(absolute);
        else if (/\.(?:js|hbs|html)$/.test(entry.name)) sourceFiles.push(absolute);
    }
};
walk(path.join(root, "system"));
const assetPattern = /systems\/l5r5e\/([A-Za-z0-9_./-]+\.(?:hbs|html|css|js|svg|webp|png))/g;
for (const file of sourceFiles) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(assetPattern)) requireFile(match[1], path.relative(root, file));
    for (const match of text.matchAll(/<[^>]+\bclass="([^"]+)"[^>]*>/g)) {
        const tagText = match[0];
        const classes = match[1].split(/\s+/);
        if (!classes.includes("dice-picker") && !classes.includes("dice-picker-tech")) continue;
        if (!/^<button\b/i.test(tagText) && !( /\brole="button"/.test(tagText) && /\btabindex="0"/.test(tagText))) {
            failures.push(`${path.relative(root, file)}: roll control lacks button semantics: ${tagText.slice(0, 100)}`);
        }
    }
}

if (failures.length) {
    console.error(failures.map((failure) => `- ${failure}`).join("\n"));
    process.exit(1);
}
console.log(`Release contract and local-link/UI audit passed for l5r5e ${manifest.version}.`);
