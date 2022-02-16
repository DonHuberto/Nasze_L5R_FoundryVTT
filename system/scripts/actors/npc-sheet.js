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
     * Add the CharacterGenerator button in L5R specific bar
     * @override
     * @return {{label: string, class: string, icon: string, onclick: Function|null}[]}
     */
    _getL5rHeaderButtons() {
        const buttons = super._getL5rHeaderButtons();
        if (!this.isEditable || this.actor.limited || this.actor.data.data.soft_locked) {
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

    /**
     * Subscribe to events from the sheet.
     * @param {jQuery} html HTML content of the sheet.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.isEditable) {
            return;
        }

        // Autocomplete
        game.l5r5e.HelpersL5r5e.autocomplete(
            html,
            "data.attitude",
            CONFIG.l5r5e.demeanorList.map((e) => {
                let modifiers = [];
                Object.entries(e.mod).forEach(([k, v]) => {
                    modifiers.push(`${game.i18n.localize(`l5r5e.rings.${k}`)} ${v}`);
                });
                return game.i18n.localize(`l5r5e.demeanor.${e.id}`) + ` (${modifiers.join(", ")})`;
            })
        );
    }
}
