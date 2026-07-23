const clone = (value) => globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));

export function mergeDefaults(...sources) {
    const result = {};
    const merge = (target, source) => {
        for (const [key, value] of Object.entries(source)) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                target[key] = merge(target[key] && typeof target[key] === "object" ? target[key] : {}, value);
            } else target[key] = clone(value);
        }
        return target;
    };
    for (const source of sources) merge(result, source);
    return result;
}

export function schemaFromDefaults(defaults, htmlFields = []) {
    const fields = foundry.data.fields;
    const html = new Set(htmlFields);
    const build = (value, path) => {
        if (html.has(path)) return new fields.HTMLField({ required: true, nullable: false, initial: value ?? "" });
        if (Array.isArray(value)) {
            return new fields.ArrayField(new fields.AnyField({ serializable: true }), {
                required: true,
                nullable: false,
                initial: () => clone(value),
            });
        }
        if (value === null) return new fields.AnyField({ serializable: true, required: false, nullable: true, initial: null });
        if (typeof value === "boolean") return new fields.BooleanField({ required: true, nullable: false, initial: value });
        if (typeof value === "number") return new fields.NumberField({ required: true, nullable: false, initial: value });
        if (typeof value === "string") return new fields.StringField({ required: true, nullable: false, initial: value });
        if (value && typeof value === "object") {
            const entries = Object.entries(value);
            if (!entries.length) return new fields.AnyField({ serializable: true, required: true, nullable: false, initial: () => ({}) });
            return new fields.SchemaField(Object.fromEntries(entries.map(([key, child]) => [key, build(child, path ? `${path}.${key}` : key)])));
        }
        return new fields.AnyField({ serializable: true });
    };
    return {
        ...Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, build(value, key)])),
        _legacy: new fields.AnyField({ serializable: true, required: true, nullable: false, initial: () => ({}) }),
    };
}

export function migrateLegacySource(source = {}, defaults = {}) {
    const migrated = clone(source);
    const legacy = clone(migrated._legacy ?? {});
    for (const [key, value] of Object.entries(migrated)) {
        if (!(key in defaults) && key !== "_legacy") legacy[key] = clone(value);
    }
    migrated._legacy = legacy;
    return migrated;
}

export function createSystemDataModel(defaults, htmlFields = []) {
    return class extends foundry.abstract.TypeDataModel {
        static defineSchema() {
            return schemaFromDefaults(defaults, htmlFields);
        }

        static migrateData(source = {}) {
            return super.migrateData(migrateLegacySource(source, defaults));
        }
    };
}
