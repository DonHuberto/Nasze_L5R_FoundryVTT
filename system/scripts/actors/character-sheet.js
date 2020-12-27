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
        });
    }

    /**
     * Add the TwentyQuestions button on top of sheet
     * @override
     */
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (!this.options.editable || this.actor.limited) {
            return buttons;
        }

        buttons.unshift({
            label: game.i18n.localize("l5r5e.twenty_questions.bt_abrev"),
            class: "twenty-questions",
            icon: "fas fa-graduation-cap",
            onclick: async () => {
                await new TwentyQuestionsDialog(this.actor).render(true);
            },
        });
        return buttons;
    }

    /**
     * Commons datas
     */
    getData() {
        const sheetData = super.getData();

        // Sort Items by rank 1->6 for advancements tab
        sheetData.items.sort((a, b) => {
            return (a.data.bought_at_rank || 1) - (b.data.bought_at_rank || 1);
        });

        // Min rank = 1
        this.actor.data.data.identity.school_rank = Math.max(1, this.actor.data.data.identity.school_rank);

        // Xp spent only in current rank
        const totalXp = this._getXpSpent();
        sheetData.data.xp_spent_rank = totalXp.rank;
        sheetData.data.xp_spent = totalXp.total;
        sheetData.data.xp_saved = sheetData.data.xp_total - sheetData.data.xp_spent;
        sheetData.data.xp_goal = CONFIG.l5r5e.xp.costPerRank[this.actor.data.data.identity.school_rank - 1] || null;

        return sheetData;
    }

    /**
     * Return the total xp spent and the current total xp spent for this rank
     */
    _getXpSpent() {
        const total = {
            total: 0,
            rank: 0,
        };
        const currentRank = this.actor.data.data.identity.school_rank;
        this.actor.items.map((item) => {
            let xp = item.data.data.xp_used || 0;
            total.total = total.total + xp;

            if (currentRank === item.data.data.rank) {
                // if not in curriculum, xp spent /2 for this item
                if (!item.data.data.in_curriculum && xp > 0) {
                    xp = Math.floor(xp / 2);
                }
                total.rank = total.rank + xp;
            }
        });
        return total;
    }
}
