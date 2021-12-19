import { ItemSheetL5r5e } from "./item-sheet.js";

/**
 * @extends {ItemSheetL5r5e}
 */
export class ArmyCohortSheetL5r5e extends ItemSheetL5r5e {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "army-cohort"],
            template: CONFIG.l5r5e.paths.templates + "items/army-cohort/army-cohort-sheet.html",
            width: 520,
            height: 520,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "infos" }],
            dragDrop: [{ dragSelector: ".item", dropSelector: null }],
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
        if (data.leader_actor_id) {
            const actor = game.actors.get(data.leader_actor_id);
            if (actor) {
                this._updateLinkedActorData(actor);
            } else {
                this._removeLinkedActor();
            }
        }
    }

    /**
     * Activate a named TinyMCE text editor
     * @param {string} name             The named data field which the editor modifies.
     * @param {object} options          TinyMCE initialization options passed to TextEditor.create
     * @param {string} initialContent   Initial text content for the editor area.
     * @override
     */
    activateEditor(name, options = {}, initialContent = "") {
        if (name === "data.abilities" && initialContent) {
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
        if (formData["data.abilities"]) {
            formData["data.abilities"] = game.l5r5e.HelpersL5r5e.convertSymbols(formData["data.abilities"], true);
        }
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

        // Delete the linked Actor
        html.find(".actor-remove-control").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const id = $(event.currentTarget).data("actor-id");
            if (id) {
                this._removeLinkedActor();
            }
        });
    }

    /**
     * Handle dropped Item data on the Actor sheet (cohort, fortification)
     * @param {DragEvent} event
     */
    async _onDrop(event) {
        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.isEditable) {
            return;
        }

        const droppedActor = await game.l5r5e.HelpersL5r5e.getDragnDropTargetObject(event);
        return this._updateLinkedActorData(droppedActor);
    }

    /**
     * Update actor datas for this army sheet
     * @param {ActorL5r5e} actor actor object
     * @return {Promise<abstract.Document>}
     * @private
     */
    async _updateLinkedActorData(actor) {
        if (!actor || actor.documentName !== "Actor" || !["character", "npc"].includes(actor.data?.type)) {
            console.warn("L5R5E | Wrong actor type", actor?.data?.type, actor);
            return;
        }

        return this.object.update({
            img: actor.data.img,
            data: {
                leader: actor.data.name,
                leader_actor_id: actor.data._id,
            },
        });
    }

    /**
     * Remove the linked actor (commander/warlord)
     * @return {Promise<void>}
     * @private
     */
    async _removeLinkedActor() {
        return this.object.update({
            data: {
                leader_actor_id: null,
            },
        });
    }
}
