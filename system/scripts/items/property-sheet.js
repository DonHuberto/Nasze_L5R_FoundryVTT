import { ItemSheetL5r5e } from "./item-sheet.js";

/**
 * @extends {ItemSheet}
 */
export class PropertySheetL5r5e extends ItemSheetL5r5e {
    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "property"],
            template: CONFIG.l5r5e.paths.templates + "items/property/property-sheet.html",
            width: 520,
            height: 480,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
        });
    }
    // TODO certain propriétés en annule d'autres : aiguisé <-> abimé. voir comment faire.
}
