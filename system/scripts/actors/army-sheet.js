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
            dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }],
        });
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
     * Handle dropped data on the Actor sheet
     * @param {DragEvent} event
     */
    async _onDrop(event) {
        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.isEditable) {
            return;
        }

        // Check item type and subtype
        const item = await game.l5r5e.HelpersL5r5e.getDragnDropTargetObject(event);
        if (!item || item.documentName !== "Item" || !["army_cohort", "army_fortification"].includes(item.data.type)) {
            console.warn("L5R5E | Wrong type", item?.data?.type, item);
            return;
        }

        // Can add the item - Foundry override cause props
        const allowed = Hooks.call("dropActorSheetData", this.actor, this, item);
        if (allowed === false) {
            return;
        }

        let itemData = item.data.toObject(true);

        // Finally create the embed
        return this.actor.createEmbeddedDocuments("Item", [itemData]);
    }
}
