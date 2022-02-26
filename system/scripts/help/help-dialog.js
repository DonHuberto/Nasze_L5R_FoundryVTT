/**
 * L5R Help dialog
 * @extends {FormApplication}
 */
export class HelpDialog extends FormApplication {
    /**
     * Payload Object
     */
    object = {};

    /**
     * Assign the default options
     * @override
     */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "l5r5e-help-dialog",
            classes: ["l5r5e", "help-dialog"],
            template: CONFIG.l5r5e.paths.templates + "help/help-dialog.html",
            title: game.i18n.localize("l5r5e.logo.title"),
            width: 400,
            height: 200,
            closeOnSubmit: false,
            submitOnClose: false,
            submitOnChange: false,
        });
    }

    /**
     * Construct and return the data object used to render the HTML template for this form application.
     * @param options
     * @return {Object}
     */
    getData(options = null) {
        return {
            ...super.getData(options),
        };
    }

    /**
     * Listen to html elements
     * @param {jQuery} html HTML content of the sheet.
     * @override
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Buttons
        html.find(`button`).on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const name = $(event.currentTarget).data("type");
            ui.notifications.info(game.i18n.localize(`l5r5e.logo.${name}.info`));
            window.open(game.i18n.localize(`l5r5e.logo.${name}.link`), "_blank");
        });
    }

    /**
     * This method is called upon form submission after form data is validated
     * @param event {Event}       The initial triggering submission event
     * @param formData {Object}   The object of validated form data with which to update the object
     * @returns {Promise}         A Promise which resolves once the update operation has completed
     * @override
     */
    _updateObject(event, formData) {
        // Nothing, but needed to be override
    }
}
