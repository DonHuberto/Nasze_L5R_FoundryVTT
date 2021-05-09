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

        return sheetData;
    }
}
