/**
 * Base Sheet for Actor and Npc
 */
export class BaseSheetL5r5e extends ActorSheet {
    /**
     * Commons options
     */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "actor"],
            // template: CONFIG.l5r5e.paths.templates + "actors/character-sheet.html",
            width: 600,
            height: 800,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills" }],
            dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }],
        });
    }

    /**
     * Commons datas
     * @override
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
     * Activate a named TinyMCE text editor
     * @param {string} name             The named data field which the editor modifies.
     * @param {object} options          TinyMCE initialization options passed to TextEditor.create
     * @param {string} initialContent   Initial text content for the editor area.
     * @override
     */
    activateEditor(name, options = {}, initialContent = "") {
        if (name === "data.notes.value" && initialContent) {
            initialContent = game.l5r5e.HelpersL5r5e.convertSymbols(initialContent, false);
        }
        super.activateEditor(name, options, initialContent);
    }

    /**
     * This method is called upon form submission after form data is validated
     * @param event {Event}       The initial triggering submission event
     * @param formData {Object}   The object of validated form data with which to update the object
     * @returns {Promise}         A Promise which resolves once the update operation has completed
     * @override
     */
    async _updateObject(event, formData) {
        if (formData["data.notes.value"]) {
            formData["data.notes.value"] = game.l5r5e.HelpersL5r5e.convertSymbols(formData["data.notes.value"], true);
        }
        return super._updateObject(event, formData);
    }

    /**
     * Handle dropped data on the Actor sheet
     */
    async _onDrop(event) {
        // Check item type and subtype
        const item = await game.l5r5e.HelpersL5r5e.getDragnDropTargetObject(event);
        if (
            !item ||
            item.entity !== "Item" ||
            !["item", "armor", "weapon", "technique", "peculiarity", "advancement"].includes(item.data.type)
        ) {
            return;
        }

        // Dropped a item with same "id" as one owned, add qte instead
        if (item.data.data.quantity && this.actor.data.items) {
            const tmpItem = this.actor.data.items.find((e) => e.name === item.name && e.type === item.type);
            if (tmpItem && this._modifyQuantity(tmpItem._id, 1)) {
                return;
            }
        }

        // Item subtype specific
        switch (item.data.type) {
            case "advancement": // no break
            case "peculiarity":
                // Modify the bought at rank to the current actor rank
                if (this.actor.data.data.identity?.school_rank) {
                    item.data.data.bought_at_rank = this.actor.data.data.identity.school_rank;
                }
                break;

            case "technique":
                // School_ability and mastery_ability, allow only 1 per type
                if (CONFIG.l5r5e.techniques_school.includes(item.data.data.technique_type)) {
                    if (
                        Array.from(this.actor.items).some(
                            (e) =>
                                e.type === "technique" && e.data.data.technique_type === item.data.data.technique_type
                        )
                    ) {
                        ui.notifications.info(game.i18n.localize("l5r5e.techniques.only_one"));
                        return;
                    }

                    // No cost for schools
                    item.data.data.xp_cost = 0;
                    item.data.data.xp_used = 0;
                    item.data.data.in_curriculum = true;
                } else {
                    // Check if technique is allowed for this character
                    if (!game.user.isGM && !this.actor.data.data.techniques[item.data.data.technique_type]) {
                        ui.notifications.info(game.i18n.localize("l5r5e.techniques.not_allowed"));
                        return;
                    }

                    // Verify cost
                    item.data.data.xp_cost =
                        item.data.data.xp_cost > 0 ? item.data.data.xp_cost : CONFIG.l5r5e.xp.techniqueCost;
                    item.data.data.xp_used = item.data.data.xp_cost;
                }

                // Modify the bought at rank to the current actor rank
                if (this.actor.data.data.identity?.school_rank) {
                    item.data.data.bought_at_rank = this.actor.data.data.identity.school_rank;
                }
                break;
        }

        // Ok add item - Foundry override cause props
        const allowed = Hooks.call("dropActorSheetData", this.actor, this, item);
        if (allowed === false) {
            return;
        }
        return this._onDropItem(event, item);
    }

    /**
     * Subscribe to events from the sheet.
     * @param html HTML content of the sheet.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Toggle
        html.find(".toggle-on-click").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const elmt = $(event.currentTarget).data("toggle");
            const tgt = html.find("." + elmt);
            tgt.toggleClass("toggle-active");
        });

        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.options.editable) {
            return;
        }

        // *** Dice event on Skills clic ***
        html.find(".dice-picker").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const li = $(event.currentTarget);
            new game.l5r5e.DicePickerDialog({
                skillId: li.data("skill") || null,
                skillCatId: li.data("skillcat") || null,
                isInitiativeRoll: li.data("initiative") || false,
                actor: this.actor,
            }).render(true);
        });

        // On focus on one numeric element, select all text for better experience
        html.find(".select-on-focus").on("focus", (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.target.select();
        });

        // Prepared (Initiative)
        html.find(".prepared-control").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const preparedId = $(event.currentTarget).data("id");
            if (["adversary", "character"].includes(preparedId)) {
                this._switchPrepared();
            }
        });

        // Equipped / Readied
        html.find(".equip-readied-control").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this._switchEquipReadied(event);
        });

        // *** Items : add, edit, delete ***
        html.find(".item-add").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this._addSubItem(event);
        });
        html.find(`.item-edit`).on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this._editSubItem(event);
        });
        html.find(`.item-delete`).on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this._deleteSubItem(event);
        });
    }

    /**
     * Switch the state "prepared" (initiative)
     * @private
     */
    _switchPrepared() {
        this.actor.data.data.prepared = !this.actor.data.data.prepared;
        this.actor.update({
            data: {
                prepared: this.actor.data.data.prepared,
            },
        });
        this.render(false);
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
            img: "icons/svg/mystery-man.svg",
        });
        const item = this.actor.getOwnedItem(created._id);

        // assign current school rank to the new adv/tech
        if (this.actor.data.data.identity?.school_rank && ["advancement", "technique"].includes(item.data.type)) {
            item.data.data.rank = this.actor.data.data.identity.school_rank;
            item.data.data.bought_at_rank = this.actor.data.data.identity.school_rank;
        }

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
    _deleteSubItem(event) {
        const itemId = $(event.currentTarget).data("item-id");

        // Remove 1 qty if possible
        const tmpItem = this.actor.getOwnedItem(itemId);
        if (tmpItem && tmpItem.data.data.quantity > 1 && this._modifyQuantity(tmpItem._id, -1)) {
            return;
        }

        // Specific advancements, remove 1 to selected ring/skill
        if (tmpItem.type === "advancement") {
            const actor = duplicate(this.actor.data.data);
            const itmData = tmpItem.data.data;
            if (itmData.advancement_type === "ring") {
                // Ring
                actor.rings[itmData.ring] = Math.max(1, actor.rings[itmData.ring] - 1);
            } else {
                // Skill
                const skillCatId = CONFIG.l5r5e.skills.get(itmData.skill);
                if (skillCatId) {
                    actor.skills[skillCatId][itmData.skill] = Math.max(0, actor.skills[skillCatId][itmData.skill] - 1);
                }
            }

            // Update Actor
            this.actor.update({
                data: diffObject(this.actor.data.data, actor),
            });
        }

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

    /**
     * Add or subtract a quantity to a owned item
     * @private
     */
    _modifyQuantity(itemId, add) {
        const tmpItem = this.actor.getOwnedItem(itemId);
        if (tmpItem) {
            tmpItem.data.data.quantity = Math.max(1, tmpItem.data.data.quantity + add);
            tmpItem.update({
                data: {
                    quantity: tmpItem.data.data.quantity,
                },
            });
            return true;
        }
        return false;
    }

    /**
     * Switch Readied state on a weapon
     * @private
     */
    _switchEquipReadied(event) {
        const type = $(event.currentTarget).data("type");
        if (!["equipped", "readied"].includes(type)) {
            return;
        }

        const itemId = $(event.currentTarget).data("item-id");
        const tmpItem = this.actor.getOwnedItem(itemId);
        if (!tmpItem || tmpItem.data.data[type] === undefined) {
            return;
        }

        tmpItem.data.data[type] = !tmpItem.data.data[type];
        const data = {
            equipped: tmpItem.data.data.equipped,
        };
        // Only weapons
        if (tmpItem.data.data.readied !== undefined) {
            data.readied = tmpItem.data.data.readied;
        }

        tmpItem.update({ data });
    }
}
