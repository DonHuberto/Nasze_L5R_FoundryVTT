import { RollL5r5e } from "./roll.js";

/**
 * L5R Dice picker dialog
 * @extends {FormApplication}
 */
export class DicePickerDialog extends FormApplication {
    /**
     * Current Actor
     */
    _actor = null;

    /**
     * Preset ring (attribute / approach)
     */
    _ringId = null;

    /**
     * Preset Skill (and data from actor if actor provided)
     */
    _skillData = {
        id: "",
        value: 0,
        cat: "",
        name: "",
    };

    /**
     * Difficulty
     */
    _difficulty = {
        difficulty: 2,
        isHidden: false,
    };

    /**
     * Assign the default options
     * @override
     */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "l5r5e-dice-picker-dialog",
            classes: ["l5r5e", "dice-picker-dialog"],
            template: CONFIG.l5r5e.paths.templates + "dice/dice-picker-dialog.html",
            title: "L5R Dice Roller",
            width: 660,
            height: 460,
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
     * ex: new game.l5r5e.DicePickerDialog({skillId: 'aesthetics', ringId: 'fire', actor: game.user.character}).render();
     *
     * Options :
     *   actor             A instance of actor (game.user.character, canvas.tokens.controlled[0].actor, ...)
     *   actorId           string (AbYgKrNwWeAxa9jT)
     *   ringId            string (fire)
     *   skillId           string (design)
     *   difficulty        number (0-9)
     *   difficultyHidden  boolean
     *
     * @param options actor, actorId, ringId, skillId, skillCatId, difficulty, difficultyHidden
     */
    constructor(options = {}) {
        super({}, options);

        // Try to get Actor from: options, first selected token or player's selected character
        [
            options?.actor,
            game.actors.get(options?.actorId),
            canvas.tokens.controlled[0]?.actor,
            game.user.character,
        ].forEach((actor) => {
            if (!this._actor) {
                this.actor = actor;
            }
        });

        // Ring
        if (options?.ringId) {
            this.ringId = options.ringId;
        }

        // Skill / SkillCategory
        if (options?.skillId) {
            this.skillId = options.skillId;
        }

        // SkillCategory skillCatId
        if (options?.skillCatId) {
            this.skillCatId = options.skillCatId;
        }

        // Difficulty
        if (options?.difficulty) {
            this.difficulty = options.difficulty;
        }

        // difficultyHidden
        if (options?.difficultyHidden) {
            this.difficultyHidden = options.difficultyHidden;
        }
    }

    /**
     * Set actor
     * @param actor
     */
    set actor(actor) {
        this._actor = actor instanceof Actor && actor.owner ? actor : null;
    }

    /**
     * Set ring preset
     * @param ringId
     */
    set ringId(ringId) {
        this._ringId = CONFIG.l5r5e.stances.includes(ringId) || null;
    }

    /**
     * Set and load skill's required data from actor and skillId
     * @param skillId
     */
    set skillId(skillId) {
        if (!skillId) {
            return;
        }

        this._skillData = {
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

        this._skillData = {
            ...this._skillData,
            value: 0,
            cat: skillCatId.toLowerCase().trim(),
            name: game.i18n.localize("l5r5e.skills." + skillCatId + "." + (this._skillData.id || "title")),
        };

        if (!this._actor) {
            return;
        }
        switch (this._actor.data.type) {
            case "character":
                this._skillData.value = this._actor.data.data.skills[skillCatId]?.[this._skillData.id] || 0;
                break;

            case "npc":
                // Skill value is in categories for npc
                this._skillData.value = this._actor.data.data.skills[skillCatId] || 0;
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
            difficulty = null;
        }
        this._difficulty.difficulty = difficulty;
    }

    /**
     * Set if Difficulty is Hidden or not (default)
     * @param isHidden
     */
    set difficultyHidden(isHidden) {
        this._difficulty.isHidden = !!isHidden;
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
            dicesList: [0, 1, 2, 3, 4, 5, 6],
            skillData: this._skillData,
            actor: this._actor,
            actorIsPc: !this._actor || this._actor.data?.type === "character",
            difficulty: this._difficulty,
            canUseVoidPoint: !this._actor || this._actor.data.data.void_points.value > 0,
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

        // On change approaches
        html.find('input[name="approach"]').on("click", async (event) => {
            $("#ring_value").val(event.target.value);
            $(".ring-selection").removeClass("ring-selected");
            $("." + event.target.dataset.ringid).addClass("ring-selected");
            $("#stance_label").html(
                game.i18n.localize("l5r5e.skills." + this._skillData.cat + "." + event.target.dataset.ringid)
            );
        });

        // ****************** DIFF ******************
        // Difficulty - Add button
        html.find("#diff_add").on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            this._difficulty.difficulty = this._quantityChange("#diff_value", 1);
        });

        // Difficulty - Subtract button
        html.find("#diff_sub").on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            this._difficulty.difficulty = this._quantityChange("#diff_value", -1);
        });

        // Difficulty - hidden checkbox
        html.find("#diff_hidden").on("click", async (event) => {
            this._difficulty.isHidden = !this._difficulty.isHidden;
            $("#difficulty_picker").toggle();
        });

        // ****************** RING ******************
        // Ring - Add button
        html.find("#ring_add").on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            this._quantityChange("#ring_value", 1);
        });

        // Ring - Subtract button
        html.find("#ring_sub").on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            this._quantityChange("#ring_value", -1);
        });

        // Ring - Spend a Void point checkbox
        html.find("#use_void_point").on("click", async (event) => {
            this._quantityChange("#ring_value", event.target.checked ? 1 : -1);
            html.find("#use_void_point").attr("checked", event.target.checked);
        });

        // ****************** SKILL ******************
        // Skill - Add button
        html.find("#skill_add").on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            this._quantityChange("#skill_value", 1);
        });

        // Skill - Subtract button
        html.find("#skill_sub").on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            this._quantityChange("#skill_value", -1);
        });

        // Skill - Default Dice div
        html.find("#skill_default_value").on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            $("#skill_value").val(this._skillData.value);
        });

        // ****************** INIT ******************
        // Select current actor's stance
        html.find(`.approach_${this._actor ? this._actor.data.data.stance : "void"}`)
            .first()
            .trigger("click");

        // Set skill point
        html.find("#skill_value").val(this._skillData.value);
    }

    /**
     * This method is called upon form submission after form data is validated
     * @param event    The initial triggering submission event
     * @param formData The object of validated form data with which to update the object
     * @returns        A Promise which resolves once the update operation has completed
     * @override
     */
    async _updateObject(event, formData) {
        const approach = $(".ring-selection.ring-selected > input").data("ringid") || null;
        const ring = formData.ring || null;
        const skill = formData.skill || null;

        if (!approach || !skill || !ring || (skill < 1 && ring < 1)) {
            return false;
        }

        let formula = [];
        if (ring > 0) {
            formula.push(`${ring}dr`);
        }
        if (skill > 0) {
            formula.push(`${skill}ds`);
        }

        // Update Actor
        if (this._actor) {
            // TODO update actor stance ? good idea or not, choice-able ?
            // this._actor.data.data.stance = approach;

            // If Void point is used, minus the actor
            if (formData.use_void_point) {
                this._actor.data.data.void_points.value = Math.max(this._actor.data.data.void_points.value - 1, 0);
            }

            // If hidden add void 1pt
            // this._difficulty.isHidden = !!formData.diff_hidden;
            // this._difficulty.difficulty = formData.diff;
            if (this._difficulty.isHidden) {
                this._actor.data.data.void_points.value = Math.min(
                    this._actor.data.data.void_points.value + 1,
                    this._actor.data.data.void_points.max
                );
            }
        }

        // Let's roll !
        const roll = await new RollL5r5e(formula.join("+"));

        roll.actor = this._actor;
        roll.l5r5e.stance = approach;
        roll.l5r5e.skillId = this._skillData.id;
        roll.l5r5e.skillCatId = this._skillData.cat;
        roll.l5r5e.summary.difficulty = this._difficulty.difficulty;
        roll.l5r5e.summary.difficultyHidden = this._difficulty.isHidden;

        await roll.roll();
        await roll.toMessage();
        return this.close();
    }

    /**
     * Change quantity between 0-9 on the element, and return the new value
     * @private
     */
    _quantityChange(elmtSelector, add) {
        const elmt = $(elmtSelector);
        const value = Math.max(Math.min(parseInt(elmt.val()) + add, 9), 0);
        elmt.val(value);
        return value;
    }

    /**
     * Create a macro on the first empty space in player's bar
     * @private
     */
    async _createMacro() {
        const params = {};
        let name = "DicePicker";

        if (this._actor?._id) {
            params.actorId = this._actor._id;
            name = this._actor.name;
        }

        if (this._skillData.id) {
            params.skillId = this._skillData.id;
        } else if (this._skillData.cat) {
            params.skillCatId = this._skillData.cat;
        }
        if (this._skillData.name) {
            name = name + " - " + this._skillData.name;
        }

        let command = `new game.l5r5e.DicePickerDialog(${JSON.stringify(params)}).render(true);`;

        let macro = game.macros.entities.find((m) => m.data.name === name && m.data.command === command);
        if (!macro) {
            macro = await Macro.create({
                name: name,
                type: "script",
                scope: "global",
                command: command,
                img: this._actor?.img ? this._actor.img : "systems/l5r5e/assets/dices/default/ring_et.svg",
            });
        }

        // Search for slot (Fix for FVTT)
        // slot = false will normally do the 1st available, but always return 0
        const slot = Array.fromRange(50).find((i) => {
            if (i < 1) {
                return false;
            }
            return !(i in game.user.data.hotbar);
        });

        // return game.user.assignHotbarMacro(macro, false); // 1st available
        return game.user.assignHotbarMacro(macro, slot);
    }
}
