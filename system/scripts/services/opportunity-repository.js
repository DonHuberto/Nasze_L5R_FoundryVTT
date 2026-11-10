import { deepClone } from "./rule-utils.js";

export class OpportunityRepository {
    constructor({ packId = "l5r5e.core-opportunities", definitions = [] } = {}) {
        this.packId = packId;
        this.definitions = definitions;
        this.cache = null;
    }

    invalidate() {
        this.cache = null;
    }

    async all({ refresh = false } = {}) {
        if (this.cache && !refresh) return deepClone(this.cache);
        const gamePack = globalThis.game?.packs?.get?.(this.packId);
        if (!gamePack) {
            this.cache = deepClone(this.definitions);
            return deepClone(this.cache);
        }
        const documents = await gamePack.getDocuments({ type: "opportunity" });
        const definitions = new Map((this.definitions ?? []).map((definition) => [definition.rulesKey, deepClone(definition)]));
        for (const document of documents) {
            const definition = {
                id: document.id,
                uuid: document.uuid,
                name: document.name,
                img: document.img,
                ...deepClone(document.system),
            };
            if (definition.rulesKey) definitions.set(definition.rulesKey, definition);
        }
        this.cache = [...definitions.values()];
        return deepClone(this.cache);
    }

    async get(rulesKey) {
        return (await this.all()).find((definition) => definition.rulesKey === rulesKey) ?? null;
    }
}
