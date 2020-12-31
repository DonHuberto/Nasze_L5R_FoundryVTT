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

        // Babele and properties specific
        if (item.data.data.properties && typeof Babele !== "undefined") {
            item.data.data.properties = await Promise.all(
                item.data.data.properties.map(async (property) => {
                    const gameProp = await game.l5r5e.HelpersL5r5e.getObjectGameOrPack(property.id, "Item");
                    if (gameProp) {
                        return { id: gameProp._id, name: gameProp.name };
                    }
                    return property;
                })
            );
        }

        // Item subtype specific
        switch (item.data.type) {
            case "advancement": // no break
            case "peculiarity":
                // Modify the bought at rank to the current actor rank
                item.data.data.bought_at_rank = this.actor.data.data.identity.school_rank;
                break;

            case "technique":
                // Check if technique is allowed for this character
                if (!game.user.isGM && !this.actor.data.data.techniques[item.data.data.technique_type]) {
                    new Dialog({
                        title: game.i18n.localize("l5r5e.techniques.title"),
                        content: game.i18n.localize("l5r5e.techniques.not_allowed"),
                        buttons: {
                            ok: {
                                label: game.i18n.localize("l5r5e.global.ok"),
                                icon: '<i class="fas fa-check"></i>',
                            },
                        },
                    }).render(true);
                    return;
                }

                // Modify the bought at rank to the current actor rank
                item.data.data.bought_at_rank = this.actor.data.data.identity.school_rank;

                // Verify cost
                item.data.data.xp_cost =
                    item.data.data.xp_cost > 0 ? item.data.data.xp_cost : CONFIG.l5r5e.xp.techniqueCost;
                item.data.data.xp_used = item.data.data.xp_cost;
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

        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.options.editable) {
            return;
        }

        // *** Dice event on Skills clic ***
        html.find(".dice-picker").on("click", (event) => {
            const li = $(event.currentTarget);
            new game.l5r5e.DicePickerDialog({
                skillId: li.data("skill") || null,
                skillCatId: li.data("skillcat") || null,
                difficulty: li.data("diff") || 2,
                actor: this.actor,
            }).render(true);
        });

        // On focus on one numeric element, select all text for better experience
        html.find(".select-on-focus").on("focus", (event) => {
            event.target.select();
        });

        // Toggle
        html.find(".toggle-on-click").on("click", (event) => {
            const elmt = $(event.currentTarget).data("toggle");
            const tgt = html.find("." + elmt);
            tgt.hasClass("toggle-active") ? tgt.removeClass("toggle-active") : tgt.addClass("toggle-active");
        });

        // *** Items : add, edit, delete ***
        html.find(".item-add").on("click", (event) => {
            this._addSubItem(event);
        });
        html.find(`.item-edit`).on("click", (event) => {
            this._editSubItem(event);
        });
        html.find(`.item-delete`).on("click", (event) => {
            this._deleteSubItem(event);
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

        // assign current school rank to the new adv/tech
        if (["advancement", "technique"].includes(item.data.type)) {
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
                actor.skills[skillCatId][itmData.skill] = Math.max(0, actor.skills[skillCatId][itmData.skill] - 1);
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
}
