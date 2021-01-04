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
     * Payload Object
     */
    object = {
        ring: {
            id: null,
            value: 1,
        },
        skill: {
            id: "",
            value: 0,
            default_value: 0,
            cat: "",
            name: "",
        },
        difficulty: {
            value: 2,
            hidden: false,
        },
        useVoidPoint: false,
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
        if (!actor || !(actor instanceof Actor) || !actor.owner) {
            return;
        }
        this._actor = actor;
        if (this.object.ring.id === null) {
            this.ringId = this._actor.data.data.stance;
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
                this.object.skill.default_value = this.object.skill.value;
                break;

            case "npc":
                // Skill value is in categories for npc
                this.object.skill.value = this._actor.data.data.skills[skillCatId] || 0;
                this.object.skill.default_value = this.object.skill.value;
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
        this.object.difficulty.hidden = !!isHidden;
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
                this.object.difficulty.hidden || !this._actor || this._actor.data.data.void_points.value > 0,
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

        // Select Ring
        html.find('input[name="approach"]').on("click", async (event) => {
            this.object.ring.id = event.target.dataset.ringid;
            this.object.ring.value = event.target.value;
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

        // Click on the Default Skill Dice
        html.find("#skill_default_value").on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.object.skill.value = this.object.skill.default_value;
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
            if (
                this.object.useVoidPoint &&
                !this.object.difficulty.hidden &&
                !!this._actor &&
                this._actor.data.data.void_points.value < 1
            ) {
                this.object.useVoidPoint = false;
                this._quantityChange("ring", -1);
            }
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

        let formula = [];
        if (this.object.ring.value > 0) {
            formula.push(`${this.object.ring.value}dr`);
        }
        if (this.object.skill.value > 0) {
            formula.push(`${this.object.skill.value}ds`);
        }

        // Update Actor
        if (this._actor) {
            const actorData = duplicate(this._actor.data.data);

            // TODO update actor stance ? good idea or not, choice-able ?
            // actorData.stance = approach;

            // If hidden add 1 void pt
            if (this.object.difficulty.hidden) {
                actorData.void_points.value = Math.min(actorData.void_points.value + 1, actorData.void_points.max);
            }

            // If Void point is used, minus the actor
            if (this.object.useVoidPoint) {
                actorData.void_points.value = Math.max(actorData.void_points.value - 1, 0);
            }

            // Update actor
            this._actor.update({
                data: diffObject(this._actor.data.data, actorData),
            });
        }

        // Let's roll !
        const roll = await new RollL5r5e(formula.join("+"));

        roll.actor = this._actor;
        roll.l5r5e.stance = this.object.ring.id;
        roll.l5r5e.skillId = this.object.skill.id;
        roll.l5r5e.skillCatId = this.object.skill.cat;
        roll.l5r5e.summary.difficulty = this.object.difficulty.value;
        roll.l5r5e.summary.difficultyHidden = this.object.difficulty.hidden;
        roll.l5r5e.summary.voidPointUsed = this.object.useVoidPoint;

        await roll.roll();
        await roll.toMessage();
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

        if (this.object.skill.id) {
            params.skillId = this.object.skill.id;
        } else if (this.object.skill.cat) {
            params.skillCatId = this.object.skill.cat;
        }
        if (this.object.skill.name) {
            name = name + " - " + this.object.skill.name;
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

        // Search if already in player hotbar
        if (Object.values(game.user.data.hotbar).includes(macro._id)) {
            return;
        }

        // Search for slot (Fix for FVTT, will be fixed)
        // slot = false will normally do the 1st available, but always return 0
        // TODO see when issue is closed to remove these lines and use "assignHotbarMacro(macro, false)"
        // https://gitlab.com/foundrynet/foundryvtt/-/issues/4382
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
