import { ItemSheetL5r5e } from "./item-sheet.js";

/**
 * @extends {ItemSheet}
 */
export class AdvancementSheetL5r5e extends ItemSheetL5r5e {
    /**
     * Sub Types of advancements
     */
    static types = ["ring", "skill", "advantage"]; // "technique" has it's own type

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "advancement"],
            template: CONFIG.l5r5e.paths.templates + "items/advancement/advancement-sheet.html",
            width: 520,
            height: 480,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
        });
    }

    getData() {
        const sheetData = super.getData();

        sheetData.data.dtypes = ["String", "Number", "Boolean"];
        sheetData.data.subTypesList = AdvancementSheetL5r5e.types;
        sheetData.data.skillsList = game.l5r5e.HelpersL5r5e.getSkillsList(true);

        return sheetData;
    }
}
