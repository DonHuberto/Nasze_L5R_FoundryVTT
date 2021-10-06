/**
 * L5R GM Monitor Windows
 * @extends {FormApplication}
 */
export class GmMonitor extends FormApplication {
    /**
     * Settings
     */
    object = {
        actors: [],
    };

    /**
     * Assign the default options
     * @override
     */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "l5r5e-gm-monitor",
            classes: ["l5r5e", "gm-monitor"],
            template: CONFIG.l5r5e.paths.templates + "gm/gm-monitor.html",
            title: game.i18n.localize("l5r5e.gm_monitor.title"),
            width: 800,
            height: 300,
            resizable: true,
            closeOnSubmit: false,
            submitOnClose: false,
            submitOnChange: false,
            dragDrop: [{ dragSelector: null, dropSelector: null }],
        });
    }

    /**
     * Constructor
     * @param {ApplicationOptions} options
     */
    constructor(options = {}) {
        super(options);
        this._initialize();
    }

    /**
     * Refresh data (used from socket)
     */
    async refresh() {
        if (!game.user.isGM) {
            return;
        }
        this._initialize();
        this.render(false);
    }

    /**
     * Initialize the values
     * @private
     */
    _initialize() {
        let actors;
        const ids = game.settings.get("l5r5e", "gm-monitor-actors");

        if (ids.length > 0) {
            // get actors with stored ids
            actors = game.actors.filter((e) => ids.includes(e.id));
        } else {
            // If empty add pc with owner
            actors = game.actors.filter((actor) => actor.data.type === "character" && actor.hasPlayerOwner);
            this._saveActorsIds();
        }

        // Sort by name asc
        actors.sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        this.object = {
            actors,
        };
    }

    /**
     * Prevent non GM to render this windows
     * @override
     */
    render(force = false, options = {}) {
        if (!game.user.isGM) {
            return false;
        }
        return super.render(force, options);
    }

    /**
     * Construct and return the data object used to render the HTML template for this form application.
     * @param options
     * @return {Object}
     * @override
     */
    getData(options = null) {
        return {
            ...super.getData(options),
            data: this.object,
        };
    }

    /**
     * Listen to html elements
     * @param {jQuery} html HTML content of the sheet.
     * @override
     */
    activateListeners(html) {
        super.activateListeners(html);

        if (!game.user.isGM) {
            return;
        }

        // Open sheet
        html.find(`.actor-sheet-control`).on("click", this._openActorSheet.bind(this));

        // Delete
        html.find(`.actor-remove-control`).on("click", this._removeActor.bind(this));

        // Tooltips
        game.l5r5e.HelpersL5r5e.popupManager(html.find(".actor-infos-control"), async (event) => {
            const type = $(event.currentTarget).data("type");
            if (!type) {
                return;
            }
            if (type === "text") {
                return $(event.currentTarget).data("text");
            }

            const id = $(event.currentTarget).data("actor-id");
            if (!id) {
                return;
            }
            const actor = this.object.actors.find((e) => e.id === id);
            if (!actor) {
                return;
            }

            switch (type) {
                case "armors":
                    return await this._getTooltipArmors(actor);
                case "weapons":
                    return await this._getTooltipWeapons(actor);
                case "global":
                    return await this._getTooltipGlobal(actor);
            }
        });
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

        const json = event.dataTransfer.getData("text/plain");
        if (!json) {
            return;
        }
        const data = JSON.parse(json);
        if (!data || data.type !== "Actor" || !data.id || !!this.object.actors.find((e) => e.id === data.id)) {
            return;
        }

        const actor = game.actors.find((e) => e.id === data.id);
        if (!actor) {
            return;
        }

        // No armies allowed !
        if (actor.data.type === "army") {
            console.log(`L5R5E | Armies are not supported !`);
            return;
        }

        this.object.actors.push(actor);

        return this._saveActorsIds();
    }

    /**
     * Save the actors ids in settings
     * @return {Promise<*>}
     * @private
     */
    async _saveActorsIds() {
        return game.settings.set(
            "l5r5e",
            "gm-monitor-actors",
            this.object.actors.map((e) => e.id)
        );
    }

    /**
     * Open the Sheet for this actor
     * @param {Event} event
     * @return {Promise<void>}
     * @private
     */
    async _openActorSheet(event) {
        event.preventDefault();
        event.stopPropagation();

        const id = $(event.currentTarget).data("actor-id");
        if (!id) {
            return;
        }

        this.object.actors.find((e) => e.id === id)?.sheet?.render(true);
    }

    /**
     * Remove the link to a property for the current item
     * @param {Event} event
     * @return {Promise<void>}
     * @private
     */
    async _removeActor(event) {
        event.preventDefault();
        event.stopPropagation();

        const id = $(event.currentTarget).data("actor-id");
        if (!id) {
            return;
        }

        this.object.actors = this.object.actors.filter((e) => e.id !== id);

        return this._saveActorsIds();
    }

    /**
     * Get tooltips informations for this actor
     * @param {BaseSheetL5r5e} actor
     * @return {string}
     * @private
     */
    async _getTooltipGlobal(actor) {
        const data = actor.data.data;

        // Peculiarities
        const pec = actor.items.filter((e) => e.type === "peculiarity");
        const adv = pec
            .filter((e) => ["distinction", "passion"].includes(e.data.data.peculiarity_type))
            .map((e) => e.name)
            .join(", ");
        const dis = pec
            .filter((e) => ["adversity", "anxiety"].includes(e.data.data.peculiarity_type))
            .map((e) => e.name)
            .join(", ");

        // *** Template ***
        return renderTemplate(`${CONFIG.l5r5e.paths.templates}gm/monitor-tooltips/global.html`, {
            actorData: data,
            advantages: adv,
            disadvantages: dis,
        });
    }

    /**
     * Get weapons informations for this actor
     * @param {BaseSheetL5r5e} actor
     * @return {string}
     * @private
     */
    async _getTooltipWeapons(actor) {
        const display = (e) => {
            return (
                e.name +
                ` (<i class="fas fa-arrows-alt-h"> ${e.data.data.range}</i>` +
                ` / <i class="fas fa-tint"> ${e.data.data.damage}</i>` +
                ` / <i class="fas fa-skull"> ${e.data.data.deadliness}</i>)`
            );
        };

        // Readied Weapons
        const readied = actor.items
            .filter((e) => e.type === "weapon" && e.data.data.equipped && !!e.data.data.readied)
            .map((e) => display(e));

        // Equipped Weapons
        const sheathed = actor.items
            .filter((e) => e.type === "weapon" && e.data.data.equipped && !e.data.data.readied)
            .map((e) => display(e));

        // *** Template ***
        return renderTemplate(`${CONFIG.l5r5e.paths.templates}gm/monitor-tooltips/weapons.html`, {
            readied,
            sheathed,
        });
    }

    /**
     * Get armors informations for this actor
     * @param {BaseSheetL5r5e} actor
     * @return {string}
     * @private
     */
    async _getTooltipArmors(actor) {
        // Equipped Armors
        const armors = actor.items
            .filter((e) => e.type === "armor" && e.data.data.equipped)
            .map(
                (e) =>
                    e.name +
                    ` (<i class="fas fa-tint">${e.data.data.armor.physical}</i>` +
                    ` / <i class="fas fa-bolt">${e.data.data.armor.supernatural}</i>)`
            );

        // *** Template ***
        return renderTemplate(`${CONFIG.l5r5e.paths.templates}gm/monitor-tooltips/armors.html`, {
            armors,
        });
    }
}
