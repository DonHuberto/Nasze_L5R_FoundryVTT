/**
 * L5R GM Toolbox dialog
 * @extends {FormApplication}
 */
export class GmToolsDialog extends FormApplication {
    /**
     * Settings
     */
    object = {};

    /**
     * Assign the default options
     * @override
     */
    static get defaultOptions() {
        const x = $(window).width();
        const y = $(window).height();
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "l5r5e-gm-tools-dialog",
            classes: ["l5r5e", "gm-tools-dialog"],
            template: CONFIG.l5r5e.paths.templates + "dice/gm-tools-dialog.html",
            title: game.i18n.localize("l5r5e.gm_toolbox.title"),
            left: x - 512,
            top: y - 98,
            closeOnSubmit: false,
            submitOnClose: false,
            submitOnChange: true,
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
        this.object = {
            difficulty: game.settings.get("l5r5e", "initiative-difficulty-value"),
            difficultyHidden: game.settings.get("l5r5e", "initiative-difficulty-hidden"),
        };
    }

    /**
     * Do not close this dialog
     * @override
     */
    async close(options = {}) {
        // TODO better implementation needed : see KeyboardManager._onEscape(event, up, modifiers)
        // This windows is always open, so esc key is stuck at step 2 : Object.keys(ui.windows).length > 0
        // Case 3 (GM) - release controlled objects
        if (canvas?.ready && game.user.isGM && Object.keys(canvas.activeLayer._controlled).length) {
            canvas.activeLayer.releaseAll();
        } else {
            // Case 4 - toggle the main menu
            ui.menu.toggle();
        }
    }

    /**
     * Prevent non GM to render this windows
     * @override
     */
    render(force = false, options = {}) {
        if (!game.user.isGM) {
            return false;
        }
        this.position.width = "auto";
        this.position.height = "auto";
        return super.render(force, options);
    }

    /**
     * Remove the close button
     * @override
     */
    _getHeaderButtons() {
        return [];
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
     * @override
     */
    activateListeners(html) {
        super.activateListeners(html);

        if (!game.user.isGM) {
            return;
        }

        // Modify difficulty hidden
        html.find(`.difficulty_hidden`).on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.object.difficultyHidden = !this.object.difficultyHidden;
            game.settings
                .set("l5r5e", "initiative-difficulty-hidden", this.object.difficultyHidden)
                .then(() => this.submit());
        });

        // Modify difficulty (TN)
        html.find(`.difficulty`).on("mousedown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            switch (event.which) {
                case 1:
                    // left clic - add 1
                    this.object.difficulty = Math.min(9, this.object.difficulty + 1);
                    break;
                case 2:
                    // middle clic - reset to 2
                    this.object.difficulty = 2;
                    break;
                case 3:
                    // right clic - minus 1
                    this.object.difficulty = Math.max(0, this.object.difficulty - 1);
                    break;
            }
            game.settings.set("l5r5e", "initiative-difficulty-value", this.object.difficulty).then(() => this.submit());
        });

        // Scene End & Sleep
        html.find(`.gm_actor_updates`).on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this._updatesActors($(event.currentTarget).data("type"));
        });
    }

    /**
     * This method is called upon form submission after form data is validated
     * @param event    The initial triggering submission event
     * @param formData The object of validated form data with which to update the object
     * @returns        A Promise which resolves once the update operation has completed
     * @override
     */
    async _updateObject(event, formData) {
        this.render(false);
    }

    /**
     * Update all actors
     * @param {string} type
     * @private
     */
    _updatesActors(type) {
        if (!game.user.isGM) {
            return;
        }

        game.actors.contents.forEach((actor) => {
            switch (type) {
                case "sleep":
                    // Remove 'water x2' fatigue points
                    actor.data.data.fatigue.value = Math.max(
                        0,
                        actor.data.data.fatigue.value - Math.ceil(actor.data.data.rings.water * 2)
                    );
                    break;

                case "scene_end":
                    // If more than half the value => roundup half conflit & fatigue
                    actor.data.data.fatigue.value = Math.min(
                        actor.data.data.fatigue.value,
                        Math.ceil(actor.data.data.fatigue.max / 2)
                    );
                    actor.data.data.strife.value = Math.min(
                        actor.data.data.strife.value,
                        Math.ceil(actor.data.data.strife.max / 2)
                    );
                    break;
            }

            actor.update({
                data: {
                    fatigue: {
                        value: actor.data.data.fatigue.value,
                    },
                    strife: {
                        value: actor.data.data.strife.value,
                    },
                },
            });
        });

        ui.notifications.info(game.i18n.localize(`l5r5e.gm_toolbox.${type}_info`));
    }
}
