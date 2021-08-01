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

        // Automatically compute the total xp cost (full price) and XP in title (cursus, some halved prices)
        const { xp_used_total, xp_used } = game.l5r5e.HelpersL5r5e.getItemsXpCost(sheetData.data.embedItemsList);
        sheetData.data.data.xp_used_total = xp_used_total;
        sheetData.data.data.xp_used = xp_used;

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
        if (!this.isEditable) {
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
     * @param {jQuery} html HTML content of the sheet.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) {
            return;
        }

        // *** Sub-Items management ***
        html.find(".item-add").on("click", this._addSubItem.bind(this));
        html.find(`.item-edit`).on("click", this._editSubItem.bind(this));
        html.find(`.item-delete`).on("click", this._deleteSubItem.bind(this));
        html.find(`.item-curriculum`).on("click", this._switchSubItemCurriculum.bind(this));
    }

    /**
     * Display a dialog to choose what Item to add, and add it on this Item
     * @param {Event} event
     * @return {Promise<void>}
     * @private
     */
    async _addSubItem(event) {
        event.preventDefault();
        event.stopPropagation();

        // Show Dialog
        const selectedType = await game.l5r5e.HelpersL5r5e.showSubItemDialog(["advancement", "technique"]);
        if (!selectedType) {
            return;
        }

        // Create the new Item
        const itemId = await this.document.addEmbedItem(
            new game.l5r5e.ItemL5r5e({
                name: game.i18n.localize(`ITEM.Type${selectedType.capitalize()}`),
                type: selectedType,
                img: `${CONFIG.l5r5e.paths.assets}icons/items/${selectedType}.svg`,
            })
        );

        // Get the store object and display it
        const item = this.document.items.get(itemId);
        if (item) {
            item.sheet.render(true);
        }
    }

    /**
     * Toogle the curriculum for this embed item
     * @param {Event} event
     * @return {Promise<void>}
     * @private
     */
    async _switchSubItemCurriculum(event) {
        event.preventDefault();
        event.stopPropagation();

        const itemId = $(event.currentTarget).data("item-id");
        const item = this.document.getEmbedItem(itemId);
        if (!item) {
            return;
        }

        // Switch the state and update
        item.data.data.in_curriculum = !item.data.data.in_curriculum;
        return this.document.updateEmbedItem(item);
    }
}
