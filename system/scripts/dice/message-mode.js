const MESSAGE_MODE_ALIASES = Object.freeze({
    publicroll: "public",
    selfroll: "self",
    gmroll: "gm",
    blindroll: "blind",
});

const V14_MESSAGE_MODES = Object.freeze(["public", "self", "gm", "blind"]);

function canonicalMode(value) {
    if (typeof value !== "string") return null;
    const mode = value.trim().toLowerCase();
    return MESSAGE_MODE_ALIASES[mode] ?? mode;
}

function availableModeKeys(modes) {
    if (modes instanceof Map) return [...modes.keys()];
    if (modes && typeof modes.keys === "function") return [...modes.keys()];
    if (modes && typeof modes === "object") return Object.keys(modes);
    return [...V14_MESSAGE_MODES];
}

/**
 * Normalize legacy roll-mode aliases and guarantee a key accepted by Foundry VTT 14.
 *
 * @param {string|null} value Requested message mode.
 * @param {object} options Normalization options.
 * @param {object|Map|null} options.modes Available CONFIG.ChatMessage.modes.
 * @param {string|null} options.fallbackMode Client-configured fallback mode.
 * @param {Function} options.warn Controlled warning sink.
 * @returns {string}
 */
export function normalizeMessageMode(value, { modes = globalThis.CONFIG?.ChatMessage?.modes, fallbackMode = null, warn = console.warn } = {}) {
    const available = availableModeKeys(modes);
    const allowed = new Set(available.length ? available : V14_MESSAGE_MODES);
    const requested = canonicalMode(value);
    if (requested && allowed.has(requested)) return requested;

    const configuredFallback = canonicalMode(fallbackMode);
    const fallback = (configuredFallback && allowed.has(configuredFallback) && configuredFallback) || (allowed.has("public") && "public") || available[0] || "public";
    if (requested) warn?.(`L5R5E | Unsupported chat message mode "${value}"; using "${fallback}".`);
    return fallback;
}

/** Resolve the V14 top-level option while retaining the legacy nested option. */
export function resolveInitiativeMessageMode({ messageMode = null, messageOptions = {} } = {}) {
    return messageMode ?? messageOptions?.messageMode ?? null;
}

export { MESSAGE_MODE_ALIASES };
