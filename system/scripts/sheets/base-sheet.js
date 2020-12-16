/**
 * Base Sheet for Actor and Npc
 */
export class BaseSheetL5r5e extends ActorSheet {
    /**
     * Commons datas
     */
    getData() {
        const sheetData = super.getData();

        this._prepareItems(sheetData);

        const techniques = sheetData.items.filter((item) => item.type === "technique");

        sheetData.data.techniques.list = techniques;
        sheetData.data.stances = CONFIG.L5r5e.stances;

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

                case "technique":
                    item.isTechnique = true;
                    break;

                case "quality":
                    item.isQuality = true;
                    break;

                case "advancement":
                    item.isAdvancement = true;
                    break;

                case "advantage":
                    item.isAdvantage = true;
                    break;

                case "disadvantage":
                    item.isDisadvantage = true;
                    break;

                default:
                    item.isEquipment = true;
                    break;
            }
        }
    }

    /**
     * TODO
     */
    _prepareTechniques() {}

    /**
     * Subscribe to events from the sheet.
     * @param html HTML content of the sheet.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) {
            return;
        }

        // *** Items ***
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
            this.actor.deleteOwnedItem(li.data("itemId"));
        });

        // *** Techniques ***
        html.find(".technique-add").on("click", (ev) => {
            this._createTechnique();
        });

        html.find(".technique-delete").on("click", (ev) => {
            const li = $(ev.currentTarget).parents(".technique");
            const techniqueId = li.data("techniqueId");
            console.log("Remove technique" + techniqueId + " clicked");

            this.actor.deleteOwnedItem(techniqueId);
        });

        html.find(".technique-edit").on("click", (ev) => {
            const li = $(ev.currentTarget).parents(".technique");
            const techniqueId = li.data("techniqueId");
            const technique = this.actor.getOwnedItem(techniqueId);
            technique.sheet.render(true);
        });

        // *** Skills ***
        html.find(".skill-name").on("click", (ev) => {
            const li = $(ev.currentTarget).parents(".skill");
            new game.l5r5e.DicePickerDialog({ skillId: li.data("skill"), actor: this.actor }).render(true);
        });

        // *** Advancement ***
        html.find(".advancement-add").on("click", (ev) => {
            this._createAdvancement();
        });

        html.find(".advancement-edit").on("click", (ev) => {
            const li = $(ev.currentTarget).parents(".advancement");
            const advancementId = li.data("advancementId");
            const advancement = this.actor.getOwnedItem(advancementId);
            advancement.sheet.render(true);
        });

        html.find(".advancement-delete").on("click", (ev) => {
            const li = $(ev.currentTarget).parents(".advancement");
            this.actor.deleteOwnedItem(li.data("advancementId"));
        });
    }

    /**
     * Creates a new feat for the character and shows a window to edit it.
     */
    async _createTechnique() {
        const data = {
            name: game.i18n.localize("l5r5e.techniques.title_new"),
            type: "technique",
        };
        const created = await this.actor.createEmbeddedEntity("OwnedItem", data);
        const technique = this.actor.getOwnedItem(created._id);

        // Default values
        //technique.rank = 1;
        //technique.xp_used = 0;

        technique.sheet.render(true);

        return technique;
    }

    /**
     * Creates a new feat for the character and shows a window to edit it.
     */
    async _createAdvancement() {
        const data = {
            name: game.i18n.localize("l5r5e.xp.acquisitions"),
            type: "advancement",
        };
        const created = await this.actor.createEmbeddedEntity("OwnedItem", data);
        const acquisition = this.actor.getOwnedItem(created._id);

        acquisition.sheet.render(true);

        // Default values
        //acquisition.rank = 1;
        //acquisition.xp_used = 0;

        return acquisition;
    }
}
