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
