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

    /** @override */
    async getData() {
        const sheetData = super.getData();

        sheetData.data.dtypes = ["String", "Number", "Boolean"];
        sheetData.data.ringsList = game.l5r5e.HelpersL5r5e.getRingsList();
        sheetData.data.techniquesList = game.l5r5e.HelpersL5r5e.getTechniquesList();

        // Prepare Properties (id/name => object)
        await this._prepareProperties(sheetData);

        return sheetData;
    }

    /**
     * Prepare properties list
     * @private
     */
    async _prepareProperties(sheetData) {
        sheetData.data.propertiesList = [];

        if (Array.isArray(sheetData.data.properties)) {
            const props = [];
            for (const property of sheetData.data.properties) {
                const gameProp = await game.l5r5e.HelpersL5r5e.getObjectGameOrPack(property.id, "Item");
                if (gameProp) {
                    sheetData.data.propertiesList.push(gameProp);
                    props.push({ id: gameProp._id, name: gameProp.name });
                }
            }
            sheetData.data.properties = props;
        }
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

        // Toggle
        html.find(".toggle-on-click").on("click", (event) => {
            const elmt = $(event.currentTarget).data("toggle");
            const tgt = html.find("." + elmt);
            tgt.hasClass("toggle-active") ? tgt.removeClass("toggle-active") : tgt.addClass("toggle-active");
        });

        // Delete a property
        html.find(`.property-delete`).on("click", (event) => {
            const li = $(event.currentTarget).parents(".property");
            this._deleteProperty(li.data("propertyId"));
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
    async _onDrop(event) {
        // Check item type and subtype
        const item = await game.l5r5e.HelpersL5r5e.getDragnDropTargetObject(event);
        if (!item || item.entity !== "Item" || item.data.type !== "property" || this.item.type === "property") {
            return;
        }

        // Ok add item
        this._addProperty(item);
    }

    /**
     * Add a property to the current item
     * @private
     */
    _addProperty(item) {
        if (!Array.isArray(this.entity.data.data.properties)) {
            this.entity.data.data.properties = [];
        }

        if (this.entity.data.data.properties.findIndex((p) => p.id === item.id) !== -1) {
            return;
        }

        this.entity.data.data.properties.push({ id: item.id, name: item.name });

        this.entity.update({
            data: {
                properties: this.entity.data.data.properties,
            },
        });
    }

    /**
     * Delete a property from the current item
     * @private
     */
    _deleteProperty(id) {
        if (
            !Array.isArray(this.entity.data.data.properties) ||
            this.entity.data.data.properties.findIndex((p) => p.id === id) === -1
        ) {
            return;
        }

        this.entity.data.data.properties = this.entity.data.data.properties.filter((p) => p.id !== id);

        this.entity.update({
            data: {
                properties: this.entity.data.data.properties,
            },
        });
    }
}
