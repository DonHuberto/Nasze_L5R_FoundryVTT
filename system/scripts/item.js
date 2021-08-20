export class ItemL5r5e extends Item {
    /**
     * A reference to the Collection of embedded Item instances in the document, indexed by _id.
     * @returns {Collection<BaseItem>}
     */
    get items() {
        return this.data.data.items || null;
    }

    /**
     * Return the linked Actor instance if any (current or embed)
     * @return {Actor|null}
     */
    get actor() {
        return super.actor || game.actors.get(this.data.data.parent_id?.actor_id) || null;
    }

    /**
     * Create a new entity using provided input data
     * @override
     */
    static async create(data, context = {}) {
        if (data.img === undefined) {
            data.img = `${CONFIG.l5r5e.paths.assets}icons/items/${data.type}.svg`;
        }
        return super.create(data, context);
    }

    /**
     * Update this Document using incremental data, saving it to the database.
     * @see {@link Document.updateDocuments}
     * @param {object} [data={}]                  Differential update data which modifies the existing values of this document data
     * @param {DocumentModificationContext} [context={}] Additional context which customizes the update workflow
     * @returns {Promise<Document>}               The updated Document instance
     */
    async update(data = {}, context = {}) {
        // Regular
        if (!this.data.data.parent_id) {
            return super.update(data, context);
        }

        // **** Embed Items, need to get the parents ****
        const parentItem = this.getItemFromParentId();
        if (!parentItem) {
            console.warn(`L5R5E | Embed parentItem not found`);
            return;
        }

        // Merge (DocumentData cannot be set)
        const result = foundry.utils.mergeObject(this.data, foundry.utils.expandObject(data));
        if (result.name) {
            this.data.name = result.name;
        }
        if (result.img) {
            this.data.img = result.img;
        }
        if (result.data) {
            this.data.data = result.data;
        }

        // Update
        await parentItem.updateEmbedItem(this.data.toObject(false));

        // Return new value for sheet
        return new Promise((resolve) => resolve(this));
    }

    /** @override */
    prepareData() {
        super.prepareData();

        // Prepare Embed items
        if (!(this.data.data.items instanceof Map)) {
            const itemsData = Array.isArray(this.data.data.items) ? this.data.data.items : [];
            this.data.data.items = new Map();

            itemsData.forEach((item) => {
                this.addEmbedItem(item, { save: false, newId: false, addBonusToActor: false });
            });
        }

        // Sanitize some values
        if (this.data.type === "weapon") {
            this.data.data.range = this.data.data.range || 0;
            this.data.data.damage = this.data.data.damage || 0;
            this.data.data.deadliness = this.data.data.deadliness || 0;
        }
    }

    // ***** parent ids management *****
    /**
     * Return a string with idemId + actorId if any
     * @return {{item_id: (string|null), actor_id?: (string|null)}}
     */
    getParentsIds() {
        const parent = {
            item_id: this.id,
        };
        if (this.actor?.data?._id) {
            parent.actor_id = this.actor.data._id;
        }
        return parent;
    }

    /**
     * Return the Item Object for the "parentId"
     * @return {ItemL5r5e|null}
     */
    getItemFromParentId() {
        const parentIds = this.data.data.parent_id;
        let parentItem;

        if (parentIds?.actor_id) {
            // Actor item object
            const parentActor = parentIds.actor_id ? game.actors.get(parentIds.actor_id) : null;
            parentItem = parentActor?.items.get(parentIds.item_id);
        } else if (parentIds?.item_id) {
            // World Object
            parentItem = game.items.get(parentIds.item_id);
        }

        return parentItem;
    }

    /**
     * Render the text template for this Item (tooltips and chat)
     * @return {Promise<string|null>}
     */
    async renderTextTemplate() {
        const type = this.type.replace("_", "-"); // ex: item_pattern
        await game.l5r5e.HelpersL5r5e.refreshItemProperties(this);
        const tpl = await renderTemplate(`${CONFIG.l5r5e.paths.templates}items/${type}/${type}-text.html`, this);
        if (!tpl) {
            return null;
        }
        return tpl;
    }

    // ***** Embedded items management *****
    /**
     * Shortcut for this.data.data.items.get
     * @param id
     * @return {ItemL5r5e|null}
     */
    getEmbedItem(id) {
        return this.items?.get(id) || null;
    }

    /**
     * Add a Embed Item
     * @param {ItemL5r5e} item Object to add
     * @param {boolean} save   if we save in db or not (used internally)
     * @param {boolean} newId  if we change the id
     * @param {boolean} addBonusToActor if we update the actor bonus for advancements
     * @return {Promise<string>}
     */
    async addEmbedItem(item, { save = true, newId = true, addBonusToActor = true } = {}) {
        if (!item) {
            return;
        }

        if (!(item instanceof Item) && item?.name && item?.type) {
            // Data -> Item
            item = new ItemL5r5e(item);
        }

        // New id
        if (newId) {
            item.data._id = foundry.utils.randomID();
        }

        // Copy the parent permission to the sub item
        item.data.permission = this.data.permission;

        // Tag parent (flags won't work as we have no id in db)
        item.data.data.parent_id = this.getParentsIds();

        // Object
        this.data.data.items.set(item.data._id, item);

        // Add bonus to actor
        if (addBonusToActor) {
            const actor = this.actor;
            if (item instanceof Item && actor instanceof Actor) {
                actor.addBonus(item);
            }
        }

        if (save) {
            await this.saveEmbedItems();
        }
        return item.data._id;
    }

    /**
     * Update a Embed Item
     * @param {ItemL5r5e} item Object to add
     * @param {boolean} save   if we save in db or not (used internally)
     * @return {Promise<string>}
     */
    async updateEmbedItem(item, { save = true } = {}) {
        return await this.addEmbedItem(item, { save, newId: false, addBonusToActor: false });
    }

    /**
     * Delete the Embed Item and clear the actor bonus if any
     * @param id Item id
     * @param {boolean} save   if we save in db or not (used internally)
     * @param {boolean} removeBonusFromActor if we update the actor bonus for advancements
     * @return {Promise<void>}
     */
    async deleteEmbedItem(id, { save = true, removeBonusFromActor = true } = {}) {
        if (!this.data.data.items.has(id)) {
            return;
        }

        // Remove bonus from actor
        if (removeBonusFromActor) {
            const actor = this.actor;
            const item = this.data.data.items.get(id);
            if (item instanceof Item && actor instanceof Actor) {
                actor.removeBonus(item);
            }
        }

        // Remove the embed item
        this.data.data.items.delete(id);

        if (save) {
            await this.saveEmbedItems();
        }
    }

    /**
     * Generate new Ids for the embed items
     * @return {Promise<void>}
     */
    async generateNewIdsForAllEmbedItems() {
        // Clear olds ids
        const oldItems = Array.from(this.data.data.items);
        this.data.data.items = new Map();

        // Re-add with new ids
        oldItems.forEach(([id, item]) => {
            this.addEmbedItem(item, { save: false, newId: true, addBonusToActor: false });
        });

        return this.saveEmbedItems();
    }

    /**
     * Save all the Embed Items
     * @return {Promise<void>}
     */
    async saveEmbedItems() {
        await this.update({
            "data.items": Array.from(this.data.data.items).map(([id, item]) => item.data.toObject(false)),
        });
        this.sheet.render(false);
    }
}
