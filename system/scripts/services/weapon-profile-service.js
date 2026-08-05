function nonNegativeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

export function legacyWeaponRangeBounds(value) {
    if (value && typeof value === "object") {
        const minimum = nonNegativeNumber(value.minimum ?? value.min ?? value.range_min, 0);
        const maximum = Math.max(minimum, nonNegativeNumber(value.maximum ?? value.max ?? value.range_max, minimum));
        return { minimum, maximum };
    }

    const parts = String(value ?? "")
        .trim()
        .split(/\s*(?:-|–|—|to)\s*/iu)
        .filter(Boolean);
    const minimum = parts.length > 1 ? nonNegativeNumber(parts[0], 0) : 0;
    const maximum = nonNegativeNumber(parts.at(-1), minimum);
    return { minimum: Math.min(minimum, maximum), maximum: Math.max(minimum, maximum) };
}

export function weaponRangeBounds(grip = {}, legacyRange = 0) {
    const minimum = nonNegativeNumber(grip.range_min ?? grip.rangeMin, 0);
    const maximum = Math.max(minimum, nonNegativeNumber(grip.range_max ?? grip.rangeMax, minimum));
    const legacy = legacyWeaponRangeBounds(legacyRange);

    // Foundry's DataModel supplies 0/0 defaults for pre-profile weapons. In that
    // case the original range field remains the authoritative value.
    if (minimum === 0 && maximum === 0 && legacy.maximum > 0) return legacy;
    return { minimum, maximum };
}
