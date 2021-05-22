/**
 * L5R Dice picker dialog
 * @extends {FormApplication}
 */
export class DicePickerDialog extends FormApplication {
    /**
     * Current Actor
     * @type {Actor}
     * @private
     */
    _actor = null;

    /**
     * If GM as set to hidden, lock the player choice so he cannot look the TN
     * @type {boolean}
     */
    _difficultyHiddenIsLock = false;

    /**
     * Payload Object
     */
    object = {
        ring: {
            id: "void",
            value: 1,
        },
        skill: {
            id: "",
            value: 0,
            defaultValue: 0,
            cat: "",
            name: "",
            assistance: 0,
        },
        difficulty: {
            value: 2,
            hidden: false,
            addVoidPoint: false,
        },
        useVoidPoint: false,
        isInitiativeRoll: false,
    };

    /**
     * Assign the default options
     * @override
     */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "l5r5e-dice-picker-dialog",
            classes: ["l5r5e", "dice-picker-dialog"],
            template: CONFIG.l5r5e.paths.templates + "dice/dice-picker-dialog.html",
            title: "L5R Dice Roller",
            actor: null,
            ringId: null,
            skillId: "",
            difficulty: 2,
            difficultyHidden: false,
        });
    }

    /**
     * Add a create macro button on top of sheet
     * @override
     */
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();

        buttons.unshift({
            label: game.i18n.localize("l5r5e.dicepicker.bt_add_macro"),
            class: "bt-add-macro",
            icon: "fas fa-star",
            onclick: async () => {
                await this._createMacro();
            },
        });

        return buttons;
    }

    /**
     * Create dialog
     *
     * ex: new game.l5r5e.DicePickerDialog({skillId: 'aesthetics', ringId: 'water', actor: game.user.character}).render(true);
     *
     * Options :
     *   actor             A instance of actor (game.user.character, canvas.tokens.controlled[0].actor, ...)
     *   actorId           string (AbYgKrNwWeAxa9jT)
     *   actorName         string (Isawa Aki) Careful this is case sensitive
     *   ringId            string (fire)
     *   skillId           string (design)
     *   skillCatId        string (artisan)
     *   difficulty        number (0-9)
     *   difficultyHidden  boolean
     *   isInitiativeRoll  boolean
     *
     * @param options actor, actorId, ringId, actorName, skillId, skillCatId, difficulty, difficultyHidden, isInitiativeRoll
     */
    constructor(options = {}) {
        super({}, options);

        // Try to get Actor from: options, first selected token or player's selected character
        [
            options?.actor,
            game.actors.get(options?.actorId),
            game.actors.getName(options?.actorName),
            canvas.tokens.controlled[0]?.actor,
            game.user.character,
        ].forEach((actor) => {
            if (!this._actor) {
                this.actor = actor;
            }
        });

        // Ring
        if (options.ringId) {
            this.ringId = options.ringId;
        }

        // Skill / SkillCategory
        if (options.skillId) {
            this.skillId = options.skillId;
        }

        // SkillCategory skillCatId
        if (options.skillCatId) {
            this.skillCatId = options.skillCatId;
        }

        // Difficulty
        if (options.difficulty) {
            this.difficulty = options.difficulty;
        } else {
            this.difficulty = game.settings.get("l5r5e", "initiative-difficulty-value");
        }

        // DifficultyHidden
        this.difficultyHidden = !!options.difficultyHidden;

        // InitiativeRoll
        this.object.isInitiativeRoll = !!options.isInitiativeRoll;
    }

    /**
     * Refresh data (used from socket)
     */
    async refresh() {
        this.difficulty = game.settings.get("l5r5e", "initiative-difficulty-value");
        this.difficultyHidden = false;
        this.render(false);
    }

    /**
     * Set actor
     * @param actor
     */
    set actor(actor) {
        if (!actor || !(actor instanceof Actor) || !actor.isOwner) {
            return;
        }
        this._actor = actor;
        if (this.object.ring.id === "void") {
            this.ringId = this._actor.data.data.stance;
            this.object.ring.value = this._actor.data.data.rings[this.object.ring.id];
        }
    }

    /**
     * Set ring preset
     * @param ringId
     */
    set ringId(ringId) {
        this.object.ring.id = CONFIG.l5r5e.stances.includes(ringId) ? ringId : "void";
    }

    /**
     * Set and load skill's required data from actor and skillId
     * @param skillId
     */
    set skillId(skillId) {
        if (!skillId) {
            return;
        }

        this.object.skill = {
            ...this.object.skill,
            id: skillId.toLowerCase().trim(),
            value: 0,
            cat: "",
            name: "",
        };

        this.skillCatId = CONFIG.l5r5e.skills.get(skillId);
    }

    /**
     * Set and load skill's required data from actor and skillCatId
     * @param skillCatId
     */
    set skillCatId(skillCatId) {
        if (!skillCatId) {
            return;
        }

        this.object.skill = {
            ...this.object.skill,
            value: 0,
            cat: skillCatId.toLowerCase().trim(),
            name: game.i18n.localize("l5r5e.skills." + skillCatId + "." + (this.object.skill.id || "title")),
        };

        if (!this._actor) {
            return;
        }
        switch (this._actor.data.type) {
            case "character":
                this.object.skill.value = this._actor.data.data.skills[skillCatId]?.[this.object.skill.id] || 0;
                this.object.skill.defaultValue = this.object.skill.value;
                break;

            case "npc":
                // Skill value is in categories for npc
                this.object.skill.value = this._actor.data.data.skills[skillCatId] || 0;
                this.object.skill.defaultValue = this.object.skill.value;
                break;
        }
    }

    /**
     * Set Difficulty level (default 2)
     * @param difficulty
     */
    set difficulty(difficulty) {
        difficulty = parseInt(difficulty) || null;
        if (difficulty < 0) {
            difficulty = 2;
        }
        this.object.difficulty.value = difficulty;
    }

    /**
     * Set if Difficulty is Hidden or not (default)
     * @param isHidden
     */
    set difficultyHidden(isHidden) {
        // If GM hide, then player choice don't matter
        this._difficultyHiddenIsLock = game.settings.get("l5r5e", "initiative-difficulty-hidden");
        if (this._difficultyHiddenIsLock) {
            isHidden = true;
        }
        this.object.difficulty.hidden = !!isHidden;
        this.object.difficulty.addVoidPoint = this.object.difficulty.hidden;
        this._updateVoidPointUsage();
    }

    /**
     * Add the Entity name into the window title
     * @type {String}
     */
    get title() {
        return `L5R Dice Roller` + (this._actor ? " - " + this._actor.data.name : "");
    }

    /**
     * Construct and return the data object used to render the HTML template for this form application.
     * @param options
     * @return {Object}
     */
    getData(options = null) {
        return {
            ...super.getData(options),
            ringsList: game.l5r5e.HelpersL5r5e.getRingsList(this._actor),
            data: this.object,
            actor: this._actor,
            actorIsPc: !this._actor || this._actor.data?.type === "character",
            canUseVoidPoint:
                this.object.difficulty.addVoidPoint || !this._actor || this._actor.data.data.void_points.value > 0,
            disableSubmit: this.object.skill.value < 1 && this.object.ring.value < 1,
            difficultyHiddenIsLock: this._difficultyHiddenIsLock,
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
     * @param {jQuery} html HTML content of the sheet.
     * @override
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Select Ring
        html.find('input[name="approach"]').on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.ringId = event.target.dataset.ringid;
            this.object.ring.value = parseInt(event.target.value) + (this.object.useVoidPoint ? 1 : 0);
            this.render(false);
        });

        // Quantity change for difficulty, ring and skill
        html.find(".quantity").on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const data = $(event.currentTarget);
            this._quantityChange(data.data("item"), data.data("value"));
            this.render(false);
        });

        // Skill assistance
        html.find(".assistance").on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const assistanceAdd = $(event.currentTarget).data("value");
            if (this.object.skill.assistance > 0 || assistanceAdd > 0) {
                this._quantityChange("skill", assistanceAdd);
            }
            this.object.skill.assistance = Math.max(
                Math.min(parseInt(this.object.skill.assistance) + assistanceAdd, 9),
                0
            );
            this.render(false);
        });

        // Click on the Default Skill Dice
        html.find("#skill_default_value").on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.object.skill.value = this.object.skill.defaultValue;
            this.object.skill.assistance = 0;
            this.render(false);
        });

        // Spend a Void point checkbox
        html.find("#use_void_point").on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.object.useVoidPoint = event.target.checked;
            this._quantityChange("ring", this.object.useVoidPoint ? 1 : -1);
            this.render(false);
        });

        // Difficulty Hidden
        html.find("#diff_hidden").on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.object.difficulty.hidden = !this.object.difficulty.hidden;
            this.object.difficulty.addVoidPoint = this.object.difficulty.hidden;
            this._updateVoidPointUsage();
            this.render(false);
        });

        // Difficulty Add a void point
        html.find("#diff_add_void_point").on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.object.difficulty.addVoidPoint = !this.object.difficulty.addVoidPoint;
            this._updateVoidPointUsage();
            this.render(false);
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
        if (this.object.skill.value < 1 && this.object.ring.value < 1) {
            return false;
        }

        // If initiative roll, check if player already have
        if (this.object.isInitiativeRoll) {
            const combatant = game.combat.combatants.find((c) => c.actor.id === this._actor.id && c.initiative > 0);
            if (combatant) {
                ui.notifications.error(game.i18n.localize("l5r5e.conflict.initiative.already_set"));
                return this.close();
            }
        }

        // Update Actor
        if (this._actor) {
            const actorData = foundry.utils.duplicate(this._actor.data.data);

            // Update the actor stance on initiative only
            if (this.object.isInitiativeRoll) {
                actorData.stance = this.object.ring.id;
            }

            // If hidden add 1 void pt
            if (this.object.difficulty.addVoidPoint) {
                actorData.void_points.value = Math.min(actorData.void_points.value + 1, actorData.void_points.max);
            }

            // If Void point is used, minus the actor
            if (this.object.useVoidPoint) {
                actorData.void_points.value = Math.max(actorData.void_points.value - 1, 0);
            }

            // Update actor if needed
            const updateDiff = foundry.utils.diffObject(this._actor.data.data, actorData);
            if (Object.keys(updateDiff).length > 0) {
                await this._actor.update({
                    data: foundry.utils.diffObject(this._actor.data.data, actorData),
                });
            }
        }

        // Build the formula
        let formula = [];
        if (this.object.ring.value > 0) {
            formula.push(`${this.object.ring.value}dr`);
        }
        if (this.object.skill.value > 0) {
            formula.push(`${this.object.skill.value}ds`);
        }

        let message;
        if (this.object.isInitiativeRoll) {
            // Initiative roll
            let msgOptions = {
                skillId: this.object.skill.id,
                difficulty: this.object.difficulty.value,
                difficultyHidden: this.object.difficulty.hidden,
                useVoidPoint: this.object.useVoidPoint,
                skillAssistance: this.object.skill.assistance,
                rnkMessage: null,
            };

            await this._actor.rollInitiative({
                rerollInitiative: true,
                initiativeOptions: {
                    formula: formula.join("+"),
                    // updateTurn: true,
                    messageOptions: msgOptions,
                },
            });
            // Adhesive tape to get the messageId :/
            message = msgOptions.rnkMessage;
            delete msgOptions.rnkMessage;
        } else {
            // Regular roll, so let's roll !
            const roll = await new game.l5r5e.RollL5r5e(formula.join("+"));

            roll.actor = this._actor;
            roll.l5r5e.stance = this.object.ring.id;
            roll.l5r5e.skillId = this.object.skill.id;
            roll.l5r5e.skillCatId = this.object.skill.cat;
            roll.l5r5e.difficulty = this.object.difficulty.value;
            roll.l5r5e.difficultyHidden = this.object.difficulty.hidden;
            roll.l5r5e.voidPointUsed = this.object.useVoidPoint;
            roll.l5r5e.skillAssistance = this.object.skill.assistance;

            await roll.roll();
            message = await roll.toMessage();
        }

        if (message) {
            new game.l5r5e.RollnKeepDialog(message.id).render(true);
        }

        return this.close();
    }

    /**
     * Change quantity between 0-9 on the element, and return the new value
     * @private
     */
    _quantityChange(element, add) {
        this.object[element].value = Math.max(Math.min(parseInt(this.object[element].value) + add, 9), 0);
    }

    /**
     * Remove the use of void point if actor don't have any and use of vp is un checked
     * @private
     */
    _updateVoidPointUsage() {
        if (
            this.object.useVoidPoint &&
            !this.object.difficulty.addVoidPoint &&
            !!this._actor &&
            this._actor.data.data.void_points.value < 1
        ) {
            this.object.useVoidPoint = false;
            this._quantityChange("ring", -1);
        }
    }

    /**
     * Create a macro on the first empty space in player's bar
     * @private
     */
    async _createMacro() {
        const params = {};
        let name = "DicePicker";

        if (this._actor?.id) {
            params.actorId = this._actor.id;
            name = this._actor.name;
        }

        if (this.object.skill.id) {
            params.skillId = this.object.skill.id;
        } else if (this.object.skill.cat) {
            params.skillCatId = this.object.skill.cat;
        }
        if (this.object.skill.name) {
            name = name + " - " + this.object.skill.name;
        }

        let command = `new game.l5r5e.DicePickerDialog(${JSON.stringify(params)}).render(true);`;

        let macro = game.macros.contents.find((m) => m.data.name === name && m.data.command === command);
        if (!macro) {
            macro = await Macro.create({
                name: name,
                type: "script",
                scope: "global",
                command: command,
                img: this._actor?.img ? this._actor.img : "systems/l5r5e/assets/dices/default/ring_et.svg",
            });
        }

        // Search if already in player hotbar
        if (Object.values(game.user.data.hotbar).includes(macro.id)) {
            return;
        }

        return game.user.assignHotbarMacro(macro, "auto"); // 1st available
    }
}
