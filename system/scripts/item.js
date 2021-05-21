export class ItemL5r5e extends Item {
    /**
     * A reference to the Collection of embedded Item instances in the document, indexed by _id.
     * @returns {Collection<BaseItem>}
     */
    get items() {
        return this.data.data.items || null;
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
        if (!this.data.data.parentId) {
            return super.update(data, context);
        }

        // **** Embed Items, need to get the parents ****
        const parentItem = this.getItemFromParentId();
        if (!parentItem) {
            console.warn(`Embed parentItem not found`);
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
                this.addEmbedItem(item, { save: false, newId: false });
            });
        }
    }

    // ***** parent ids management *****
    /**
     * Return a string with idemId + actorId if any
     * @return {string} itemId|actor
     */
    getParentsIds() {
        return this.id + (this.actor?.data?._id ? `|${this.actor.data._id}` : "");
    }

    /**
     * Return the Item Object for the "parentId"
     * @return {ItemL5r5e|null}
     */
    getItemFromParentId() {
        let parentItem;
        let [parentItemId, parentActorId] = this.data.data.parentId.split("|");

        if (parentActorId) {
            // Actor item object
            const parentActor = parentActorId ? game.actors.get(parentActorId) : null;
            parentItem = parentActor?.items.get(parentItemId);
        } else {
            // World Object
            parentItem = game.items.get(parentItemId);
        }
        return parentItem;
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
     * @return {Promise<void>}
     */
    async addEmbedItem(item, { save = true, newId = true } = {}) {
        if (!item) {
            return;
        }

        if (!(item instanceof Item) && item._id) {
            // Data -> Item
            item = new ItemL5r5e(item);
        }

        // New id
        if (newId) {
            item.data._id = foundry.utils.randomID();
        }

        // Tag parent (flags won't work as we have no id in db)
        item.data.data.parentId = this.getParentsIds();

        // Object
        this.data.data.items.set(item.data._id, item);

        // TODO add bonus from actor
        if (this.actor instanceof Actor) {
            // const item = this.data.data.items.get(id);
        }

        if (save) {
            await this.saveEmbedItems();
        }
    }

    /**
     * Update a Embed Item
     * @param {ItemL5r5e} item Object to add
     * @param {boolean} save   if we save in db or not (used internally)
     * @return {Promise<void>}
     */
    async updateEmbedItem(item, { save = true } = {}) {
        await this.addEmbedItem(item, { save, newId: false });
    }

    /**
     * Delete the Embed Item and clear the actor bonus if any
     * @param {ItemL5r5e} item Object to add
     * @param {boolean} save   if we save in db or not (used internally)
     * @return {Promise<void>}
     */
    async deleteEmbedItem(id, { save = true } = {}) {
        if (!this.data.data.items.has(id)) {
            return;
        }

        // TODO remove bonus from actor
        if (this.actor instanceof Actor) {
            // const item = this.data.data.items.get(id);
        }

        // Remove the embed item
        this.data.data.items.delete(id);

        if (save) {
            await this.saveEmbedItems();
        }
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
