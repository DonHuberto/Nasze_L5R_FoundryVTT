/**
 * L5R Initiative Roll dialog
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
        return mergeObject(super.defaultOptions, {
            id: "l5r5e-gm-tools-dialog",
            classes: ["l5r5e", "gm-tools-dialog"],
            template: CONFIG.l5r5e.paths.templates + "dice/gm-tools-dialog.html",
            title: game.i18n.localize("l5r5e.dicepicker.difficulty_title"),
            width: 200, // ignored under 200px
            height: 130, // ignored under 50px
            scale: 0.5, // so scale /2 :D
            left: x - 470,
            top: y - 94,
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
        this.object = {
            difficulty: game.settings.get("l5r5e", "initiative.difficulty.value"),
            difficultyHidden: game.settings.get("l5r5e", "initiative.difficulty.hidden"),
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
            this.object.difficultyHidden = !this.object.difficultyHidden;
            game.settings
                .set("l5r5e", "initiative.difficulty.hidden", this.object.difficultyHidden)
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
                    this.object.difficulty = Math.max(1, this.object.difficulty - 1);
                    break;
            }
            game.settings.set("l5r5e", "initiative.difficulty.value", this.object.difficulty).then(() => this.submit());
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
        // Notify the change to other players if they already have opened the DicePicker
        game.l5r5e.sockets.refreshAppId("l5r5e-dice-picker-dialog");

        // If the current GM also have the DP open
        const app = Object.values(ui.windows).find((e) => e.id === "l5r5e-dice-picker-dialog");
        if (app && typeof app.refresh === "function") {
            app.refresh();
        }

        this.render(false);
    }
}
