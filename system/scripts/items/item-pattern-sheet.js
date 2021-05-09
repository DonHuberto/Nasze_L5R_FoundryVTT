import { ItemSheetL5r5e } from "./item-sheet.js";

/**
 * @extends {ItemSheet}
 */
export class ItemPatternSheetL5r5e extends ItemSheetL5r5e {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "item-pattern"],
            template: CONFIG.l5r5e.paths.templates + "items/item-pattern/item-pattern-sheet.html",
            width: 520,
            height: 480,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
        });
    }
}
