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

        // Min rank = 1
        this.actor.data.data.identity.school_rank = Math.max(1, this.actor.data.data.identity.school_rank);

        // Sort Items by name
        sheetData.items.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        // split advancements list by rank, and calculate xp spent
        this._prepareAdvancement(sheetData);
        sheetData.data.xp_saved = sheetData.data.xp_total - sheetData.data.xp_spent;

        return sheetData;
    }

    /**
     * Return the total xp spent and the current total xp spent for this rank
     */
    _prepareAdvancement(sheetData) {
        const adv = [];
        sheetData.data.xp_spent = 0;
        sheetData.items.forEach((item) => {
            if (!["peculiarity", "technique", "advancement"].includes(item.type)) {
                return;
            }

            let xp = item.data.xp_used || 0;
            sheetData.data.xp_spent = sheetData.data.xp_spent + xp;

            // if not in curriculum, xp spent /2 for this item
            if (!item.data.in_curriculum && xp > 0) {
                xp = Math.floor(xp / 2);
            }

            const rank = Math.max(0, item.data.bought_at_rank);
            if (rank < 1) {
                // Ignore starting comp/items
                return;
            }
            if (!adv[rank]) {
                adv[rank] = {
                    rank: rank,
                    spent: 0,
                    goal: CONFIG.l5r5e.xp.costPerRank[rank] || null,
                    list: [],
                };
            }
            adv[rank].list.push(item);
            adv[rank].spent = adv[rank].spent + xp;
        });
        sheetData.advancementsListByRank = adv;
    }
}
