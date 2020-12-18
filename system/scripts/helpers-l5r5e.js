import { L5R5E } from "./l5r5e-config.js";

/**
 * Extends the actor to process special things from L5R.
 */
export class HelpersL5r5e {
    /**
     * Get Rings/Element for List / Select
     */
    static getRingsList() {
        return L5R5E.stances.map((e) => {
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
        Array.from(L5R5E.skills).forEach(([id, cat]) => {
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
        return L5R5E.techniques.map((e) => {
            return {
                id: e,
                label: game.i18n.localize(`l5r5e.techniques.${e}`),
            };
        });
    }
}
