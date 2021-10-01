import { ItemSheetL5r5e } from "./item-sheet.js";

/**
 * @extends {ItemSheetL5r5e}
 */
export class ArmyCohortSheetL5r5e extends ItemSheetL5r5e {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "army-cohort"],
            template: CONFIG.l5r5e.paths.templates + "items/army-cohort/army-cohort-sheet.html",
            width: 520,
            height: 480,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
        });
    }
}
