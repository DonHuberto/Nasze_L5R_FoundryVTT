import { BaseCharacterSheetL5r5e } from "./base-character-sheet.js";
import { CharacterGeneratorDialog } from "./character-generator-dialog.js";

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

    /**
     * Add the NpcGenerator button on top of sheet
     * @override
     */
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (!this.isEditable || this.actor.limited) {
            return buttons;
        }

        buttons.unshift({
            label: game.i18n.localize("l5r5e.char_generator.head_bt_title"),
            class: "character-generator",
            icon: "fas fa-cogs",
            onclick: async () => {
                await new CharacterGeneratorDialog(this.actor).render(true);
            },
        });

        return buttons;
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
