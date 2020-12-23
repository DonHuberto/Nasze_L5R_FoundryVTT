import { BaseSheetL5r5e } from "./base-sheet.js";
import { TwentyQuestionsDialog } from "./twenty-questions-dialog.js";

/**
 * Actor / Character Sheet
 */
export class CharacterSheetL5r5e extends BaseSheetL5r5e {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "actor"],
            template: CONFIG.l5r5e.paths.templates + "actors/character-sheet.html",
            width: 600,
            height: 800,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
            dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }],
        });
    }

    /**
     * Add the TwentyQuestions button on top of sheet
     * @override
     */
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (!this.options.editable) {
            return buttons;
        }

        buttons.unshift({
            label: game.i18n.localize("l5r5e.twenty_questions.bt_abrev"),
            class: "twenty-questions",
            icon: "fas fa-graduation-cap",
            onclick: async () => {
                await new TwentyQuestionsDialog({}, this.actor).render(true);
            },
        });
        return buttons;
    }

    /**
     * Commons datas
     */
    getData() {
        const sheetData = super.getData();

        // Sort Items by rank 0->6 for advancements tab
        sheetData.items.sort((a, b) => {
            return (a.data.bought_at_rank || 0) - (b.data.bought_at_rank || 0);
        });

        // Xp spent only in current rank
        sheetData.data.xp_spent_rank = this.getXpSpentInThisRank();

        return sheetData;
    }

    /**
     * Return the current total xp spent for this rank
     */
    getXpSpentInThisRank() {
        const currentRank = this.actor.data.data.identity.school_rank || 0;
        return this.actor.items.reduce((tot, item) => {
            if (currentRank + 1 === item.data.data.rank) {
                let xp = item.data.data.xp_used || 0;

                // if not in curriculum, xp spent /2 for this item
                if (!item.data.data.in_curriculum && xp > 0) {
                    xp = Math.floor(xp / 2);
                }
                return tot + xp;
            }
            return tot;
        }, 0);
    }
}
