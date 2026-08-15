import test from "node:test";
import assert from "node:assert/strict";
import { ResolutionTransactionService } from "../system/scripts/services/resolution-transaction-service.js";
import { GmAuthorityService } from "../system/scripts/services/gm-authority-service.js";
import { MigrationL5r5e } from "../system/scripts/migration.js";
import { canReplayActionCommit, isActionCommitMutation, withoutActionCommitMutation } from "../system/scripts/gm/resolution-tools.js";
import { readFileSync } from "node:fs";

test("transaction apply is idempotent and replay keeps revisions", async () => {
    const document = { uuid: "Actor.A", system: { fatigue: { value: 1 } } };
    const service = new ResolutionTransactionService({ resolver: async () => document });
    const first = service.create({ transactionId: "tx", mutations: [{ documentUuid: document.uuid, path: "system.fatigue.value", before: 1, after: 3, reason: "damage" }] });
    assert.equal((await service.apply(first)).ok, true);
    assert.equal((await service.apply(first)).idempotent, true);
    const replay = await service.replay(first, { mutations: [{ documentUuid: document.uuid, path: "system.fatigue.value", before: 1, after: 4, reason: "newTargetOrTn" }] });
    assert.equal(replay.ok, true);
    assert.equal(document.system.fatigue.value, 4);
    assert.deepEqual(service.history("tx").map(({ revision, status }) => [revision, status]), [[1, "superseded"], [2, "applied"]]);
});

test("transaction refuses rollback after unrelated document change", async () => {
    const document = { uuid: "Actor.A", system: { fatigue: { value: 1 } } };
    const service = new ResolutionTransactionService({ resolver: async () => document });
    const transaction = service.create({ mutations: [{ documentUuid: document.uuid, path: "system.fatigue.value", before: 1, after: 3, reason: "damage" }] });
    await service.apply(transaction);
    document.system.fatigue.value = 5;
    const result = await service.revert(transaction);
    assert.equal(result.ok, false);
    assert.equal(result.code, "revertConflict");
    assert.equal(document.system.fatigue.value, 5);
});

test("retrospective replay can omit a stale action commitment from an earlier turn", () => {
    const actionCommit = { documentUuid: "Combat.C.Combatant.A", path: "flags.l5r5e.turnState", before: { primaryAction: { used: false } }, after: { primaryAction: { used: true } }, reason: "actionCommit" };
    const damage = { documentUuid: "Actor.B", path: "system.fatigue.value", before: 1, after: 4, reason: "damage" };
    const transaction = { transactionId: "roll-1", revision: 1, mutations: [actionCommit, damage] };
    assert.equal(isActionCommitMutation(actionCommit), true);
    assert.equal(isActionCommitMutation(damage), false);
    assert.equal(canReplayActionCommit(actionCommit, { primaryAction: { used: true } }), true);
    assert.equal(canReplayActionCommit(actionCommit, { primaryAction: { used: false } }), false);
    assert.equal(canReplayActionCommit({ ...actionCommit, after: { b: 2, a: 1 } }, { a: 1, b: 2 }), true);
    const replayable = withoutActionCommitMutation(transaction);
    assert.deepEqual(replayable.mutations, [damage]);
    assert.notEqual(replayable, transaction);
});

test("transaction coalesces independent changes to the same resource and pending-effect list", () => {
    const pending = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const service = new ResolutionTransactionService();
    const transaction = service.create({ mutations: [
        { documentUuid: "Actor.A", path: "system.fatigue.value", before: 1, after: 3, reason: "damage" },
        { documentUuid: "Actor.A", path: "system.fatigue.value", before: 1, after: 2, reason: "bleeding" },
        { documentUuid: "Actor.A", path: "flags.l5r5e.pendingRuleEffects", before: pending, after: pending.slice(1), reason: "consumeA" },
        { documentUuid: "Actor.A", path: "flags.l5r5e.pendingRuleEffects", before: pending, after: [pending[0], pending[2]], reason: "consumeB" },
    ] });
    assert.equal(transaction.mutations.length, 2);
    assert.equal(transaction.mutations[0].after, 4);
    assert.deepEqual(transaction.mutations[1].after, [{ id: "c" }]);
});

test("exactly one active GM is authoritative and duplicate requests execute once", async () => {
    const users = [{ id: "b", active: true, isGM: true }, { id: "a", active: true, isGM: true }, { id: "p", active: true, isGM: false }];
    const service = new GmAuthorityService({ users });
    assert.equal(service.authorityUser().id, "a");
    let executions = 0;
    const request = service.request("damage", {}, { requestId: "same" });
    const handler = async () => ++executions;
    const [one, two] = await Promise.all([service.execute(request, handler), service.execute(request, handler)]);
    assert.equal(one.result, 1);
    assert.equal(two.result, 1);
    assert.equal(executions, 1);
});

test("automation migration uses stable property IDs and normalizes Prepared", () => {
    assert.equal(MigrationL5r5e._rulesKeyForProperty({ id: "L5RCorePro000015", name: "Localized" }), "durable");
    assert.equal(MigrationL5r5e._rulesKeyForProperty({ name: "Razor Edged" }), "razor-edged");
    assert.equal(MigrationL5r5e._migrateActorData({ type: "character", system: { prepared: "false" } }, { force: true })["system.prepared"], false);
    assert.equal(MigrationL5r5e._migrateActorData({ type: "character", system: {} }, { force: true })["system.prepared"], true);
    const weapon = MigrationL5r5e._migrateItemData({ type: "weapon", name: "Practice Sword", system: { range: "1", properties: [] } }, { force: true });
    assert.equal(weapon["system.rulesKey"], "practice-sword");
    assert.equal(weapon["system.damage_type"], "physical");
    assert.equal(weapon["system.grip_profiles"]["one-handed"].range_max, 1);
});

test("new English and Polish automation localization keys have parity", () => {
    const en = JSON.parse(readFileSync("system/lang/en-en.json", "utf8")).l5r5e.automation;
    const pl = JSON.parse(readFileSync("system/lang/pl-pl.json", "utf8")).l5r5e.automation;
    const paths = (object, prefix = "") => Object.entries(object).flatMap(([key, value]) => value && typeof value === "object" ? paths(value, `${prefix}${key}.`) : [`${prefix}${key}`]);
    assert.deepEqual(paths(pl).sort(), paths(en).sort());
});

test("transaction-created embedded scars are idempotent and reverted with their parent transaction", async () => {
    const documents = new Map();
    const parent = {
        uuid: "Actor.A",
        async createEmbeddedDocuments(name, [data]) {
            const document = { id: data._id, uuid: `${this.uuid}.${name}.${data._id}`, parent: this };
            documents.set(document.uuid, document);
            return [document];
        },
        async deleteEmbeddedDocuments(name, [id]) { documents.delete(`${this.uuid}.${name}.${id}`); },
    };
    documents.set(parent.uuid, parent);
    const service = new ResolutionTransactionService({ resolver: async (uuid) => documents.get(uuid) });
    const transaction = service.create({ transactionId: "scar", createdDocuments: [{ parentUuid: parent.uuid, embeddedName: "Item", data: { _id: "scar1", name: "Scar" } }] });
    assert.equal((await service.apply(transaction)).ok, true);
    assert.equal(documents.has("Actor.A.Item.scar1"), true);
    assert.equal((await service.apply(transaction)).idempotent, true);
    assert.equal((await service.revert(transaction)).ok, true);
    assert.equal(documents.has("Actor.A.Item.scar1"), false);
});

test("an edited embedded scar blocks automatic transaction rollback", async () => {
    const documents = new Map();
    const parent = {
        uuid: "Actor.A",
        async createEmbeddedDocuments(name, [data]) {
            const document = { id: data._id, uuid: `${this.uuid}.${name}.${data._id}`, parent: this, data: structuredClone(data), toObject() { return structuredClone(this.data); } };
            documents.set(document.uuid, document);
            return [document];
        },
        async deleteEmbeddedDocuments(name, [id]) { documents.delete(`${this.uuid}.${name}.${id}`); },
    };
    documents.set(parent.uuid, parent);
    const service = new ResolutionTransactionService({ resolver: async (uuid) => documents.get(uuid) });
    const transaction = service.create({ transactionId: "edited-scar", createdDocuments: [{ parentUuid: parent.uuid, embeddedName: "Item", data: { _id: "scar2", name: "Scar" } }] });
    await service.apply(transaction);
    documents.get("Actor.A.Item.scar2").data.name = "Renamed Scar";
    const reverted = await service.revert(transaction);
    assert.equal(reverted.ok, false);
    assert.equal(reverted.code, "revertConflict");
    assert.equal(documents.has("Actor.A.Item.scar2"), true);
});

test("bundled automation packs are valid JSON lines and scars use stable tags", () => {
    const parseLines = (path) => readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map(JSON.parse);
    const opportunities = parseLines("system/packs/core-opportunities.db");
    const adversities = parseLines("system/packs/core-peculiarities-adversities.db");
    assert.equal(new Set(opportunities.map((entry) => entry.system.rulesKey)).size, opportunities.length);
    assert.ok(adversities.some((entry) => (entry.data ?? entry.system).automationTags?.includes("scar")));
    const journal = readFileSync("system/packs/core-journal-opportunities.db", "utf8");
    assert.doesNotMatch(journal, /per {2}spent|equal to {2}spent|for every {3}spent|end of the beginning/);
});
