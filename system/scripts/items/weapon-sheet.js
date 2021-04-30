import { ItemSheetL5r5e } from "./item-sheet.js";

/**
 * @extends {ItemSheet}
 */
export class WeaponSheetL5r5e extends ItemSheetL5r5e {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "weapon"],
            template: CONFIG.l5r5e.paths.templates + "items/weapon/weapon-sheet.html",
            width: 520,
            height: 480,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
        });
    }

    async getData() {
        const sheetData = await super.getData();

        // Martial skills only
        sheetData.data.skills = Array.from(CONFIG.l5r5e.skills)
            .filter(([id, cat]) => cat === "martial")
            .map(([id, cat]) => id);

        return sheetData;
    }
}
