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

    /** @inheritdoc */
    getData(options = {}) {
        const sheetData = super.getData(options);

        sheetData.data.dtypes = ["String", "Number", "Boolean"];
        sheetData.data.stances = CONFIG.l5r5e.stances;
        sheetData.data.techniquesList = game.l5r5e.HelpersL5r5e.getTechniquesList({ displayInTypes: true });

        // Sort Items by name
        sheetData.items.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        // Split Techniques by types
        sheetData.data.splitTechniquesList = this._splitTechniques(sheetData);

        // Split Items by types
        sheetData.data.splitItemsList = this._splitItems(sheetData);

        return sheetData;
    }

    /**
     * Split Techniques by types for better readability
     * @private
     */
    _splitTechniques(sheetData) {
        const out = {};
        const schoolTechniques = Array.from(CONFIG.l5r5e.techniques)
            .filter(([id, cfg]) => cfg.type === "school")
            .map(([id, cfg]) => id);

        // Build the list order
        Array.from(CONFIG.l5r5e.techniques).forEach(([id, cfg]) => {
            out[id] = [];
        });

        // Add tech the character knows
        sheetData.items.forEach((item) => {
            switch (item.type) {
                case "technique":
                    out[item.data.technique_type].push(item);
                    break;

                case "title":
                    // Embed technique in titles
                    Array.from(item.data.items).forEach(([id, embedItem]) => {
                        if (embedItem.data.type === "technique") {
                            out[embedItem.data.data.technique_type].push(embedItem.data);
                        }
                    });

                    // If unlocked, add the "title_ability" as technique (or always displayed for npc)
                    if (item.data.xp_used >= item.data.xp_cost || this.document.type === "npc") {
                        out["title_ability"].push(item);
                    }
                    break;
            } //swi
        });

        // Remove unused techs
        Object.keys(out).forEach((tech) => {
            if (out[tech].length < 1 && !sheetData.data.data.techniques[tech] && !schoolTechniques.includes(tech)) {
                delete out[tech];
            }
        });

        // Manage school add button
        sheetData.data.data.techniques["school_ability"] = out["school_ability"].length === 0;
        sheetData.data.data.techniques["mastery_ability"] = out["mastery_ability"].length === 0;

        // Always display "school_ability", but display a empty "mastery_ability" field only if rank >= 5
        if (sheetData.data.data.identity?.school_rank < 5 && out["mastery_ability"].length === 0) {
            delete out["mastery_ability"];
        }

        return out;
    }

    /**
     * Split Items by types for better readability
     * @private
     */
    _splitItems(sheetData) {
        const out = {
            weapon: [],
            armor: [],
            item: [],
        };

        sheetData.items.forEach((item) => {
            if (["item", "armor", "weapon"].includes(item.type)) {
                out[item.type].push(item);
            }
        });

        return out;
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
     * @param {DragEvent} event
     */
    async _onDrop(event) {
        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.options.editable) {
            return;
        }

        // Check item type and subtype
        let item = await game.l5r5e.HelpersL5r5e.getDragnDropTargetObject(event);
        if (
            !item ||
            item.documentName !== "Item" ||
            ![
                "item",
                "armor",
                "weapon",
                "technique",
                "peculiarity",
                "advancement",
                "title",
                "bond",
                "signature_scroll",
                "item_pattern",
            ].includes(item.data.type)
        ) {
            return;
        }

        // Dropped a item with same "id" as one owned, add qte instead
        if (item.data.data.quantity && this.actor.data.items) {
            const tmpItem = this.actor.data.items.find((e) => e.name === item.data.name && e.type === item.data.type);
            if (tmpItem && this._modifyQuantity(tmpItem.id, 1)) {
                return;
            }
        }

        // Item subtype specific
        switch (item.data.type) {
            case "bond": // no break
            case "peculiarity": // no break
            case "item_pattern": // no break
            case "signature_scroll":
                // Modify the bought at rank to the current actor rank
                if (this.actor.data.data.identity?.school_rank) {
                    item.data.data.bought_at_rank = this.actor.data.data.identity.school_rank;
                }
                break;

            case "advancement":
                // Modify the bought at rank to the current actor rank
                if (this.actor.data.data.identity?.school_rank) {
                    item.data.data.bought_at_rank = this.actor.data.data.identity.school_rank;
                }

                // Specific advancements, remove 1 to selected ring/skill
                await this.actor.addBonus(item);
                break;

            case "title":
                // Add embed advancements bonus
                for (let [embedId, embedItem] of item.data.data.items) {
                    if (embedItem.data.type === "advancement") {
                        await this.actor.addBonus(embedItem);
                    }
                }
                break;

            case "technique":
                // School_ability and mastery_ability, allow only 1 per type
                if (CONFIG.l5r5e.techniques.get(item.data.data.technique_type)?.type === "school") {
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

        return this._onDropItemCreate(item.data.toJSON());
    }

    /**
     * Subscribe to events from the sheet.
     * @param {jQuery} html HTML content of the sheet.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Toggle
        html.find(".toggle-on-click").on("click", (event) => {
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
            let skillId = li.data("skill") || null;

            const weaponId = li.data("weapon-id") || null;
            if (weaponId) {
                skillId = this._getWeaponSkillId(weaponId);
            }

            new game.l5r5e.DicePickerDialog({
                ringId: li.data("ring") || null,
                skillId: skillId,
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
            this._switchPrepared();
        });

        // Equipped / Readied
        html.find(".equip-readied-control").on("click", this._switchEquipReadied.bind(this));

        // *** Items : add, edit, delete ***
        html.find(".item-add").on("click", this._addSubItem.bind(this));
        html.find(`.item-edit`).on("click", this._editSubItem.bind(this));
        html.find(`.item-delete`).on("click", this._deleteSubItem.bind(this));

        // Others Advancements
        html.find(".item-advancement-choose").on("click", this._showDialogAddSubItem.bind(this));
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
     * @param {string}      type           Item sub type (armor, weapon, bond...)
     * @param {boolean}     isEquipped     For item with prop "Equipped" set the value
     * @param {string|null} techniqueType  Technique subtype (kata, shuji...)
     * @return {Promise<void>}
     * @private
     */
    async _createSubItem({ type, isEquipped = false, techniqueType = null }) {
        if (!type) {
            return;
        }

        const created = await this.actor.createEmbeddedDocuments("Item", [
            {
                name: game.i18n.localize(`ITEM.Type${type.capitalize()}`),
                type: type,
                img: `${CONFIG.l5r5e.paths.assets}icons/items/${type}.svg`,
            },
        ]);
        if (created?.length > 0) {
            return;
        }
        const item = this.actor.items.get(created[0].id);

        // assign current school rank to the new adv/tech
        if (this.actor.data.data.identity?.school_rank) {
            item.data.data.bought_at_rank = this.actor.data.data.identity.school_rank;
            if (["advancement", "technique"].includes(item.data.type)) {
                item.data.data.rank = this.actor.data.data.identity.school_rank;
            }
        }

        switch (item.data.type) {
            case "item": // no break
            case "armor": // no break
            case "weapon":
                item.data.data.equipped = isEquipped;
                break;

            case "technique": {
                // If technique, select the current type
                if (CONFIG.l5r5e.techniques.get(techniqueType)) {
                    item.data.data.technique_type = techniqueType;
                    item.data.img = `${CONFIG.l5r5e.paths.assets}icons/techs/${techniqueType}.svg`;
                }
                break;
            }
        }

        item.sheet.render(true);
    }

    /**
     * Display a dialog to choose what Item to add
     * @param {Event} event
     * @return {Promise<void>}
     * @private
     */
    async _showDialogAddSubItem(event) {
        game.l5r5e.HelpersL5r5e.showSubItemDialog(["bond", "title", "signature_scroll", "item_pattern"]).then(
            (selectedType) => {
                this._createSubItem({ type: selectedType });
            }
        );
    }

    /**
     * Add a generic item with sub type
     * @param {Event} event
     * @private
     */
    async _addSubItem(event) {
        event.preventDefault();
        event.stopPropagation();

        const type = $(event.currentTarget).data("item-type");
        if (!type) {
            return;
        }

        const isEquipped = $(event.currentTarget).data("item-equipped") || false;
        const techniqueType = $(event.currentTarget).data("tech-type") || null;

        return this._createSubItem({ type, isEquipped, techniqueType });
    }

    /**
     * Edit a generic item with sub type
     * @param {Event} event
     * @private
     */
    _editSubItem(event) {
        event.preventDefault();
        event.stopPropagation();

        let item;
        const itemId = $(event.currentTarget).data("item-id");
        if (!itemId) {
            return;
        }

        const itemParentId = $(event.currentTarget).data("item-parent-id");
        if (itemParentId) {
            // Embed Item
            const parentItem = this.actor.items.get(itemParentId);
            if (!parentItem) {
                return;
            }
            item = parentItem.items.get(itemId);
        } else {
            // Regular item
            item = this.actor.items.get(itemId);
        }

        if (!item) {
            return;
        }
        item.sheet.render(true);
    }

    /**
     * Delete a generic item with sub type
     * @param {Event} event
     * @private
     */
    _deleteSubItem(event) {
        event.preventDefault();
        event.stopPropagation();

        const itemId = $(event.currentTarget).data("item-id");
        if (!itemId) {
            return;
        }

        const tmpItem = this.actor.items.get(itemId);
        if (!tmpItem) {
            return;
        }

        // Remove 1 qty if possible
        if (tmpItem.data.data.quantity > 1 && this._modifyQuantity(tmpItem.id, -1)) {
            return;
        }

        const callback = async () => {
            switch (tmpItem.type) {
                case "advancement":
                    // Remove advancements bonus (1 to selected ring/skill)
                    await this.actor.removeBonus(tmpItem);
                    break;

                case "title":
                    // Remove embed advancements bonus
                    for (let [embedId, embedItem] of tmpItem.data.data.items) {
                        if (embedItem.data.type === "advancement") {
                            await this.actor.removeBonus(embedItem);
                        }
                    }
                    break;
            }
            return this.actor.deleteEmbeddedDocuments("Item", [itemId]);
        };

        // Holing Ctrl = without confirm
        if (event.ctrlKey) {
            return callback();
        }

        game.l5r5e.HelpersL5r5e.confirmDeleteDialog(
            game.i18n.format("l5r5e.global.delete_confirm", { name: tmpItem.name }),
            callback
        );
    }

    /**
     * Switch "in_curriculum"
     * @param {Event} event
     * @private
     */
    _switchSubItemCurriculum(event) {
        const itemId = $(event.currentTarget).data("item-id");
        const item = this.actor.items.get(itemId);
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
        const tmpItem = this.actor.items.get(itemId);
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
     * @param {Event} event
     * @private
     */
    _switchEquipReadied(event) {
        event.preventDefault();
        event.stopPropagation();

        const type = $(event.currentTarget).data("type");
        if (!["equipped", "readied"].includes(type)) {
            return;
        }

        const itemId = $(event.currentTarget).data("item-id");
        const tmpItem = this.actor.items.get(itemId);
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

    /**
     * Get the skillId for this weaponId
     * @private
     */
    _getWeaponSkillId(weaponId) {
        const item = this.actor.items.get(weaponId);
        if (!!item && item.type === "weapon") {
            return item.data.data.skill;
        }
        return null;
    }
}
