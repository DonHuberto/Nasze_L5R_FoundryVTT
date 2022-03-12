import { BaseSheetL5r5e } from "./base-sheet.js";

/**
 * Base Sheet for Character types (Character and Npc)
 */
export class BaseCharacterSheetL5r5e extends BaseSheetL5r5e {
    /**
     * Commons options
     */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
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

        sheetData.data.stances = CONFIG.l5r5e.stances;
        sheetData.data.techniquesList = game.l5r5e.HelpersL5r5e.getTechniquesList({ displayInTypes: true });

        // Split Techniques by types
        sheetData.data.splitTechniquesList = this._splitTechniques(sheetData);

        // Split Items by types
        sheetData.data.splitItemsList = this._splitItems(sheetData);

        // Store infos for this app (collapsible)
        sheetData.data.storeInfos = game.l5r5e.storage.getAppKeys(this.id);

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
        Array.from(CONFIG.l5r5e.techniques)
            .filter(([id, cfg]) => cfg.type !== "custom" || game.settings.get("l5r5e", "techniques-customs"))
            .forEach(([id, cfg]) => {
                out[id] = [];
            });

        // Add tech the character knows
        sheetData.items.forEach((item) => {
            switch (item.type) {
                case "technique":
                    if (!out[item.data.technique_type]) {
                        console.warn(
                            `L5R5E | Empty or unknown technique type[${item.data.technique_type}] forced to "kata" in item id[${item._id}], name[${item.name}]`
                        );
                        item.data.technique_type = "kata";
                    }
                    out[item.data.technique_type].push(item);
                    break;

                case "title":
                    // Embed technique in titles
                    Array.from(item.data.items).forEach(([id, embedItem]) => {
                        if (embedItem.data.type === "technique") {
                            if (!out[embedItem.data.data.technique_type]) {
                                console.warn(
                                    `L5R5E | Empty or unknown technique type[${embedItem.data.data.technique_type}] forced to "kata" in item id[${id}], name[${embedItem.data.name}], parent: id[${item._id}], name[${item.name}]`
                                );
                                embedItem.data.data.technique_type = "kata";
                            }
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
     * Handle dropped data on the Actor sheet
     * @param {DragEvent} event
     */
    async _onDrop(event) {
        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.isEditable || this.actor.data.data.soft_locked) {
            return;
        }

        // Check item type and subtype
        const item = await game.l5r5e.HelpersL5r5e.getDragnDropTargetObject(event);
        if (!item || !["Item", "JournalEntry"].includes(item.documentName) || item.data.type === "property") {
            return;
        }

        // Specific curriculum journal drop
        if (item.documentName === "JournalEntry") {
            // npc does not have this
            if (!this.actor.data.data.identity?.school_curriculum_journal) {
                return;
            }
            this.actor.data.data.identity.school_curriculum_journal = {
                id: item.data._id,
                name: item.data.name,
                pack: item.pack || null,
            };
            await this.actor.update({
                data: {
                    identity: {
                        school_curriculum_journal: this.actor.data.data.identity.school_curriculum_journal,
                    },
                },
            });
            return;
        }

        // Dropped a item with same "id" as one owned
        if (this.actor.data.items) {
            // Exit if we already owned exactly this id (drag a personal item on our own sheet)
            if (
                this.actor.data.items.some((embedItem) => {
                    // Search in children
                    if (embedItem.items instanceof Map && embedItem.items.has(item.data._id)) {
                        return true;
                    }
                    return embedItem.data._id === item.data._id;
                })
            ) {
                return;
            }

            // Add quantity instead if they have (id is different so use type and name)
            if (item.data.data.quantity) {
                const tmpItem = this.actor.data.items.find(
                    (embedItem) => embedItem.name === item.data.name && embedItem.type === item.data.type
                );
                if (tmpItem && this._modifyQuantity(tmpItem.id, 1)) {
                    return;
                }
            }
        }

        // Can add the item - Foundry override cause props
        const allowed = Hooks.call("dropActorSheetData", this.actor, this, item);
        if (allowed === false) {
            return;
        }

        let itemData = item.data.toObject(true);

        // Item subtype specific
        switch (itemData.type) {
            case "army_cohort":
            case "army_fortification":
                console.warn("L5R5E | Army items are not allowed", item?.data?.type, item);
                return;

            case "advancement":
                // Specific advancements, remove 1 to selected ring/skill
                await this.actor.addBonus(item);
                break;

            case "title":
                // Generate new Ids for the embed items
                await item.generateNewIdsForAllEmbedItems();

                // Add embed advancements bonus
                for (let [embedId, embedItem] of item.data.data.items) {
                    if (embedItem.data.type === "advancement") {
                        await this.actor.addBonus(embedItem);
                    }
                }

                // refresh data
                itemData = item.data.toObject(true);
                break;

            case "technique":
                // School_ability and mastery_ability, allow only 1 per type
                if (CONFIG.l5r5e.techniques.get(itemData.data.technique_type)?.type === "school") {
                    if (
                        Array.from(this.actor.items).some((e) => {
                            return (
                                e.type === "technique" && e.data.data.technique_type === itemData.data.technique_type
                            );
                        })
                    ) {
                        ui.notifications.info(game.i18n.localize("l5r5e.techniques.only_one"));
                        return;
                    }

                    // No cost for schools
                    itemData.data.xp_cost = 0;
                    itemData.data.xp_used = 0;
                    itemData.data.in_curriculum = true;
                } else {
                    // Check if technique is allowed for this character
                    if (!game.user.isGM && !this.actor.data.data.techniques[itemData.data.technique_type]) {
                        ui.notifications.info(game.i18n.localize("l5r5e.techniques.not_allowed"));
                        return;
                    }

                    // Verify cost
                    itemData.data.xp_cost =
                        itemData.data.xp_cost > 0 ? itemData.data.xp_cost : CONFIG.l5r5e.xp.techniqueCost;
                    itemData.data.xp_used = itemData.data.xp_cost;
                }
                break;
        }

        // Modify the bought at rank to the current actor rank
        if (itemData.data.bought_at_rank !== undefined && this.actor.data.data.identity?.school_rank) {
            itemData.data.bought_at_rank = this.actor.data.data.identity.school_rank;
        }

        // Finally create the embed
        return this.actor.createEmbeddedDocuments("Item", [itemData]);
    }

    /**
     * Subscribe to events from the sheet.
     * @param {jQuery} html HTML content of the sheet.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.isEditable) {
            return;
        }

        // Dice event on Skills clic
        html.find(".dice-picker").on("click", this._openDicePickerForSkill.bind(this));

        // Dice event on Technique clic
        html.find(".dice-picker-tech").on("click", this._openDicePickerForTechnique.bind(this));

        // Prepared (Initiative)
        html.find(".prepared-control").on("click", this._switchPrepared.bind(this));

        // Equipped / Readied
        html.find(".equip-readied-control").on("click", this._switchEquipReadied.bind(this));

        // Others Advancements
        html.find(".item-advancement-choose").on("click", this._showDialogAddSubItem.bind(this));

        // Fatigue/Strife +/-
        html.find(".addsub-control").on("click", this._modifyFatigueOrStrife.bind(this));
    }

    /**
     * Switch the state "prepared" (initiative)
     * @param {Event} event
     * @private
     */
    _switchPrepared(event) {
        event.preventDefault();
        event.stopPropagation();

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
        if (created?.length < 1) {
            return;
        }
        const item = this.actor.items.get(created[0].id);

        // Assign current school rank to the new adv/tech
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
                // If technique, select the current sub-type
                if (CONFIG.l5r5e.techniques.get(techniqueType)) {
                    item.data.name = game.i18n.localize(`l5r5e.techniques.${techniqueType}`);
                    item.data.img = `${CONFIG.l5r5e.paths.assets}icons/techs/${techniqueType}.svg`;
                    item.data.data.technique_type = techniqueType;
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
        event.preventDefault();
        event.stopPropagation();

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
     * Add or Subtract Fatigue/Strife (+/- buttons)
     * @param {Event} event
     * @private
     */
    async _modifyFatigueOrStrife(event) {
        event.preventDefault();
        event.stopPropagation();

        const elmt = $(event.currentTarget);
        const type = elmt.data("type");
        let mod = elmt.data("value");
        if (!mod) {
            return;
        }
        switch (type) {
            case "fatigue":
                await this.actor.update({
                    data: {
                        fatigue: {
                            value: Math.max(0, this.actor.data.data.fatigue.value + mod),
                        },
                    },
                });
                break;

            case "strife":
                await this.actor.update({
                    data: {
                        strife: {
                            value: Math.max(0, this.actor.data.data.strife.value + mod),
                        },
                    },
                });
                break;

            default:
                console.warn("L5R5E | Unsupported type", type);
                break;
        }
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

    /**
     * Open the dice-picker for this skill
     * @param {Event} event
     * @private
     */
    _openDicePickerForSkill(event) {
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
    }

    /**
     * Open the dice-picker for this technique
     * @param {Event} event
     * @private
     */
    _openDicePickerForTechnique(event) {
        event.preventDefault();
        event.stopPropagation();

        const itemId = $(event.currentTarget).data("item-id") || null;
        const item = this.actor.items.get(itemId);
        if (!item || item.type !== "technique" || !item.data.data.skill) {
            return;
        }

        const itemData = item.data.data;
        new game.l5r5e.DicePickerDialog({
            actor: this.actor,
            ringId: itemData.ring || null,
            difficulty: itemData.difficulty || null,
            skillsList: itemData.skill || null,
        }).render(true);
    }
}
