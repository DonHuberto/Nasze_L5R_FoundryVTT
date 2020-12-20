/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class ItemSheetL5r5e extends ItemSheet {
    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "item"],
            template: CONFIG.l5r5e.paths.templates + "items/item/item-sheet.html",
            width: 520,
            height: 480,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
        });
    }

    getData() {
        const sheetData = super.getData();

        sheetData.data.dtypes = ["String", "Number", "Boolean"];
        sheetData.data.ringsList = game.l5r5e.HelpersL5r5e.getRingsList();
        sheetData.data.techniquesList = game.l5r5e.HelpersL5r5e.getTechniquesList();

        return sheetData;
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

        // On focus on one numeric element, select all text for better experience
        html.find(".select-on-focus").on("focus", (event) => {
            event.target.select();
        });
    }

    /**
     * Update the item with data from the sheet.
     * @param event
     * @param formData
     */
    _updateObject(event, formData) {
        return this.object.update(formData);
    }

    /**
     * Create drag-and-drop workflow handlers for this Application
     * @return An array of DragDrop handlers
     */
    _createDragDropHandlers() {
        return [
            new DragDrop({
                dragSelector: ".property",
                dropSelector: null,
                permissions: { dragstart: this._canDragStart.bind(this), drop: this._canDragDrop.bind(this) },
                callbacks: { dragstart: this._onDragStart.bind(this), drop: this._onDrop.bind(this) },
            }),
        ];
    }

    /**
     * Handle dropped data on the Item sheet, only "property" allowed.
     * Also a property canot be on another property
     */
    _onDrop(event) {
        // Check item type and subtype
        const item = game.l5r5e.HelpersL5r5e.getDragnDropTargetObject(event);
        if (!item || item.entity !== "Item" || item.data.type !== "property" || this.item.type === "property") {
            return Promise.resolve();
        }

        // TODO
        console.log("Item - _onDrop - ", item, this);

        // Ok add item
        // return super._onDrop(event);
    }
}
