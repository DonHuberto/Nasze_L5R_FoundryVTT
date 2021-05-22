import { ItemSheetL5r5e } from "./item-sheet.js";

/**
 * @extends {ItemSheet}
 */
export class TitleSheetL5r5e extends ItemSheetL5r5e {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "title"],
            template: CONFIG.l5r5e.paths.templates + "items/title/title-sheet.html",
            width: 520,
            height: 480,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
        });
    }

    /**
     * @return {Object|Promise}
     */
    async getData(options = {}) {
        const sheetData = await super.getData(options);

        // Prepare OwnedItems
        sheetData.data.embedItemsList = this._prepareEmbedItems(sheetData.data.data.items);

        // Automatically compute the xp cost
        sheetData.data.data.xp_used = sheetData.data.embedItemsList.reduce(
            (acc, item) => acc + (+item.data.xp_used || 0),
            0
        );

        return sheetData;
    }

    /**
     * Prepare Embed items
     * @param {[]|Map} itemsMap
     * @return {[]}
     * @private
     */
    _prepareEmbedItems(itemsMap) {
        let itemsList = itemsMap;
        if (itemsMap instanceof Map) {
            itemsList = Array.from(itemsMap).map(([id, item]) => item.data);
        }

        // Sort by rank desc
        itemsList.sort((a, b) => (b.data.rank || 0) - (a.data.rank || 0));

        return itemsList;
    }

    /**
     * Callback actions which occur when a dragged element is dropped on a target.
     * @param {DragEvent} event       The originating DragEvent
     * @private
     */
    async _onDrop(event) {
        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) {
            return;
        }

        // Check item type and subtype
        let item = await game.l5r5e.HelpersL5r5e.getDragnDropTargetObject(event);
        if (!item || item.documentName !== "Item" || !["technique", "advancement"].includes(item.data.type)) {
            return;
        }

        const data = item.data.toObject(false);

        // Check xp for techs
        if (item.data.type === "technique") {
            data.data.xp_cost = data.data.xp_cost > 0 ? data.data.xp_cost : CONFIG.l5r5e.xp.techniqueCost;
            data.data.xp_used = data.data.xp_cost;
        }

        this.document.addEmbedItem(data);
    }

    /**
     * Subscribe to events from the sheet.
     * @param html HTML content of the sheet.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) {
            return;
        }

        // *** Items : add, edit, delete ***
        html.find(".item-add").on("click", this._addSubItem.bind(this));
        html.find(`.item-edit`).on("click", this._editSubItem.bind(this));
        html.find(`.item-delete`).on("click", this._deleteSubItem.bind(this));
    }
}
