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
     * Activate a named TinyMCE text editor
     * @param {string} name             The named data field which the editor modifies.
     * @param {object} options          TinyMCE initialization options passed to TextEditor.create
     * @param {string} initialContent   Initial text content for the editor area.
     * @override
     */
    activateEditor(name, options = {}, initialContent = "") {
        if (name === "data.description" && initialContent) {
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
        if (formData["data.description"]) {
            formData["data.description"] = game.l5r5e.HelpersL5r5e.convertSymbols(formData["data.description"], true);
        }
        return super._updateObject(event, formData);
    }

    /**
     * Subscribe to events from the sheet.
     * @param html HTML content of the sheet.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Toggle
        html.find(".toggle-on-click").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const elmt = $(event.currentTarget).data("toggle");
            const tgt = html.find("." + elmt);
            tgt.toggleClass("toggle-active");
        });

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) {
            return;
        }

        // On focus on one numeric element, select all text for better experience
        html.find(".select-on-focus").on("focus", (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.target.select();
        });

        // Delete a property
        html.find(`.property-delete`).on("click", this._deleteProperty.bind(this));
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
        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) {
            return;
        }

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
    _deleteProperty(event) {
        event.preventDefault();
        event.stopPropagation();

        if (!Array.isArray(this.entity.data.data.properties)) {
            return;
        }

        const id = $(event.currentTarget).parents(".property").data("propertyId");
        const tmpProps = this.entity.data.data.properties.find((p) => p.id === id);
        if (!tmpProps) {
            return;
        }

        const callback = async () => {
            this.entity.data.data.properties = this.entity.data.data.properties.filter((p) => p.id !== id);
            this.entity.update({
                data: {
                    properties: this.entity.data.data.properties,
                },
            });
        };

        // Holing Ctrl = without confirm
        if (event.ctrlKey) {
            return callback();
        }

        game.l5r5e.HelpersL5r5e.confirmDeleteDialog(
            game.i18n.format("l5r5e.global.delete_confirm", { name: tmpProps.name }),
            callback
        );
    }
}
