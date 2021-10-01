import { BaseCharacterSheetL5r5e } from "./base-character-sheet.js";

/**
 * NPC Sheet
 */
export class NpcSheetL5r5e extends BaseCharacterSheetL5r5e {
    /**
     * Sub Types
     */
    static types = ["adversary", "minion"];

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "npc"],
            template: CONFIG.l5r5e.paths.templates + "actors/npc-sheet.html",
        });
    }

    /** @inheritdoc */
    getData(options = {}) {
        const sheetData = super.getData();

        // NPC Subtypes
        sheetData.data.data.types = NpcSheetL5r5e.types.map((e) => ({
            id: e,
            label: game.i18n.localize("l5r5e.character_types." + e),
        }));

        return sheetData;
    }
}
