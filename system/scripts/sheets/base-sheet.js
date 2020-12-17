/**
 * Base Sheet for Actor and Npc
 */
export class BaseSheetL5r5e extends ActorSheet {
    /**
     * Commons datas
     */
    getData() {
        const sheetData = super.getData();

        sheetData.data.dtypes = ["String", "Number", "Boolean"];
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
     * Handle dropped data on the Actor sheet
     */
    // _onDrop(event) {
    //     console.log('*** event', event);
    //     return false;
    // }

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

        // *** Items : edit, delete ***
        ["item", "peculiarity", "technique", "advancement"].forEach((type) => {
            html.find(`.${type}-edit`).on("click", (ev) => {
                this._editSubItem(ev, type);
            });
            html.find(`.${type}-delete`).on("click", (ev) => {
                this._deleteSubItem(ev, type);
            });

            if (type !== "item") {
                html.find(`.${type}-curriculum`).on("click", (ev) => {
                    this._switchSubItemCurriculum(ev, type);
                });
            }
        });

        // *** Items : add ***
        html.find(".technique-add").on("click", (ev) => {
            this._addSubItem({
                name: game.i18n.localize("l5r5e.techniques.title_new"),
                type: "technique",
            });
        });
        html.find(".advancement-add").on("click", (ev) => {
            this._addSubItem({
                name: game.i18n.localize("l5r5e.advancements.title_new"),
                type: "advancement",
            });
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

    /**
     * Switch "in_curriculum"
     * @private
     */
    _switchSubItemCurriculum(ev, type) {
        const li = $(ev.currentTarget).parents("." + type);
        const itemId = li.data(type + "Id");
        const item = this.actor.getOwnedItem(itemId);
        return item.update({
            data: {
                in_curriculum: !item.data.data.in_curriculum,
            },
        });
    }
}
