import { L5R5E } from "./config.js";

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
            value: actor?.data?.data?.rings?.[e] || 0,
        }));
    }

    /**
     * Get Skills for List / Select with groups
     */
    static getSkillsList(useGroup = false) {
        if (!useGroup) {
            return Array.from(L5R5E.skills).map(([id, cat]) => ({
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
    static getDragnDropTargetObject(event) {
        let data = null;
        let targetItem = null;

        try {
            data = JSON.parse(event.dataTransfer.getData("text/plain"));
        } catch (err) {
            return null;
        }

        switch (data.type) {
            case "Actor":
                targetItem = game.actors.get(data.id);
                break;

            case "Item":
                targetItem = game.items.get(data.id);
                break;

            case "JournalEntry":
                targetItem = game.journal.get(data.id);
                break;

            case "Macro":
                targetItem = game.macros.get(data.id);
                break;
        }

        return targetItem;
    }
}
