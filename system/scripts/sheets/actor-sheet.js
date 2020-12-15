import { TwentyQuestionsDialog } from "./twenty-questions-dialog.js";

export class ActorSheetL5r5e extends ActorSheet {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "actor"],
            template: CONFIG.L5r5e.paths.templates + "sheets/actor-sheet.html",
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

        buttons.unshift({
            label: "20Q", // TODO localization
            class: "twenty-questions",
            icon: "fas fa-graduation-cap",
            onclick: async () => {
                await new TwentyQuestionsDialog({}, this.actor).render(true);
            },
        });

        return buttons;
    }

    getData() {
        const sheetData = super.getData();

        this._prepareItems(sheetData);

        const feats = sheetData.items.filter((item) => item.type === "feat");

        sheetData.data.feats = feats;

        return sheetData;
    }

    /**
     * Update the actor.
     * @param event
     * @param formData
     */
    _updateObject(event, formData) {
        return this.object.update(formData);
    }

    /**
     * Prepare item data to be displayed in the actor sheet.
     * @param sheetData Data of the actor been displayed in the sheet.
     */
    _prepareItems(sheetData) {
        for (let item of sheetData.items) {
            switch (item.type) {
                case "weapon":
                    item.isWeapon = true;
                    item.isEquipment = true;
                    break;

                case "armor":
                    item.isArmor = true;
                    item.isEquipment = true;
                    break;

                case "feat":
                    item.isFeat = true;
                    break;

                default:
                    item.isEquipment = true;
                    break;
            }
        }
    }

    _prepareFeats() {}

    /**
     * Subscribe to events from the sheet.
     * @param html HTML content of the sheet.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Update Inventory Item
        html.find(".item-edit").on("click", (ev) => {
            const li = $(ev.currentTarget).parents(".item");
            const itemId = li.data("itemId");
            const item = this.actor.getOwnedItem(itemId);
            item.sheet.render(true);
        });

        // Delete Inventory Item
        html.find(".item-delete").on("click", (ev) => {
            const li = $(ev.currentTarget).parents(".item");
            const itemId = li.data("itemId");
            this.actor.deleteOwnedItem(itemId);
        });

        html.find(".feat-add").on("click", (ev) => {
            this._createFeat();
        });

        html.find(".feat-delete").on("click", (ev) => {
            const li = $(ev.currentTarget).parents(".feat");
            const featId = li.data("featId");
            console.log("Remove feat" + featId + " clicked");

            this.actor.deleteOwnedItem(featId);
        });

        html.find(".feat-edit").on("click", (ev) => {
            const li = $(ev.currentTarget).parents(".feat");
            const featId = li.data("featId");
            const feat = this.actor.getOwnedItem(featId);
            feat.sheet.render(true);
        });

        html.find(".skill-name").on("click", (ev) => {
            const li = $(ev.currentTarget).parents(".skill");
            const skillId = li.data("skill");

            this._onSkillClicked(skillId);
        });

        html.find(".acquisition-add").on("click", (ev) => {
            this._createFeat();
        });
    }

    /**
     * Creates a new feat for the character and shows a window to edit it.
     */
    async _createFeat() {
        const data = {
            name: game.i18n.localize("l5r5e.featplaceholdername"),
            type: "feat",
        };
        const created = await this.actor.createEmbeddedEntity("OwnedItem", data);
        const feat = this.actor.getOwnedItem(created._id);

        // Default values
        //feat.rank = 1;
        //feat.xp_used = 0;

        feat.sheet.render(true);

        return feat;
    }

    /**
     * React to a skill from the skills list been clicked.
     * @param {string} skillId Unique ID of the skill been clicked.
     */
    async _onSkillClicked(skillId) {
        new game.l5r5e.DicePickerDialog({ skillId: skillId, actor: this.actor }).render(true);
    }
}
