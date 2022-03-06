import { BaseItemSheetL5r5e } from "./base-item-sheet.js";

/**
 * Extend BaseItemSheetL5r5e with modifications for objects
 * @extends {ItemSheet}
 */
export class ItemSheetL5r5e extends BaseItemSheetL5r5e {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "item"],
            template: CONFIG.l5r5e.paths.templates + "items/item/item-sheet.html",
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

        sheetData.data.ringsList = game.l5r5e.HelpersL5r5e.getRingsList();

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

        if (Array.isArray(sheetData.data.data.properties)) {
            const props = [];
            for (const property of sheetData.data.data.properties) {
                const gameProp = await game.l5r5e.HelpersL5r5e.getObjectGameOrPack({ id: property.id, type: "Item" });
                if (gameProp) {
                    sheetData.data.propertiesList.push(gameProp);
                    props.push({ id: gameProp.id, name: gameProp.name });
                } else {
                    // Item not found
                    console.warn(`L5R5E | Unknown property id[${property.id}], name[${property.name}]`);
                    sheetData.data.propertiesList.push({
                        id: property.id,
                        name: property.name,
                        type: "property",
                        img: "systems/l5r5e/assets/icons/items/property.svg",
                        removed: true,
                    });
                }
            }
            sheetData.data.data.properties = props;
        }
    }

    /**
     * Subscribe to events from the sheet.
     * @param {jQuery} html HTML content of the sheet.
     * @override
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.isEditable) {
            return;
        }

        // Delete a property
        html.find(`.property-delete`).on("click", this._deleteProperty.bind(this));
    }

    /**
     * Create drag-and-drop workflow handlers for this Application
     * @return {DragDrop[]} An array of DragDrop handlers
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
        if (!this.isEditable) {
            return;
        }

        // Check item type and subtype
        let item = await game.l5r5e.HelpersL5r5e.getDragnDropTargetObject(event);
        if (!item || item.documentName !== "Item") {
            return;
        }

        // If we are a property, the child id need to be different to parent
        if (this.item.type === "property" && this.item.id === item.data._id) {
            return;
        }

        // Specific ItemPattern's drop, get the associated props instead
        if (item.data.type === "item_pattern" && item.data.data.linked_property_id) {
            item = await game.l5r5e.HelpersL5r5e.getObjectGameOrPack({
                id: item.data.data.linked_property_id,
                type: "Item",
            });
        }

        // Final object has to be a property
        if (item.data.type !== "property") {
            return;
        }

        // Ok add item
        this._addProperty(item);
    }

    /**
     * Add a property to the current item
     * @param {Item} item
     * @private
     */
    _addProperty(item) {
        if (!Array.isArray(this.document.data.data.properties)) {
            this.document.data.data.properties = [];
        }

        if (this.document.data.data.properties.findIndex((p) => p.id === item.id) !== -1) {
            return;
        }

        this.document.data.data.properties.push({ id: item.id, name: item.name });

        // This props remove others ?
        if (Array.isArray(item.data.data.properties) && item.data.data.properties.length > 0) {
            const idsToRemove = item.data.data.properties.map((e) => e.id);
            this.document.data.data.properties = this.document.data.data.properties.filter(
                (p) => !idsToRemove.includes(p.id)
            );
        }

        this.document.update({
            data: {
                properties: this.document.data.data.properties,
            },
        });
    }

    /**
     * Delete a property from the current item
     * @param {Event} event
     * @return {Promise<void>}
     * @private
     */
    _deleteProperty(event) {
        event.preventDefault();
        event.stopPropagation();

        if (!Array.isArray(this.document.data.data.properties)) {
            return;
        }

        const id = $(event.currentTarget).parents(".property").data("propertyId");
        const tmpProps = this.document.data.data.properties.find((p) => p.id === id);
        if (!tmpProps) {
            return;
        }

        const callback = async () => {
            this.document.data.data.properties = this.document.data.data.properties.filter((p) => p.id !== id);
            this.document.update({
                data: {
                    properties: this.document.data.data.properties,
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
