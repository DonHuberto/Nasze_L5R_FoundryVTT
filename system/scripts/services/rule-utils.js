export const RINGS = Object.freeze(["air", "earth", "fire", "water", "void"]);
export const ACTION_TYPES = Object.freeze(["attack", "scheme", "move", "support"]);

export function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}
export function clamp(value, minimum, maximum = Number.POSITIVE_INFINITY) {
    return Math.min(maximum, Math.max(minimum, toFiniteNumber(value, minimum)));
}

export function clampCheckTn(value, { isCheck = true, maximum = 99 } = {}) {
    return clamp(Math.round(toFiniteNumber(value, isCheck ? 1 : 0)), isCheck ? 1 : 0, maximum);
}

export function uniqueStrings(values = []) {
    const source = Array.isArray(values) ? values : String(values ?? "").split(/[\s,]+/);
    return [...new Set(source.map((value) => String(value ?? "").trim().toLowerCase()).filter(Boolean))];
}

export function normalizeActionTypes(values = []) {
    return uniqueStrings(values)
        .map((value) => (value === "movement" || value === "maneuver" || value === "dash" ? "move" : value))
        .filter((value) => ACTION_TYPES.includes(value));
}

export function actionState(values = []) {
    const selected = new Set(normalizeActionTypes(values));
    return Object.fromEntries(ACTION_TYPES.map((type) => [type, selected.has(type)]));
}

export function inferActionTypes(source = {}) {
    const system = source?.system ?? source ?? {};
    const candidates = [
        source?.actionTypes,
        source?.actions,
        system.actionTypes,
        system.action_types,
        system.activation?.actionTypes,
        system.activation?.action_types,
        system.roll?.actionTypes,
    ];
    for (const candidate of candidates) {
        const normalized = normalizeActionTypes(candidate);
        if (normalized.length) return normalized;
    }
    return [];
}

export function getActorKind(actor = {}) {
    const documentType = actor?.type;
    if (documentType !== "npc") return documentType === "character" ? "character" : documentType ?? "unknown";
    const npcType = String(actor?.system?.type ?? "adversary").toLowerCase();
    return npcType === "minion" ? "minion" : "adversary";
}

export function isNpcKind(actor, kind) {
    return actor?.type === "npc" && getActorKind(actor) === kind;
}

export function getProperty(object, path) {
    if (!path) return object;
    return String(path).split(".").reduce((value, key) => value?.[key], object);
}

export function setProperty(object, path, value) {
    const parts = String(path).split(".");
    const last = parts.pop();
    const target = parts.reduce((current, key) => {
        if (!current[key] || typeof current[key] !== "object") current[key] = {};
        return current[key];
    }, object);
    target[last] = value;
    return object;
}

export function deepClone(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === "function") {
        try {
            return structuredClone(value);
        } catch (_error) {
            // Foundry Documents cannot be structured-cloned; serialized DTOs can.
        }
    }
    return JSON.parse(JSON.stringify(value));
}

export function makeId(prefix = "l5r5e") {
    const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${random}`;
}

export function documentUuid(document) {
    return document?.uuid ?? document?.document?.uuid ?? null;
}

export function stableHash(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}
