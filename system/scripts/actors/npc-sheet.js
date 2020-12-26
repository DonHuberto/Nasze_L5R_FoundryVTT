import { BaseSheetL5r5e } from "./base-sheet.js";

/**
 * NPC Sheet
 */
export class NpcSheetL5r5e extends BaseSheetL5r5e {
    /**
     * Sub Types
     */
    static types = ["adversary", "minion"];

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "npc"],
            template: CONFIG.l5r5e.paths.templates + "actors/npc-sheet.html",
        });
    }

    getData() {
        const sheetData = super.getData();

        sheetData.data.types = NpcSheetL5r5e.types.map((e) => ({
            id: e,
            label: game.i18n.localize("l5r5e.npc.types." + e),
        }));

        return sheetData;
    }
}
