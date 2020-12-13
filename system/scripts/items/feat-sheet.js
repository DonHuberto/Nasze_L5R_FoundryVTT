import { ItemSheetL5r5e } from "./item-sheet.js";

/**
 * @extends {ItemSheet}
 */
export class FeatSheetL5r5e extends ItemSheetL5r5e {
    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "feat"],
            template: CONFIG.L5r5e.paths.templates + "item/feat-sheet.html",
            width: 520,
            height: 480,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
        });
    }

    /** @override */
    getData() {
        const sheetData = super.getData();
        sheetData.data.dtypes = ["String", "Number", "Boolean"];

        sheetData.data.isFeat = true;
        sheetData.data.isEquipment = false;

        return sheetData;
    }

    /**
     * Subscribe to events from the sheet.
     * @param html HTML content of the sheet.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;
    }

    /**
     * Update feat with the data from the sheet.
     * @param event
     * @param formData
     */
    _updateObject(event, formData) {
        // Update the Item
        return this.object.update(formData);
    }
}
