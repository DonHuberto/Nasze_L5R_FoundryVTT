/**
 * L5R GM Monitor Windows
 * @extends {FormApplication}
 */
export class GmMonitor extends FormApplication {
    /**
     * Settings
     */
    object = {
        view: "characters", // characters|armies
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
            title: game.i18n.localize("l5r5e.gm.monitor.title"),
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
     * Add the Switch View button on top of sheet
     * @override
     */
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();

        // Switch view Characters/Armies
        buttons.unshift({
            label: game.i18n.localize("l5r5e.gm.monitor.switch_view"),
            class: "switch-view",
            icon: "fas fa-users",
            onclick: () =>
                game.l5r5e.HelpersL5r5e.debounce(
                    "SwitchView-" + this.object.id,
                    () => {
                        this.object.view = this.object.view === "armies" ? "characters" : "armies";
                        this.render(false);
                    },
                    1000,
                    true
                )(),
        });

        return buttons;
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

        this.object.actors = actors;
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
            data: {
                ...this.object,
                actors: this.object.actors.filter((e) =>
                    this.object.view === "armies" ? e.type === "army" : e.type !== "army"
                ),
            },
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

        // Commons
        game.l5r5e.HelpersL5r5e.commonListeners(html);

        // Delete
        html.find(`.actor-remove-control`).on("click", this._removeActor.bind(this));

        // Add/Subtract
        html.find(`.actor-modify-control`).on("mousedown", this._modifyActor.bind(this));

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
                    return this._getTooltipArmors(actor);
                case "weapons":
                    return this._getTooltipWeapons(actor);
                case "global":
                    return actor.type === "army" ? this._getTooltipArmiesGlobal(actor) : this._getTooltipGlobal(actor);
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
     * Add or subtract fatigue/strife/void/casualties/panic
     * @param event
     * @return {Promise<void>}
     * @private
     */
    async _modifyActor(event) {
        event.preventDefault();
        event.stopPropagation();

        const type = $(event.currentTarget).data("type");
        if (!type) {
            console.warn("L5R5E | type not set", type);
            return;
        }
        const id = $(event.currentTarget).data("actor-id");
        if (!id) {
            console.warn("L5R5E | actor id not set", type);
            return;
        }
        const actor = game.actors.get(id);
        if (!actor) {
            console.warn("L5R5E | Actor not found", type);
            return;
        }

        // Mouse bt : middle = 0, left +1, right -1
        const add = event.which === 2 ? -999 : event.which === 1 ? 1 : -1;

        // Stance
        let stanceIdx =
            CONFIG.l5r5e.stances.findIndex((s) => s === actor.data.data.stance) + (event.which === 1 ? 1 : -1);
        if (stanceIdx < 0) {
            stanceIdx = CONFIG.l5r5e.stances.length - 1;
        } else if (stanceIdx > CONFIG.l5r5e.stances.length - 1) {
            stanceIdx = 0;
        }

        const updateData = {};
        switch (type) {
            // *** Characters ***
            case "fatigue":
                updateData["data.fatigue.value"] = Math.max(0, actor.data.data.fatigue.value + add);
                break;

            case "strife":
                updateData["data.strife.value"] = Math.max(0, actor.data.data.strife.value + add);
                break;

            case "void_points":
                updateData["data.void_points.value"] = Math.min(
                    actor.data.data.void_points.max,
                    Math.max(0, actor.data.data.void_points.value + add)
                );
                break;

            case "stance":
                updateData["data.stance"] = CONFIG.l5r5e.stances[stanceIdx];
                break;

            case "prepared":
                updateData["data.prepared"] = !actor.data.data.prepared;
                break;

            // *** Armies ***
            case "casualties":
                updateData["data.battle_readiness.casualties_strength.value"] = Math.max(
                    0,
                    actor.data.data.battle_readiness.casualties_strength.value + add
                );
                break;

            case "panic":
                updateData["data.battle_readiness.panic_discipline.value"] = Math.max(
                    0,
                    actor.data.data.battle_readiness.panic_discipline.value + add
                );
                break;

            default:
                console.warn("L5R5E | Unsupported type", type);
                break;
        }
        if (!foundry.utils.isObjectEmpty(updateData)) {
            await actor.update(updateData);
            this.render(false);
        }
    }

    /**
     * Get tooltips information for this character
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
            suffix: data.template === "pow" ? "_pow" : "",
            actor_type: actor.data.type,
        });
    }

    /**
     * Get tooltips informations for this army
     * @param {BaseSheetL5r5e} actor
     * @return {string}
     * @private
     */
    async _getTooltipArmiesGlobal(actor) {
        const actorData = (await actor.sheet?.getData()) || actor.data;

        // *** Template ***
        return renderTemplate(`${CONFIG.l5r5e.paths.templates}gm/monitor-tooltips/global-armies.html`, {
            actorData: actorData.data,
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
