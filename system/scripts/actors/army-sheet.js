import { BaseSheetL5r5e } from "./base-sheet.js";

/**
 * Sheet for Army "actor"
 */
export class ArmySheetL5r5e extends BaseSheetL5r5e {
    /**
     * Commons options
     */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "actor", "army"],
            template: CONFIG.l5r5e.paths.templates + "actors/army-sheet.html",
            width: 600,
            height: 800,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "army" }],
        });
    }

    /** @override */
    constructor(options = {}) {
        super(options);
        this._initialize();
    }

    /**
     * Initialize once
     * @private
     */
    _initialize() {
        const data = this.object.data.data;

        // update linked actor datas
        if (data.commander_actor_id) {
            const commander = game.actors.get(data.commander_actor_id);
            if (commander) {
                this._updateLinkedActorData("commander", commander, true);
            } else {
                this._removeLinkedActorData("commander");
            }
        }
        if (data.warlord_actor_id) {
            const warlord = game.actors.get(data.warlord_actor_id);
            if (warlord) {
                this._updateLinkedActorData("warlord", warlord, true);
            } else {
                this._removeLinkedActorData("warlord");
            }
        }
    }

    /**
     * Create drag-and-drop workflow handlers for this Application
     * @return An array of DragDrop handlers
     */
    _createDragDropHandlers() {
        return [
            new DragDrop({
                dropSelector: ".warlord",
                callbacks: { drop: this._onDropActors.bind(this, "warlord") },
            }),
            new DragDrop({
                dropSelector: ".commander",
                callbacks: { drop: this._onDropActors.bind(this, "commander") },
            }),
            new DragDrop({
                dropSelector: null,
                callbacks: { drop: this._onDrop.bind(this) },
            }),
        ];
    }

    /**
     * Activate a named TinyMCE text editor
     * @param {string} name             The named data field which the editor modifies.
     * @param {object} options          TinyMCE initialization options passed to TextEditor.create
     * @param {string} initialContent   Initial text content for the editor area.
     * @override
     */
    activateEditor(name, options = {}, initialContent = "") {
        if (["data.army_abilities", "data.supplies_logistics", "data.past_battles"].includes(name) && initialContent) {
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
        ["data.army_abilities", "data.supplies_logistics", "data.past_battles"].forEach((name) => {
            if (!formData[name]) {
                return;
            }
            formData[name] = game.l5r5e.HelpersL5r5e.convertSymbols(formData[name], true);
        });
        return super._updateObject(event, formData);
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

        // Casualties/Panic +/-
        html.find(".addsub-control").on("click", this._modifyCasualtiesOrPanic.bind(this));

        if (this.actor.data.data.soft_locked) {
            return;
        }

        // Delete the linked Actor (warlord/commander)
        html.find(".actor-remove-control").on("click", this._removeLinkedActor.bind(this));
    }

    /** @inheritdoc */
    getData(options = {}) {
        const sheetData = super.getData(options);

        // Split Items by types
        sheetData.data.splitItemsList = this._splitItems(sheetData);

        return sheetData;
    }

    /**
     * Split Items by types for better readability
     * @private
     */
    _splitItems(sheetData) {
        const out = {
            army_cohort: [],
            army_fortification: [],
        };

        sheetData.items.forEach((item) => {
            if (["army_cohort", "army_fortification"].includes(item.type)) {
                out[item.type].push(item);
            }
        });

        return out;
    }

    /**
     * Handle dropped Item data on the Actor sheet (cohort, fortification)
     * @param {DragEvent} event
     */
    async _onDrop(event) {
        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.isEditable || this.actor.data.data.soft_locked) {
            return;
        }

        const item = await game.l5r5e.HelpersL5r5e.getDragnDropTargetObject(event);
        if (!item || item.documentName !== "Item" || !["army_cohort", "army_fortification"].includes(item.data.type)) {
            // actor dual trigger...
            if (item?.documentName !== "Actor") {
                console.warn("L5R5E | Characters items are not allowed", item?.data?.type, item);
            }
            return;
        }

        // Can add the item - Foundry override cause props
        const allowed = Hooks.call("dropActorSheetData", this.actor, this, item);
        if (allowed === false) {
            return;
        }

        let itemData = item.data.toObject(true);

        // Finally, create the embed
        return this.actor.createEmbeddedDocuments("Item", [itemData]);
    }

    /**
     * Handle dropped Actor data on the Actor sheet
     * @param {string}    type  warlord|commander|item
     * @param {DragEvent} event
     */
    async _onDropActors(type, event) {
        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.isEditable || this.actor.data.data.soft_locked) {
            return;
        }

        const droppedActor = await game.l5r5e.HelpersL5r5e.getDragnDropTargetObject(event);
        return this._updateLinkedActorData(type, droppedActor, false);
    }

    /**
     * Remove the linked actor (commander/warlord)
     * @param {Event} event
     * @return {Promise<void>}
     * @private
     */
    async _removeLinkedActor(event) {
        event.preventDefault();
        event.stopPropagation();

        const id = $(event.currentTarget).data("actor-id");
        const type = $(event.currentTarget).data("type");
        if (!id || !type) {
            return;
        }
        return this._removeLinkedActorData(type);
    }

    /**
     * Update actor datas for this army sheet
     * @param {string}     type   commander|warlord
     * @param {ActorL5r5e} actor  actor object
     * @param {boolean}    isInit If it's initialization process
     * @return {Promise<abstract.Document>}
     * @private
     */
    async _updateLinkedActorData(type, actor, isInit = false) {
        if (!actor || actor.documentName !== "Actor" || !actor.isCharacter) {
            console.warn("L5R5E | Wrong actor type", actor?.data?.type, actor);
            return;
        }

        const actorPath = `${CONFIG.l5r5e.paths.assets}icons/actors/`;
        const actorData = {};
        switch (type) {
            case "commander":
                actorData["data.commander"] = actor.data.name;
                actorData["data.commander_actor_id"] = actor.data._id;
                actorData["data.commander_standing.honor"] = actor.data.data.social.honor;
                actorData["data.commander_standing.glory"] = actor.data.data.social.glory;
                actorData["data.commander_standing.status"] = actor.data.data.social.status;

                // Replace the image by commander's image
                if (
                    !isInit &&
                    this.actor.data.img !== actor.data.img &&
                    ![`${actorPath}character.svg`, `${actorPath}npc.svg`].includes(actor.data.img)
                ) {
                    actorData["img"] = actor.data.img;
                    actorData["token.img"] = actor.data.token.img;
                }
                break;

            case "warlord":
                actorData["data.warlord"] = actor.data.name;
                actorData["data.warlord_actor_id"] = actor.data._id;
                break;

            default:
                console.warn("L5R5E | Unknown type", type);
                return;
        }
        return this.actor.update(actorData);
    }

    /**
     * Clean ActorId for army sheet
     * @param  {string} type commander|warlord
     * @return {Promise<abstract.Document>}
     * @private
     */
    async _removeLinkedActorData(type) {
        const actorData = {};
        switch (type) {
            case "commander":
                actorData.commander_actor_id = null;
                break;

            case "warlord":
                actorData.warlord_actor_id = null;
                break;

            default:
                console.warn("L5R5E | Unknown type", type);
                return;
        }
        return this.actor.update({ data: actorData });
    }

    /**
     * Add or Subtract Casualties/Panic (+/- buttons)
     * @param {Event} event
     * @private
     */
    async _modifyCasualtiesOrPanic(event) {
        event.preventDefault();
        event.stopPropagation();

        const elmt = $(event.currentTarget);
        const type = elmt.data("type");
        let mod = elmt.data("value");
        if (!mod) {
            return;
        }
        switch (type) {
            case "casualties":
                await this.actor.update({
                    data: {
                        battle_readiness: {
                            casualties_strength: {
                                value: Math.max(
                                    0,
                                    this.actor.data.data.battle_readiness.casualties_strength.value + mod
                                ),
                            },
                        },
                    },
                });
                break;

            case "panic":
                await this.actor.update({
                    data: {
                        battle_readiness: {
                            panic_discipline: {
                                value: Math.max(0, this.actor.data.data.battle_readiness.panic_discipline.value + mod),
                            },
                        },
                    },
                });
                break;

            default:
                console.warn("L5R5E | Unsupported type", type);
                break;
        }
    }
}
