import { L5R5E } from "./config.js";

/**
 * Extends the actor to process special things from L5R.
 */
export class HelpersL5r5e {
    /**
     * Get Rings/Element for List / Select
     */
    static getRingsList() {
        return CONFIG.l5r5e.stances.map((e) => {
            return {
                id: e,
                label: game.i18n.localize(`l5r5e.rings.${e}`),
            };
        });
    }

    /**
     * Get Skills for List / Select with groups
     */
    static getSkillsList(useGroup) {
        if (!useGroup) {
            return Array.from(L5R5E.skills).map(([id, cat]) => {
                return {
                    id: id,
                    cat: cat,
                    label: game.i18n.localize(`l5r5e.skills.${cat}.${id}`),
                };
            });
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
        return CONFIG.l5r5e.techniques.map((e) => {
            return {
                id: e,
                label: game.i18n.localize(`l5r5e.techniques.${e}`),
            };
        });
    }
}
