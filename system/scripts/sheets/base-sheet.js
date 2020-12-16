/**
 * Base Sheet for Actor and Npc
 */
export class BaseSheetL5r5e extends ActorSheet {
    /**
     * Commons datas
     */
    getData() {
        const sheetData = super.getData();

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
     * Subscribe to events from the sheet.
     * @param html HTML content of the sheet.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // *** Skills ***
        html.find(".skill-name").on("click", (ev) => {
            const li = $(ev.currentTarget).parents(".skill");
            new game.l5r5e.DicePickerDialog({ skillId: li.data("skill"), actor: this.actor }).render(true);
        });

        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.options.editable) {
            return;
        }

        // *** Items / Inventory ***
        html.find(".item-edit").on("click", (ev) => {
            this._editSubItem(ev, "item");
        });
        html.find(".item-delete").on("click", (ev) => {
            this._deleteSubItem(ev, "item");
        });

        // *** Techniques ***
        html.find(".technique-add").on("click", (ev) => {
            this._addSubItem({
                name: game.i18n.localize("l5r5e.techniques.title_new"),
                type: "technique",
            });
        });
        html.find(".technique-edit").on("click", (ev) => {
            this._editSubItem(ev, "technique");
        });
        html.find(".technique-delete").on("click", (ev) => {
            this._deleteSubItem(ev, "technique");
        });

        // *** Advancement ***
        html.find(".advancement-add").on("click", (ev) => {
            this._addSubItem({
                name: game.i18n.localize("l5r5e.xp.advancements"),
                type: "advancement",
            });
        });
        html.find(".advancement-edit").on("click", (ev) => {
            this._editSubItem(ev, "advancement");
        });
        html.find(".advancement-delete").on("click", (ev) => {
            this._deleteSubItem(ev, "advancement");
        });
    }

    /**
     * Add a generic item with sub type
     * @private
     */
    async _addSubItem(data) {
        const created = await this.actor.createEmbeddedEntity("OwnedItem", data);
        const item = this.actor.getOwnedItem(created._id);
        item.sheet.render(true);
        return item;
    }

    /**
     * Edit a generic item with sub type
     * @private
     */
    async _editSubItem(ev, type) {
        const li = $(ev.currentTarget).parents("." + type);
        const itemId = li.data(type + "Id");
        const item = this.actor.getOwnedItem(itemId);
        item.sheet.render(true);
    }

    /**
     * Delete a generic item with sub type
     * @private
     */
    async _deleteSubItem(ev, type) {
        const li = $(ev.currentTarget).parents("." + type);
        return this.actor.deleteOwnedItem(li.data(type + "Id"));
    }
}
