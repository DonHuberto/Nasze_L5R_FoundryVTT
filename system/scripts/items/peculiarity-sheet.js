import { ItemSheetL5r5e } from "./item-sheet.js";

/**
 * Commun class for Advantages / Disadvantages types
 * @extends {ItemSheet}
 */
export class PeculiaritySheetL5r5e extends ItemSheetL5r5e {
    /**
     * Sub Types of Advantage/Disadvantage
     */
    static types = ["distinction", "passion", "adversity", "anxiety"];

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "peculiarity"],
            template: CONFIG.l5r5e.paths.templates + "items/peculiarity/peculiarity-sheet.html",
            width: 520,
            height: 480,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
        });
    }

    async getData() {
        const sheetData = await super.getData();

        sheetData.data.subTypesList = PeculiaritySheetL5r5e.types;

        return sheetData;
    }
}
