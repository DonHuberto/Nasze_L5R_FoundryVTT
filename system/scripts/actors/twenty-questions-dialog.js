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
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "l5r5e-twenty-questions-dialog",
            classes: ["l5r5e", "twenty-questions-dialog"],
            template: CONFIG.l5r5e.paths.templates + "actors/twenty-questions-dialog.html",
            title: game.i18n.localize("l5r5e.twenty_questions.title"),
            width: 700,
            height: 800,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "part0" }],
            resizable: true,
            closeOnSubmit: false,
            submitOnClose: false,
            submitOnChange: true,
        });
    }

    /**
     * Define a unique and dynamic element ID for the rendered ActorSheet application
     */
    get id() {
        return `l5r5e-twenty-questions-dialog-${this.actor.id}`;
    }

    /**
     * Create dialog
     */
    constructor(actor = null, options = {}) {
        super({}, options);
        this._initialize(actor);
    }

    /**
     * Refresh data (used from socket)
     */
    async refresh() {
        if (!this.actor) {
            return;
        }
        this._initialize(game.actors.get(this.actor.id));
        await this._constructCache();
        this.render(false);
    }

    /**
     * Initialize actor and object for dialog
     * @private
     */
    _initialize(actor) {
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
            new DragDrop({
                dragSelector: ".bond",
                dropSelector: ".bonds",
                permissions: { dragstart: this._canDragStart.bind(this), drop: this._canDragDrop.bind(this) },
                callbacks: {
                    dragstart: this._onDragStart.bind(this),
                    drop: this._onDropItem.bind(this, "bond"),
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
        const skillsPoints = this.object.summariesRingsOrSkills("skillList");
        const skillsList = game.l5r5e.HelpersL5r5e.getSkillsList(true);
        const skillsListStep7 = this._getSkillZero(skillsList, skillsPoints, "step7.skill");
        const skillsListStep17 = this._getSkillZero(skillsList, skillsPoints, "step17.skill");
        return {
            ...super.getData(options),
            ringsList: game.l5r5e.HelpersL5r5e.getRingsList(),
            skillsList,
            skillsListStep7,
            skillsListStep17,
            noHonorSkillsList: ["commerce", "skulduggery", "medicine", "seafaring", "survival", "labor"],
            techniquesList: game.l5r5e.HelpersL5r5e.getTechniquesList({ displayInTypes: true }),
            data: this.object.data,
            cache: this.cache,
            summary: {
                ...this.summary,
                errors: this.summary.errors.join(", "),
            },
            templates: [
                { id: "core", label: game.i18n.localize("l5r5e.twenty_questions.part0.type_core") },
                { id: "pow", label: game.i18n.localize("l5r5e.twenty_questions.part0.type_pow") },
            ],
            suffix: this.object.data.template === "pow" ? "_pow" : "",
        };
    }

    /**
     * Listen to html elements
     * @param {jQuery} html HTML content of the sheet.
     * @override
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Commons
        game.l5r5e.HelpersL5r5e.commonListeners(html, this.actor);

        // BT Next
        html.find(".next").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const tab = this._tabs.find((e) => e._navSelector === ".sheet-tabs");
            const next = parseInt(tab.active.replace(/[^0-9]/g, "")) + 1;
            tab.activate("part" + next);
            $(event.currentTarget).closest(".window-content").scrollTop(0);
        });

        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.isEditable) {
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
            event.preventDefault();
            event.stopPropagation();
            const stepKey = $(event.currentTarget).parents(".tq-drag-n-drop").data("step");
            const itemId = $(event.currentTarget).parents(".property").data("propertyId");
            this._deleteOwnedItem(stepKey, itemId);
            this.submit();
        });

        // Submit button
        html.find("#generate").on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            $(event.currentTarget).prop("disabled", true);
            await this.object.toActor(this.actor, flattenObject(this.cache));
            await this.close({ submit: true, force: true });
        });

        // Autocomplete
        game.l5r5e.HelpersL5r5e.autocomplete(html, "step1.clan", game.l5r5e.HelpersL5r5e.getLocalizedClansList());
        game.l5r5e.HelpersL5r5e.autocomplete(
            html,
            "step2.family",
            CONFIG.l5r5e.families.get(
                Object.entries(game.i18n.translations.l5r5e.clans).find(
                    ([k, v]) => v === this.object.data.step1.clan
                )?.[0]
            )
        );
        game.l5r5e.HelpersL5r5e.autocomplete(html, "step3.school", game.l5r5e.HelpersL5r5e.getSchoolsList(), ",");
        game.l5r5e.HelpersL5r5e.autocomplete(html, "step3.roles", game.l5r5e.HelpersL5r5e.getLocalizedRolesList(), ",");
    }

    /**
     * Handle dropped items
     */
    async _onDropItem(type, event) {
        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.isEditable) {
            return;
        }

        if (!["item", "technique", "peculiarity", "bond"].includes(type)) {
            return;
        }
        const stepKey = $(event.target).data("step");
        if (!stepKey) {
            console.warn("L5R5E | Event stepKey is undefined");
            return;
        }
        try {
            // Get item
            const item = await game.l5r5e.HelpersL5r5e.getDragnDropTargetObject(event);
            if (item.documentName !== "Item" || !item) {
                console.warn(`L5R5E | Forbidden item for this drop zone ${type} : ${item.data.type}`);
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
                console.warn(`L5R5E | Forbidden item for this drop zone ${type} : ${item.data.type}`);
                return;
            }

            // TODO Check if this item id already exist ?

            // Specific entry
            switch (type) {
                case "technique":
                    // School Ability
                    if (stepKey === "step3.school_ability") {
                        if (item.data.data.technique_type !== "school_ability") {
                            console.warn(
                                `L5R5E | This technique is not a school ability : ${item.data.data.technique_type}`
                            );
                            return;
                        }
                    } else if (!this.object.data.step3.allowed_techniques?.[item.data.data.technique_type]) {
                        // Tech not allowed
                        ui.notifications.info(game.i18n.localize("l5r5e.techniques.not_allowed"));
                        return;
                    }
                    break;

                case "peculiarity":
                    switch (stepKey) {
                        case "step9.distinction":
                            if (item.data.data.peculiarity_type !== "distinction") {
                                console.warn("L5R5E | Wrong type", item.data.data.peculiarity_type);
                                return;
                            }
                            break;
                        case "step10.adversity":
                            if (item.data.data.peculiarity_type !== "adversity") {
                                console.warn("L5R5E | Wrong type", item.data.data.peculiarity_type);
                                return;
                            }
                            break;
                        case "step11.passion":
                            if (item.data.data.peculiarity_type !== "passion") {
                                console.warn("L5R5E | Wrong type", item.data.data.peculiarity_type);
                                return;
                            }
                            break;
                        case "step12.anxiety":
                            if (item.data.data.peculiarity_type !== "anxiety") {
                                console.warn("L5R5E | Wrong type", item.data.data.peculiarity_type);
                                return;
                            }
                            break;
                        case "step13.advantage":
                            if (!["distinction", "passion"].includes(item.data.data.peculiarity_type)) {
                                console.warn("L5R5E | Wrong type", item.data.data.peculiarity_type);
                                return;
                            }
                            break;
                        case "step13.disadvantage":
                            if (!["adversity", "anxiety"].includes(item.data.data.peculiarity_type)) {
                                console.warn("L5R5E | Wrong type", item.data.data.peculiarity_type);
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
            console.warn("L5R5E | ", err);
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

        if (formData["template"] === "pow" && this.object.data.step8.item.length > 0) {
            formData["step8.skill"] = "none";
            formData["step8.social_add_honor"] = 0;
        } else {
            formData["step8.social_add_honor"] =
                !formData["step8.skill"] || formData["step8.skill"] === "none" ? 10 : 0;
            foundry.utils.setProperty(this.object.data, "step8.item", []);
        }

        if (this.object.data.step13.advantage.length > 0) {
            formData["step13.skill"] = "none";
            foundry.utils.setProperty(this.object.data, "step13.disadvantage", []);
        }

        // Update 20Q object data
        this.object.updateFromForm(formData);

        // Get errors if any, and redo summary table
        this.summary = this.object.validateForm();

        // Store this form datas in actor
        this.actor.data.data.twenty_questions = this.object.data;
        await this.actor.update({
            data: {
                template: formData["template"],
                twenty_questions: this.object.data,
            },
        });

        // Notify the change to other players
        game.l5r5e.sockets.refreshAppId(this.id);

        this.render(false);
    }

    /**
     * Construct the cache tree with Items full object
     */
    async _constructCache() {
        this.cache = {};
        for (const stepName of TwentyQuestions.itemsList) {
            // Check if current step value is a array
            let step = foundry.utils.getProperty(this.object.data, stepName);
            if (!step || !Array.isArray(step)) {
                step = [];
            }

            // Init cache if not exist
            if (!foundry.utils.hasProperty(this.cache, stepName)) {
                foundry.utils.setProperty(this.cache, stepName, []);
            }

            // Get linked Item, and store it in cache (delete null value and old items)
            const newStep = [];
            for (const id of step) {
                if (!id) {
                    continue;
                }
                const item = await game.l5r5e.HelpersL5r5e.getObjectGameOrPack({ id: id, type: "Item" });
                if (!item) {
                    console.warn(`L5R5E | Unknown item id[${id}]`);
                    continue;
                }
                newStep.push(id);
                foundry.utils.getProperty(this.cache, stepName).push(item);
            }
            foundry.utils.setProperty(this.object.data, stepName, newStep);
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
        foundry.utils.setProperty(this.object.data, stepName, roll.result);
        return roll.toMessage({ flavor: flavor });
    }

    /**
     * Add a owned item reference in step and cache
     * @private
     */
    _addOwnedItem(item, stepName) {
        // Add to Step (uniq id only)
        let step = foundry.utils.getProperty(this.object.data, stepName);
        if (!step) {
            step = [];
        }
        if (step.some((e) => e === item.id)) {
            return;
        }
        step.push(item.id);

        // Add to cache
        foundry.utils.getProperty(this.cache, stepName).push(item);
    }

    /**
     * Delete a owned item reference in step and cache
     * @private
     */
    _deleteOwnedItem(stepName, itemId) {
        // Delete from current step
        let step = foundry.utils.getProperty(this.object.data, stepName);
        step = step.filter((e) => !!e && e !== itemId);
        foundry.utils.setProperty(this.object.data, stepName, step);

        // Delete from cache
        let cache = foundry.utils.getProperty(this.cache, stepName);
        cache = cache.filter((e) => !!e && e.id !== itemId);
        foundry.utils.setProperty(this.cache, stepName, cache);
    }

    /**
     * Return the list of skill with only zero point (or 1 in this step)
     * @private
     */
    _getSkillZero(skillsList, skillsPoints, stepName) {
        const stepSkillId = foundry.utils.getProperty(this.object.data, stepName);
        const out = {};
        Object.entries(skillsList).forEach(([cat, val]) => {
            out[cat] = val.filter(
                (skill) => stepSkillId === skill.id || !skillsPoints[skill.id] || skillsPoints[skill.id] < 1
            );
        });
        return out;
    }
}
