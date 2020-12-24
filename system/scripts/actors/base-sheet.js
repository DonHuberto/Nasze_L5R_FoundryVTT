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
        sheetData.data.stances = CONFIG.l5r5e.stances;
        sheetData.data.techniquesList = CONFIG.l5r5e.techniques;

        return sheetData;
    }

    /**
     * Return a light sheet if in "limited" state
     * @override
     */
    get template() {
        if (!game.user.isGM && this.actor.limited) {
            return `${CONFIG.l5r5e.paths.templates}actors/limited-sheet.html`;
        }
        return this.options.template;
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
    _onDrop(event) {
        // Check item type and subtype
        const item = game.l5r5e.HelpersL5r5e.getDragnDropTargetObject(event);
        if (
            !item ||
            item.entity !== "Item" ||
            !["item", "armor", "weapon", "technique", "peculiarity", "advancement"].includes(item.data.type)
        ) {
            return Promise.resolve();
        }

        // Check if technique is allowed
        if (item.data.type === "technique") {
            // TODO Verifier que la technique est possible pour ce persos ? technique_type / techniques.kata
            //console.log(item.data.data.technique_type, this.actor.data.data.techniques);
            //return Promise.resolve();
        }

        // Ok add item
        return super._onDrop(event);
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

        // *** Dice event on Skills clic ***
        html.find(".skill-name").on("click", (event) => {
            const li = $(event.currentTarget).parents(".skill");
            new game.l5r5e.DicePickerDialog({
                skillId: li.data("skill"),
                skillCatId: li.data("skillcat"),
                actor: this.actor,
            }).render(true);
        });

        // On focus on one numeric element, select all text for better experience
        html.find(".select-on-focus").on("focus", (event) => {
            event.target.select();
        });

        // Toggle
        // html.find(".toggle-on-click").on("click", (event) => {
        //     const elmt = $(event.currentTarget).data("toggle");
        //     const tgt = html.find("." + elmt);
        //     tgt.hasClass('toggle-active') ? tgt.removeClass('toggle-active') : tgt.addClass('toggle-active');
        // });

        // *** Items : add, edit, delete, curriculum ***
        html.find(".item-add").on("click", (event) => {
            this._addSubItem(event);
        });
        html.find(`.item-edit`).on("click", (event) => {
            this._editSubItem(event);
        });
        html.find(`.item-delete`).on("click", (event) => {
            this._deleteSubItem(event);
        });
        html.find(`.item-curriculum`).on("click", (event) => {
            this._switchSubItemCurriculum(event);
        });
    }

    /**
     * Add a generic item with sub type
     * @private
     */
    async _addSubItem(event) {
        const type = $(event.currentTarget).data("item-type");
        const titles = {
            item: "l5r5e.items.title_new",
            armor: "l5r5e.armors.title_new",
            weapon: "l5r5e.weapons.title_new",
            technique: "l5r5e.techniques.title_new",
            peculiarity: "l5r5e.peculiarities.title_new",
            advancement: "l5r5e.advancements.title_new",
        };
        const created = await this.actor.createEmbeddedEntity("OwnedItem", {
            name: game.i18n.localize(titles[type]),
            type: type,
        });
        const item = this.actor.getOwnedItem(created._id);
        item.sheet.render(true);
    }

    /**
     * Edit a generic item with sub type
     * @private
     */
    _editSubItem(event) {
        const itemId = $(event.currentTarget).data("item-id");
        const item = this.actor.getOwnedItem(itemId);
        item.sheet.render(true);
    }

    /**
     * Delete a generic item with sub type
     * @private
     */
    _deleteSubItem(event, type) {
        const itemId = $(event.currentTarget).data("item-id");
        return this.actor.deleteOwnedItem(itemId);
    }

    /**
     * Switch "in_curriculum"
     * @private
     */
    _switchSubItemCurriculum(event) {
        const itemId = $(event.currentTarget).data("item-id");
        const item = this.actor.getOwnedItem(itemId);
        if (item.type !== "item") {
            item.update({
                data: {
                    in_curriculum: !item.data.data.in_curriculum,
                },
            });
        }
    }
}
