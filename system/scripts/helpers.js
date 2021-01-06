import { ItemL5r5e } from "./item.js";

/**
 * Extends the actor to process special things from L5R.
 */
export class HelpersL5r5e {
    /**
     * Get Rings/Element for List / Select
     */
    static getRingsList(actor = null) {
        return CONFIG.l5r5e.stances.map((e) => ({
            id: e,
            label: game.i18n.localize(`l5r5e.rings.${e}`),
            value: actor?.data?.data?.rings?.[e] || 1,
        }));
    }

    /**
     * Get Skills for List / Select with groups
     */
    static getSkillsList(useGroup = false) {
        if (!useGroup) {
            return Array.from(CONFIG.l5r5e.skills).map(([id, cat]) => ({
                id: id,
                cat: cat,
                label: game.i18n.localize(`l5r5e.skills.${cat}.${id}`),
            }));
        }

        const skills = {};
        Array.from(CONFIG.l5r5e.skills).forEach(([id, cat]) => {
            if (!skills[cat]) {
                skills[cat] = [];
            }
            skills[cat].push({
                id: id,
                cat: cat,
                label: game.i18n.localize(`l5r5e.skills.${cat}.${id}`),
            });
        });
        return skills;
    }

    /**
     * Get Techniques for List / Select
     */
    static getTechniquesList() {
        return CONFIG.l5r5e.techniques.map((e) => ({
            id: e,
            label: game.i18n.localize(`l5r5e.techniques.${e}`),
        }));
    }

    /**
     * Return the target object on a drag n drop event, or null if not found
     */
    static async getDragnDropTargetObject(event) {
        const json = event.dataTransfer.getData("text/plain");
        if (!json) {
            return null;
        }
        const data = JSON.parse(json);
        return await HelpersL5r5e.getObjectGameOrPack(data.id, data.type, data.pack);
    }

    /**
     * Return the object from Game or Pack by his ID, or null if not found
     */
    static async getObjectGameOrPack(id, type, pack = null) {
        try {
            // Named pack
            if (pack) {
                const data = await game.packs.get(pack).getEntity(id);
                if (data) {
                    return HelpersL5r5e.createItemFromCompendium(data);
                }
            }

            // Game object
            let item = null;
            switch (type) {
                case "Actor":
                    item = game.actors.get(id);
                    break;

                case "Item":
                    item = game.items.get(id);
                    break;

                case "JournalEntry":
                    item = game.journal.get(id);
                    break;

                case "Macro":
                    item = game.macros.get(id);
                    break;
            }
            if (item) {
                return item;
            }

            // Unknown pack object, iterate all packs
            for (const comp of game.packs) {
                // TODO Bug with babele if "comp.getEntity(id)" return null...
                const babeleFix = (await comp.getIndex()).some((e) => e._id === id);
                if (!babeleFix) {
                    continue;
                }

                const data = await comp.getEntity(id);
                if (data) {
                    return HelpersL5r5e.createItemFromCompendium(data);
                }
            }
        } catch (err) {
            console.warn(err);
        }
        return null;
    }

    /**
     * Make a temporary item for compendium drag n drop
     */
    static async createItemFromCompendium(data) {
        if (
            data instanceof ItemL5r5e ||
            !["item", "armor", "weapon", "technique", "peculiarity", "property"].includes(data.type)
        ) {
            return data;
        }

        let item;
        if (game.user.hasPermission("ACTOR_CREATE")) {
            // Fail if a player do not have the right to create object (even if this is a temporary)
            item = await ItemL5r5e.create(data, { temporary: true });

            // reinject compendium id (required for properties)
            item.data._id = data._id;
        } else {
            // Quick object
            item = new ItemL5r5e(data);
        }
        return item;
    }

    /**
     * Convert (op), (ex)... to associated symbols for content/descriptions
     */
    static convertSymbols(text, toSymbol) {
        CONFIG.l5r5e.symbols.forEach((cfg, tag) => {
            if (toSymbol) {
                text = text.replace(
                    new RegExp(HelpersL5r5e.escapeRegExp(tag), "gi"),
                    `<i class="${cfg.class}" title="${game.i18n.localize(cfg.label)}"></i>`
                );
            } else {
                text = text.replace(new RegExp(`<i class="${cfg.class}" title="[^"]*"></i>`, "gi"), tag);
            }
        });
        return text;
    }

    /**
     * Escape Regx characters
     */
    static escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
}
