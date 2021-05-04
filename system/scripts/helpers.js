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
            // If no pack passed, but it's a core item, we know the pack to get it
            if (!pack && id.substr(0, 7) === "L5RCore") {
                pack = HelpersL5r5e.getPackNameForCoreItem(id);
            }

            // Named pack
            if (pack) {
                const data = await game.packs.get(pack).getDocument(id);
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
                await HelpersL5r5e.refreshItemProperties(item);
                return item;
            }

            // Unknown pack object, iterate all packs
            for (const comp of game.packs) {
                // TODO Bug with babele if "comp.getDocument(id)" return null...
                const babeleFix = (await comp.getIndex()).some((e) => e.id === id);
                if (!babeleFix) {
                    continue;
                }

                const data = await comp.getDocument(id);
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
        if (!["item", "armor", "weapon", "technique", "peculiarity", "property"].includes(data.type)) {
            return data;
        }

        let item;
        if (data instanceof ItemL5r5e) {
            item = data;
        } else if (game.user.hasPermission("ACTOR_CREATE")) {
            // Fail if a player do not have the right to create object (even if this is a temporary)
            item = await ItemL5r5e.create(data, { temporary: true });

            // reinject compendium id (required for properties)
            item.data.id = data.id;
        } else {
            // Quick object
            item = new ItemL5r5e(data);
        }
        await HelpersL5r5e.refreshItemProperties(item);
        return item;
    }

    /**
     * Babele and properties specific
     */
    static async refreshItemProperties(item) {
        if (item.data.data.properties && typeof Babele !== "undefined") {
            item.data.data.properties = await Promise.all(
                item.data.data.properties.map(async (property) => {
                    const gameProp = await game.l5r5e.HelpersL5r5e.getObjectGameOrPack(property.id, "Item");
                    if (gameProp) {
                        return { id: gameProp.id, name: gameProp.name };
                    }
                    return property;
                })
            );
        }
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

    /**
     * Get the associated pack for a core item (time saving)
     */
    static getPackNameForCoreItem(itemId) {
        const core = new Map();
        core.set("Pro", "l5r5e.core-properties");
        core.set("Kat", "l5r5e.core-techniques-kata");
        core.set("Kih", "l5r5e.core-techniques-kiho");
        core.set("Ins", "l5r5e.core-techniques-inversion");
        core.set("Inv", "l5r5e.core-techniques-invocations");
        core.set("Rit", "l5r5e.core-techniques-rituals");
        core.set("Shu", "l5r5e.core-techniques-shuji");
        core.set("Mah", "l5r5e.core-techniques-maho");
        core.set("Nin", "l5r5e.core-techniques-ninjutsu");
        core.set("Sch", "l5r5e.core-techniques-school");
        core.set("Mas", "l5r5e.core-techniques-mastery");
        core.set("Ite", "l5r5e.core-items");
        core.set("Arm", "l5r5e.core-armors");
        core.set("Wea", "l5r5e.core-weapons");
        core.set("Dis", "l5r5e.core-peculiarities-distinctions");
        core.set("Pas", "l5r5e.core-peculiarities-passions");
        core.set("Adv", "l5r5e.core-peculiarities-adversities");
        core.set("Anx", "l5r5e.core-peculiarities-anxieties");
        return core.get(itemId.replace(/L5RCore(\w{3})\d+/gi, "$1"));
    }

    /**
     * Show a confirm dialog before a deletion
     * @param {string} content
     * @param {function} callback The callback function for confirmed action
     */
    static confirmDeleteDialog(content, callback) {
        new Dialog({
            title: game.i18n.localize("Delete"),
            content,
            buttons: {
                confirm: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: game.i18n.localize("Yes"),
                    callback,
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("No"),
                },
            },
        }).render(true);
    }

    /**
     * Notify Applications using Difficulty settings that the values was changed
     */
    static notifyDifficultyChange() {
        ["l5r5e-dice-picker-dialog", "l5r5e-gm-tools-dialog"].forEach((appId) => {
            const app = Object.values(ui.windows).find((e) => e.id === appId);
            if (app && typeof app.refresh === "function") {
                app.refresh();
            }
        });
    }
}
