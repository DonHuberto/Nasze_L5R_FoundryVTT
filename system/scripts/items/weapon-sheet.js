import { L5R5E } from "../l5r5e-config.js";
import { ItemSheetL5r5e } from "./item-sheet.js";

/**
 * @extends {ItemSheet}
 */
export class WeaponSheetL5r5e extends ItemSheetL5r5e {
    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "weapon"],
            template: CONFIG.L5r5e.paths.templates + "item/weapon-sheet.html",
            width: 520,
            height: 480,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
        });
    }

    getData() {
        const sheetData = super.getData();
        sheetData.data.dtypes = ["String", "Number", "Boolean"];

        // Martial skills only
        sheetData.data.skills = Array.from(L5R5E.skills)
            .filter(([id, cat]) => cat === "martial")
            .map(([id, cat]) => id);

        return sheetData;
    }
}
