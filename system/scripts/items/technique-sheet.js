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
    async getData() {
        const sheetData = await super.getData();

        // Add "school ability" and "mastery ability"
        CONFIG.l5r5e.techniques_school.forEach((e) => {
            sheetData.data.techniquesList.push({
                id: e,
                label: game.i18n.localize(`l5r5e.techniques.${e}`),
            });
        });

        return sheetData;
    }
}
