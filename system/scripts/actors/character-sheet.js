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
            tabs: [
                { navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills" },
                { navSelector: ".advancements-tabs", contentSelector: ".advancements-body", initial: "last" },
            ],
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

        // Split Money
        sheetData.data.money = this._zeniToMoney(this.actor.data.data.zeni);

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
     * Subscribe to events from the sheet.
     * @param html HTML content of the sheet.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.options.editable) {
            return;
        }

        // *** Items : curriculum management ***
        html.find(`.item-curriculum`).on("click", (event) => {
            this._switchSubItemCurriculum(event);
        });
        html.find(`button[name=validate-curriculum]`).on("click", (event) => {
            this.actor.data.data.identity.school_rank = this.actor.data.data.identity.school_rank + 1;
            // Update actor
            this.actor.update({
                data: {
                    identity: {
                        school_rank: this.actor.data.data.identity.school_rank,
                    },
                },
            });
            this.render(false);
        });

        // Advancements Tab to current rank onload
        // TODO class "Active" Bug on load, dunno why :/
        this._tabs
            .find((e) => e._navSelector === ".advancements-tabs")
            .activate("advancement_rank_" + (this.actor.data.data.identity.school_rank || 0));
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

    /**
     * Update the actor.
     * @param event
     * @param formData
     */
    _updateObject(event, formData) {
        // Store money in zeni
        formData["data.zeni"] = this._moneyToZeni(
            formData["data.money.koku"],
            formData["data.money.bu"],
            formData["data.money.zeni"]
        );

        // Remove fake money object
        delete formData["data.money.koku"];
        delete formData["data.money.bu"];
        delete formData["data.money.zeni"];

        return super._updateObject(event, formData);
    }

    _zeniToMoney(zeni) {
        const money = {
            koku: 0,
            bu: 0,
            zeni: zeni,
        };

        if (money.zeni >= CONFIG.l5r5e.money[0]) {
            money.koku = Math.floor(money.zeni / CONFIG.l5r5e.money[0]);
            money.zeni = Math.floor(money.zeni % CONFIG.l5r5e.money[0]);
        }
        if (money.zeni >= CONFIG.l5r5e.money[1]) {
            money.bu = Math.floor(money.zeni / CONFIG.l5r5e.money[1]);
            money.zeni = Math.floor(money.zeni % CONFIG.l5r5e.money[1]);
        }

        return money;
    }

    _moneyToZeni(koku, bu, zeni) {
        return Math.floor(koku * CONFIG.l5r5e.money[0]) + Math.floor(bu * CONFIG.l5r5e.money[1]) + Math.floor(zeni);
    }
}
