export class ItemL5r5e extends Item {
    /**
     * Create a new entity using provided input data
     * @override
     */
    static async create(data, options = {}) {
        if (data.img === undefined) {
            data.img = `${CONFIG.l5r5e.paths.assets}icons/items/${data.type}.svg`;
        }
        return super.create(data, options);
    }
}
