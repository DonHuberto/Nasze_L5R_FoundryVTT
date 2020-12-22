import { TwentyQuestions } from "./twenty-questions.js";

/**
 * L5R Twenty Questions form
 *
 * @extends {FormApplication}
 */
export class TwentyQuestionsDialog extends FormApplication {
    /**
     * Current actor data
     */
    actor = null;

    /**
     * Errors object
     */
    errors = {};

    /**
     * Assign the default options
     * @override
     */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "l5r5e-twenty-questions-dialog",
            classes: ["l5r5e", "twenty-questions-dialog"],
            template: CONFIG.l5r5e.paths.templates + "actors/twenty-questions-dialog.html",
            title: game.i18n.localize("l5r5e.twenty_questions.title"),
            width: 600,
            height: 600,
            resizable: true,
            closeOnSubmit: false,
            submitOnClose: true,
            submitOnChange: true,
        });
    }

    /**
     * Create dialog
     */
    constructor(options = null, actor = null) {
        super(options);
        this.actor = actor;
        this.object = new TwentyQuestions(actor);
        this.errors = this.object.validateForm();
    }

    /**
     * Create drag-and-drop workflow handlers for this Application
     * @return An array of DragDrop handlers
     */
    _createDragDropHandlers() {
        return [
            new DragDrop({
                dragSelector: ".item",
                dropSelector: ".items",
                permissions: { dragstart: this._canDragStart.bind(this), drop: this._canDragDrop.bind(this) },
                callbacks: { dragstart: this._onDragStart.bind(this), drop: this._onDropItem.bind(this, "item") },
            }),
            new DragDrop({
                dragSelector: ".technique",
                dropSelector: ".techniques",
                permissions: { dragstart: this._canDragStart.bind(this), drop: this._canDragDrop.bind(this) },
                callbacks: { dragstart: this._onDragStart.bind(this), drop: this._onDropItem.bind(this, "technique") },
            }),
            new DragDrop({
                dragSelector: ".peculiarity",
                dropSelector: ".peculiarities",
                permissions: { dragstart: this._canDragStart.bind(this), drop: this._canDragDrop.bind(this) },
                callbacks: {
                    dragstart: this._onDragStart.bind(this),
                    drop: this._onDropItem.bind(this, "peculiarity"),
                },
            }),
        ];
    }

    /**
     * Construct and return the data object used to render the HTML template for this form application.
     * @param options
     * @return {Object}
     */
    getData(options = null) {
        return {
            ...super.getData(options),
            ringsList: game.l5r5e.HelpersL5r5e.getRingsList(),
            skillsList: game.l5r5e.HelpersL5r5e.getSkillsList(true),
            noHonorSkillsList: ["commerce", "skulduggery", "medicine", "seafaring", "survival", "labor"],
            techniquesList: CONFIG.l5r5e.techniques,
            data: this.object.data,
            errors: this.errors,
            hasErrors: Object.keys(this.errors).length > 0,
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

        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.options.editable) {
            return;
        }

        // Submit button
        html.find("#generate").on("click", async (event) => {
            this.object.toActor(this.actor);
            await this.close({ submit: true, force: true });
        });
    }

    /**
     * Handle dropped items
     */
    _onDropItem(type, event) {
        console.log("*** _onDrop event", event, type);
        if (!["item", "technique", "peculiarity"].includes(type)) {
            return;
        }

        // Try to extract the data
        // {type: "Item", id: "pC37smMSCqu3aSRM"}
        let data;
        try {
            data = JSON.parse(event.dataTransfer.getData("text/plain"));
            if (data.type !== "Item") {
                return;
            }

            const item = game.items.get(data.id);
            if (item || item.data.type !== type) {
                return;
            }

            // TODO
            console.log("** OK ", item);
            // sub_type === 'peculiarity'
        } catch (err) {
            console.warn(err);
        }
        return false;
    }

    /**
     * This method is called upon form submission after form data is validated
     * @param event    The initial triggering submission event
     * @param formData The object of validated form data with which to update the object
     * @returns        A Promise which resolves once the update operation has completed
     * @override
     */
    async _updateObject(event, formData) {
        // Update 20Q object data
        this.object.updateFromForm(formData);

        // Get errors if any
        this.errors = this.object.validateForm();

        // Only on close/submit
        if (event.type === "submit") {
            // Store this form datas in actor
            this.actor.data.data.twenty_questions = this.object.data;
            this.actor.update({
                data: {
                    twenty_questions: this.object.data,
                },
            });
        }
        this.render(false);
    }
}
