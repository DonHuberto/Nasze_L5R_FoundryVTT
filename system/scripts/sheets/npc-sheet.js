import { BaseSheetL5r5e } from "./base-sheet.js";

/**
 * NPC Sheet
 */
export class NpcSheetL5r5e extends BaseSheetL5r5e {
    static types = ["minion", "adversary"];

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "npc"],
            template: CONFIG.L5r5e.paths.templates + "sheets/npc-sheet.html",
            width: 600,
            height: 800,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
            dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }],
        });
    }

    getData() {
        const sheetData = super.getData();

        sheetData.data.types = NpcSheetL5r5e.types;

        return sheetData;
    }
}
