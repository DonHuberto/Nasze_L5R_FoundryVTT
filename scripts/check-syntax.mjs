import { readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { spawnSync } from "node:child_process";

function files(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? files(path) : extname(path) === ".js" || extname(path) === ".mjs" ? [path] : [];
    });
}
const targets = ["system/scripts", "tests", "scripts"].flatMap(files);
const failed = [];
for (const target of targets) {
    const result = spawnSync(process.execPath, ["--check", target], { stdio: "inherit" });
    if (result.status !== 0) failed.push(target);
}
if (failed.length) {
    console.error(`Syntax check failed for ${failed.length} file(s).`);
    process.exitCode = 1;
} else {
    console.log(`Syntax check passed for ${targets.length} file(s).`);
}
