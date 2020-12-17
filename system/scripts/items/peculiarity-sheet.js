import { ItemSheetL5r5e } from "./item-sheet.js";

/**
 * Commun class for Advantages / Disadvantages types
 * @extends {ItemSheet}
 */
export class PeculiaritySheetL5r5e extends ItemSheetL5r5e {
    /**
     * Sub Types of Advantage/Disadvantage
     */
    static SUB_TYPES = ["distinction", "passion", "adversity", "anxiety"];

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "peculiarity"],
            template: CONFIG.L5r5e.paths.templates + "item/peculiarity-sheet.html",
            width: 520,
            height: 480,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
        });
    }

    getData() {
        const sheetData = super.getData();
        sheetData.data.dtypes = ["String", "Number", "Boolean"];
        return sheetData;
    }
}
