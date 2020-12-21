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

    errors = [];

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
        });
    }

    /**
     * Create dialog
     */
    constructor(options = null, actor = null) {
        super(options);
        this.actor = actor;
        this.object = new TwentyQuestions(actor);
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
            techniquesList: CONFIG.l5r5e.techniques,
            data: this.object.data,
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

        // Check rings total
        html.find(".ring-select").on("change", async (event) => {
            const sum = this._summarySelects(html, ".ring-select");
            // sum = Map(4) {"void" => 2, "water" => 1, "fire" => 1, "earth" => 1}
            console.log(sum);
        });

        // Check skills total
        html.find(".skill-select").on("change", async (event) => {
            const sum = this._summarySelects(html, ".skill-select");
            console.log(sum);
        });

        // Submit button
        html.find("#generate").on("click", async (event) => {
            this.submit();
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

    // _canDragDrop(event) {
    //     console.log("*** _canDragDrop event", event);
    //     return false;
    // }

    /**
     * This method is called upon form submission after form data is validated
     * @param event    The initial triggering submission event
     * @param formData The object of validated form data with which to update the object
     * @returns        A Promise which resolves once the update operation has completed
     * @override
     */
    async _updateObject(event, formData) {
        this.object.updateFromForm(formData);
        this.object.toActor(this.actor);
        return this.close();
    }

    /**
     * Return a map of skill/ring with count
     * @private
     */
    _summarySelects(html, selector) {
        return html
            .find(selector)
            .get()
            .reduce((acc, curr) => {
                curr = curr.value;
                if (curr === "none") {
                    return acc;
                }
                let val = acc.get(curr);
                if (!val) {
                    val = 0;
                }
                acc.set(curr, val + 1);
                return acc;
            }, new Map());
    }
}
