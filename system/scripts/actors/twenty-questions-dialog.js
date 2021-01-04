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
     * Summary & Errors
     */
    summary = {
        errors: [],
        summary: {
            rings: [],
            skills: [],
        },
    };

    /**
     * Cache for items (techniques, adv...)
     */
    cache = null;

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
            height: 800,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "part0" }],
            resizable: true,
            closeOnSubmit: false,
            submitOnClose: false,
            submitOnChange: true,
        });
    }

    /**
     * Add a refresh button on top of sheet
     * Allow a GM or player to see the change made by another player without closing the dialog
     * @override
     */
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();

        buttons.unshift({
            label: game.i18n.localize("l5r5e.twenty_questions.bt_refresh"),
            class: "twenty-questions",
            icon: "fas fa-sync-alt",
            onclick: async () => {
                await new TwentyQuestionsDialog(this.actor).render(true);
            },
        });
        return buttons;
    }

    /**
     * Create dialog
     */
    constructor(actor = null, options = {}) {
        super({}, options);
        this.actor = actor;
        this.object = new TwentyQuestions(actor);
        this.summary = this.object.validateForm();
    }

    /**
     * Construct async cache here
     * @override
     */
    async _render(force = false, options = {}) {
        if (this.cache === null) {
            await this._constructCache();
        }
        return super._render(force, options);
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
    async getData(options = null) {
        return {
            ...super.getData(options),
            ringsList: game.l5r5e.HelpersL5r5e.getRingsList(),
            skillsList: game.l5r5e.HelpersL5r5e.getSkillsList(true),
            noHonorSkillsList: ["commerce", "skulduggery", "medicine", "seafaring", "survival", "labor"],
            techniquesList: CONFIG.l5r5e.techniques,
            data: this.object.data,
            cache: this.cache,
            summary: {
                ...this.summary,
                errors: this.summary.errors.join(", "),
            },
        };
    }

    /**
     * Listen to html elements
     * @override
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Toggle
        html.find(".toggle-on-click").on("click", (event) => {
            const elmt = $(event.currentTarget).data("toggle");
            const tgt = html.find("." + elmt);
            tgt.hasClass("toggle-active") ? tgt.removeClass("toggle-active") : tgt.addClass("toggle-active");
        });

        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.options.editable) {
            return;
        }

        // Heritage Roll (step 18)
        html.find(".inline-roll").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const diceRoll = $(event.currentTarget);
            const stepKey = diceRoll.data("step");
            const formula = diceRoll.data("formula");
            const flavor = diceRoll.data("flavor");
            this._rollHeritage(stepKey, formula, flavor).then(() => this.render(false));
        });

        // Delete a dnd element
        html.find(".property-delete").on("click", (event) => {
            const stepKey = $(event.currentTarget).parents(".tq-drag-n-drop").data("step");
            const itemId = $(event.currentTarget).parents(".property").data("propertyId");
            this._deleteOwnedItem(stepKey, itemId);
            this.submit();
        });

        // Submit button
        html.find("#generate").on("click", async (event) => {
            await this.object.toActor(this.actor, flattenObject(this.cache));
            await this.close({ submit: true, force: true });
        });
    }

    /**
     * Handle dropped items
     */
    async _onDropItem(type, event) {
        if (!["item", "technique", "peculiarity"].includes(type)) {
            return;
        }
        const stepKey = $(event.target).data("step");
        if (!stepKey) {
            console.warn("event stepKey is undefined");
            return;
        }
        try {
            // Get item
            const item = await game.l5r5e.HelpersL5r5e.getDragnDropTargetObject(event);
            if (item.entity !== "Item" || !item) {
                console.warn("forbidden item for this drop zone", type, item.data.type);
                return;
            }

            // Specific step18_heritage, all item/tech allowed
            if (stepKey === "step18.heritage_item") {
                type = item.data.type;
            }

            if (
                (type !== "item" && item.data.type !== type) ||
                (type === "item" && !["item", "weapon", "armor"].includes(item.data.type))
            ) {
                console.warn("forbidden item for this drop zone", type, item.data.type);
                return;
            }

            // TODO Check if this item id already exist ?

            // Specific entry
            switch (type) {
                case "technique":
                    // School Ability
                    if (stepKey === "step3.school_ability") {
                        if (item.data.data.technique_type !== "school_ability") {
                            console.warn("This technique is not a school ability");
                            return;
                        }
                        if (
                            Array.from(this.actor.items).some(
                                (e) => e.type === "technique" && e.data.data.technique_type === "school_ability"
                            )
                        ) {
                            console.warn("This technique is not a school ability", item.data.data.technique_type);
                            return;
                        }
                    } else if (!this.object.data.step3.allowed_techniques?.[item.data.data.technique_type]) {
                        // Tech not allowed
                        console.warn("This technique is not allowed for your character", item.data.data.technique_type);
                        return;
                    }
                    break;

                case "peculiarity":
                    switch (stepKey) {
                        case "step9.distinction":
                            if (item.data.data.peculiarity_type !== "distinction") {
                                console.warn("Wrong type", item.data.data.peculiarity_type);
                                return;
                            }
                            break;
                        case "step10.adversity":
                            if (item.data.data.peculiarity_type !== "adversity") {
                                console.warn("Wrong type", item.data.data.peculiarity_type);
                                return;
                            }
                            break;
                        case "step11.passion":
                            if (item.data.data.peculiarity_type !== "passion") {
                                console.warn("Wrong type", item.data.data.peculiarity_type);
                                return;
                            }
                            break;
                        case "step12.anxiety":
                            if (item.data.data.peculiarity_type !== "anxiety") {
                                console.warn("Wrong type", item.data.data.peculiarity_type);
                                return;
                            }
                            break;
                        case "step13.advantage":
                            if (!["distinction", "passion"].includes(item.data.data.peculiarity_type)) {
                                console.warn("Wrong type", item.data.data.peculiarity_type);
                                return;
                            }
                            break;
                        case "step13.disadvantage":
                            if (!["adversity", "anxiety"].includes(item.data.data.peculiarity_type)) {
                                console.warn("Wrong type", item.data.data.peculiarity_type);
                                return;
                            }
                            break;
                    }
                    break;
            }

            // Add the item (step and cache)
            this._addOwnedItem(item, stepKey);

            this.submit();
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
        // Check "Or" conditions
        formData["step7.social_add_glory"] = formData["step7.skill"] === "none" ? 5 : 0;
        formData["step8.social_add_honor"] = formData["step8.skill"] === "none" ? 10 : 0;
        if (formData["step13.skill"] !== "none" && this.object.data.step13.advantage.length > 0) {
            formData["step13.skill"] = "none";
        }

        // Update 20Q object data
        this.object.updateFromForm(formData);

        // Get errors if any, and redo summary table
        this.summary = this.object.validateForm();

        // Store this form datas in actor
        this.actor.data.data.twenty_questions = this.object.data;
        await this.actor.update({
            data: {
                twenty_questions: this.object.data,
            },
        });

        this.render(false);
    }

    /**
     * Construct the cache tree with Items full object
     */
    async _constructCache() {
        this.cache = {};
        for (const stepName of TwentyQuestions.itemsList) {
            // Check if current step value is a array
            let step = getProperty(this.object.data, stepName);
            if (!step || !Array.isArray(step)) {
                step = [];
            }

            // Init cache if not exist
            if (!hasProperty(this.cache, stepName)) {
                setProperty(this.cache, stepName, []);
            }

            // Get linked Item, and store it in cache (delete null value and old items)
            const newStep = [];
            for (const id of step) {
                if (!id) {
                    continue;
                }
                const item = await game.l5r5e.HelpersL5r5e.getObjectGameOrPack(id, "Item");
                if (!item) {
                    continue;
                }
                newStep.push(id);
                getProperty(this.cache, stepName).push(item);
            }
            setProperty(this.object.data, stepName, newStep);
        }
    }

    /**
     * Roll Heritage dice and fill the form with the result
     * @private
     */
    async _rollHeritage(stepName, formula, flavor) {
        const roll = new game.l5r5e.RollL5r5e(formula);
        roll.actor = this._actor;

        await roll.roll();
        setProperty(this.object.data, stepName, roll.result);
        return roll.toMessage({ flavor: flavor });
    }

    /**
     * Add a owned item reference in step and cache
     * @private
     */
    _addOwnedItem(item, stepName) {
        // Add to Step (uniq id only)
        let step = getProperty(this.object.data, stepName);
        if (!step) {
            step = [];
        }
        if (step.some((e) => e === item.id)) {
            return;
        }
        step.push(item.id);

        // Add to cache
        getProperty(this.cache, stepName).push(item);
    }

    /**
     * Delete a owned item reference in step and cache
     * @private
     */
    _deleteOwnedItem(stepName, itemId) {
        // Delete from current step
        let step = getProperty(this.object.data, stepName);
        step = step.filter((e) => !!e && e !== itemId);
        setProperty(this.object.data, stepName, step);

        // Delete from cache
        let cache = getProperty(this.cache, stepName);
        cache = cache.filter((e) => !!e && e.id !== itemId);
        setProperty(this.cache, stepName, cache);
    }
}
