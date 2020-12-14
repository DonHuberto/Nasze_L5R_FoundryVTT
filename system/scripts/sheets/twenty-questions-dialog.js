import { L5R5E } from "../l5r5e-config.js";

/**
 * L5R Twenty Questions form
 * @extends {FormApplication}
 */
export class TwentyQuestionsDialog extends FormApplication {
    /**
     * Assign the default options
     * @override
     */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "l5r5e-twenty-questions-dialog",
            classes: ["l5r5e", "twenty-questions-dialog"],
            template: CONFIG.L5r5e.paths.templates + "sheets/twenty-questions-dialog.html",
            title: "L5R Twenty Questions", // TODO Localize
            width: 600,
            height: 600,
            resizable: true,
        });
    }

    /**
     * Create dialog
     */
    constructor(options = null) {
        super(options);
    }

    /**
     * Construct and return the data object used to render the HTML template for this form application.
     * @param options
     * @return {Object}
     */
    getData(options = null) {
        return {
            ...super.getData(options),
            elementsList: this._getElements(),
            skillsList: this._getSkills(),
        };
    }

    /**
     * Render the dialog
     * @param force
     * @param options
     * @returns {Application}
     */
    render(force, options) {
        options = {
            ...options,
        };

        if (force === undefined) {
            force = true;
        }

        return super.render(force, options);
    }

    /**
     * Listen to html elements
     * @override
     */
    activateListeners(html) {
        super.activateListeners(html);

        // html.find('input[name="approach"]').on("click", async (event) => {});
    }

    /**
     * This method is called upon form submission after form data is validated
     * @param event    The initial triggering submission event
     * @param formData The object of validated form data with which to update the object
     * @returns        A Promise which resolves once the update operation has completed
     * @override
     */
    async _updateObject(event, formData) {
        // const ring = formData.ring || null;

        // TODO
        console.log(formData);
        return;
        // return this.close();
    }

    /**
     * Load elements list (id, label)
     * @private
     */
    _getElements() {
        return CONFIG.L5r5e.stances.map((e) => {
            return {
                id: e,
                label: game.i18n.localize(`l5r5e.rings.${e}`),
            };
        });
    }

    /**
     * Load Skills list (id, cat, label)
     * @private
     */
    _getSkills() {
        const skills = {};
        Array.from(L5R5E.skills).forEach(([id, cat]) => {
            if (!skills[cat]) {
                skills[cat] = [];
            }
            skills[cat].push({
                id: id,
                cat: cat,
                label: game.i18n.localize(`l5r5e.skills.${cat}.${id}`),
            });
        });
        console.log(skills);
        return skills;
    }
}
