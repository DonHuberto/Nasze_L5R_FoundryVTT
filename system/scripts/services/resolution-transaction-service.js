import { deepClone, getProperty, makeId, setProperty } from "./rule-utils.js";

function equal(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function applyDelta(base, before, after) {
    if (equal(before, after)) return deepClone(base);
    if ([base, before, after].every((value) => typeof value === "number")) return base + after - before;
    if ([base, before, after].every(Array.isArray)) {
        const key = (value) => JSON.stringify(value);
        const removed = new Set(before.filter((value) => !after.some((candidate) => key(candidate) === key(value))).map(key));
        const added = after.filter((value) => !before.some((candidate) => key(candidate) === key(value)));
        const result = base.filter((value) => !removed.has(key(value))).map(deepClone);
        for (const value of added) if (!result.some((candidate) => key(candidate) === key(value))) result.push(deepClone(value));
        return result;
    }
    if ([base, before, after].every(isPlainObject)) {
        const result = deepClone(base);
        for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
            if (equal(before[key], after[key])) continue;
            if (!(key in after)) delete result[key];
            else if (key in before && key in result) result[key] = applyDelta(result[key], before[key], after[key]);
            else result[key] = deepClone(after[key]);
        }
        return result;
    }
    return deepClone(after);
}

export function coalesceMutations(mutations = []) {
    const result = [];
    const indexed = new Map();
    for (const source of mutations) {
        const mutation = deepClone(source);
        const key = `${mutation.documentUuid}:${mutation.path}`;
        const previous = indexed.get(key);
        if (!previous) {
            indexed.set(key, mutation);
            result.push(mutation);
            continue;
        }
        previous.after = equal(previous.after, mutation.before) ? deepClone(mutation.after) : applyDelta(previous.after, mutation.before, mutation.after);
        previous.reason = [previous.reason, mutation.reason].filter(Boolean).join(",");
        previous.options = { ...(previous.options ?? {}), ...(mutation.options ?? {}) };
    }
    return result;
}

export class ResolutionTransactionService {
    constructor({ resolver = null } = {}) {
        this.resolver = resolver ?? ((uuid) => globalThis.fromUuid?.(uuid));
        this.transactions = new Map();
        this.revisions = new Map();
    }

    create({ transactionId = makeId("resolution"), revision = 1, rollMessageUuid = null, inputs = {}, decisions = {}, mutations = [], createdDocuments = [], createdDocumentUuids = [] } = {}) {
        return { transactionId, revision, rollMessageUuid, inputs: deepClone(inputs), decisions: deepClone(decisions), mutations: coalesceMutations(mutations), createdDocuments: deepClone(createdDocuments), createdDocumentUuids: [...createdDocumentUuids], status: "applied" };
    }

    async #document(uuid) {
        return await this.resolver(uuid);
    }

    async #read(document, path) {
        if (path.startsWith("statuses.")) return Boolean(document?.statuses?.has?.(path.slice("statuses.".length)));
        if (typeof document?.getFlag === "function" && path.startsWith("flags.")) return getProperty(document, path);
        return deepClone(getProperty(document, path));
    }

    async #write(document, path, value, options = {}) {
        if (path.startsWith("statuses.") && typeof document?.toggleStatusEffect === "function") {
            return document.toggleStatusEffect(path.slice("statuses.".length), { active: Boolean(value), ...options });
        }
        if (typeof document?.update === "function") return document.update({ [path]: deepClone(value) }, options);
        return setProperty(document, path, deepClone(value));
    }

    async apply(transaction) {
        transaction.createdDocumentUuids ??= [];
        const existing = this.transactions.get(transaction.transactionId);
        if (existing?.revision === transaction.revision && existing.status === "applied") return { ok: true, idempotent: true, transaction: existing };
        for (const mutation of transaction.mutations) {
            const document = await this.#document(mutation.documentUuid);
            if (!document) return { ok: false, code: "documentMissing", mutation };
            const current = await this.#read(document, mutation.path);
            if (equal(current, mutation.after)) continue;
            if (!equal(current, mutation.before)) return { ok: false, code: "applyConflict", mutation, expected: mutation.before, actual: current };
        }
        for (const creation of transaction.createdDocuments ?? []) {
            const parent = await this.#document(creation.parentUuid);
            if (!parent?.createEmbeddedDocuments) return { ok: false, code: "creationParentMissing", creation };
        }
        for (const mutation of transaction.mutations) {
            const document = await this.#document(mutation.documentUuid);
            const current = await this.#read(document, mutation.path);
            if (!equal(current, mutation.after)) await this.#write(document, mutation.path, mutation.after, mutation.options);
        }
        for (const creation of transaction.createdDocuments ?? []) {
            const parent = await this.#document(creation.parentUuid);
            if (!parent?.createEmbeddedDocuments) return { ok: false, code: "creationParentMissing", creation };
            const id = creation.data?._id;
            const expectedUuid = id ? `${parent.uuid}.${creation.embeddedName}.${id}` : null;
            let document = expectedUuid ? await this.#document(expectedUuid) : null;
            if (!document) [document] = await parent.createEmbeddedDocuments(creation.embeddedName, [deepClone(creation.data)], { keepId: Boolean(id) });
            creation.createdUuid = document.uuid;
            creation.createdSnapshot = deepClone(document.toObject?.() ?? creation.data);
            if (!transaction.createdDocumentUuids.includes(document.uuid)) transaction.createdDocumentUuids.push(document.uuid);
        }
        transaction.status = "applied";
        this.transactions.set(transaction.transactionId, deepClone(transaction));
        this.#record(transaction);
        return { ok: true, transaction };
    }

    async revert(transaction) {
        if (transaction.status === "reverted") return { ok: true, idempotent: true, transaction };
        const inspection = await this.inspectRevert(transaction);
        if (!inspection.ok) {
            transaction.status = "conflict";
            return { ...inspection, transaction };
        }
        for (const creation of [...(transaction.createdDocuments ?? [])].reverse()) {
            const uuid = creation.createdUuid ?? (transaction.createdDocumentUuids ?? []).find((entry) => entry.endsWith(`.${creation.data?._id}`));
            const document = uuid ? await this.#document(uuid) : null;
            if (!document) continue;
            const parent = document.parent ?? await this.#document(creation.parentUuid);
            if (!parent?.deleteEmbeddedDocuments) return { ok: false, code: "creationDeleteConflict", creation };
            await parent.deleteEmbeddedDocuments(creation.embeddedName, [document.id]);
        }
        for (const mutation of [...transaction.mutations].reverse()) {
            await this.#write(await this.#document(mutation.documentUuid), mutation.path, mutation.before, mutation.options);
        }
        transaction.status = "reverted";
        this.transactions.set(transaction.transactionId, deepClone(transaction));
        this.#record(transaction);
        return { ok: true, transaction };
    }

    async inspectRevert(transaction) {
        const conflicts = [];
        for (const creation of transaction.createdDocuments ?? []) {
            const uuid = creation.createdUuid ?? (transaction.createdDocumentUuids ?? []).find((entry) => entry.endsWith(`.${creation.data?._id}`));
            const document = uuid ? await this.#document(uuid) : null;
            if (!document) continue;
            const current = deepClone(document.toObject?.() ?? creation.data);
            if (creation.createdSnapshot && !equal(current, creation.createdSnapshot)) conflicts.push({ creation, actual: current });
        }
        for (const mutation of [...transaction.mutations].reverse()) {
            const document = await this.#document(mutation.documentUuid);
            const current = document ? await this.#read(document, mutation.path) : undefined;
            if (!document || !equal(current, mutation.after)) conflicts.push({ mutation, actual: current });
        }
        if (conflicts.length) {
            return { ok: false, code: "revertConflict", conflicts };
        }
        return { ok: true };
    }

    async replay(previous, { inputs = previous.inputs, decisions = previous.decisions, mutations = [], createdDocuments = previous.createdDocuments ?? [] } = {}) {
        const reverted = await this.revert(previous);
        if (!reverted.ok) return reverted;
        const next = this.create({
            transactionId: previous.transactionId,
            revision: previous.revision + 1,
            rollMessageUuid: previous.rollMessageUuid,
            inputs,
            decisions,
            mutations,
            createdDocuments,
        });
        const applied = await this.apply(next);
        if (!applied.ok) return applied;
        previous.status = "superseded";
        this.#record(previous);
        return { ok: true, previous, transaction: next };
    }

    history(transactionId) {
        return deepClone(this.revisions.get(transactionId) ?? []);
    }

    #record(transaction) {
        const history = this.revisions.get(transaction.transactionId) ?? [];
        const index = history.findIndex((entry) => entry.revision === transaction.revision);
        if (index >= 0) history[index] = deepClone(transaction);
        else history.push(deepClone(transaction));
        history.sort((a, b) => a.revision - b.revision);
        this.revisions.set(transaction.transactionId, history);
    }
}
