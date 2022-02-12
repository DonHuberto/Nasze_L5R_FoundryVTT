import { ItemSheetL5r5e } from "./item-sheet.js";

/**
 * @extends {ItemSheet}
 */
export class TechniqueSheetL5r5e extends ItemSheetL5r5e {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "technique"],
            template: CONFIG.l5r5e.paths.templates + "items/technique/technique-sheet.html",
            width: 520,
            height: 480,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
        });
    }

    /** @override */
    async getData(options = {}) {
        const sheetData = await super.getData(options);

        // List all available techniques type
        const types = ["core", "school", "title"];
        if (game.settings.get("l5r5e", "techniques-customs")) {
            types.push("custom");
        }
        sheetData.data.techniquesList = game.l5r5e.HelpersL5r5e.getTechniquesList({ types });

        // Sanitize Difficulty and Skill list
        sheetData.data.data.skill = TechniqueSheetL5r5e.formatSkillList(sheetData.data.data.skill);
        sheetData.data.data.difficulty = TechniqueSheetL5r5e.formatDifficulty(sheetData.data.data.difficulty);

        return sheetData;
    }

    /**
     * This method is called upon form submission after form data is validated
     * @param   {Event}  event    The initial triggering submission event
     * @param   {Object} formData The object of validated form data with which to update the object
     * @returns {Promise}         A Promise which resolves once the update operation has completed
     * @override
     */
    async _updateObject(event, formData) {
        // Sanitize Difficulty and Skill list
        formData["data.skill"] = TechniqueSheetL5r5e.formatSkillList(formData["data.skill"]);
        formData["data.difficulty"] = TechniqueSheetL5r5e.formatDifficulty(formData["data.difficulty"]);

        return super._updateObject(event, formData);
    }

    /**
     * Sanitize the technique difficulty
     * @param  {string} str
     * @return {string}
     */
    static formatDifficulty(str) {
        if (str && !Number.isNumeric(str) && !CONFIG.l5r5e.regex.techniqueDifficulty.test(str)) {
            return "";
        }
        return str;
    }

    /**
     * Sanitize the technique skill list
     * @param  {string} skillList
     * @return {string}
     */
    static formatSkillList(skillList) {
        if (!skillList) {
            return "";
        }
        const categories = game.l5r5e.HelpersL5r5e.getCategoriesSkillsList();

        // List categories
        const unqCatList = new Set();
        skillList.split(",").forEach((s) => {
            s = s.trim();
            if (categories.has(s)) {
                unqCatList.add(s);
            }
        });

        // List skill (not include in cat)
        const unqSkillList = new Set();
        skillList.split(",").forEach((s) => {
            s = s.trim();
            if (CONFIG.l5r5e.skills.has(s)) {
                const cat = CONFIG.l5r5e.skills.get(s);
                if (!unqCatList.has(cat)) {
                    unqSkillList.add(s);
                }
            }
        });

        return [...unqCatList, ...unqSkillList].join(",");
    }
}
