/**
 * L5R Dice picker dialog
 * @extends {FormApplication}
 */
import { RollL5r5e } from "./roll.js";

export class DicePickerDialog extends Application {
    static stances = ["earth", "air", "water", "fire", "void"];

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
            template: "systems/l5r5e/templates/dice/dice-picker-dialog.html",
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
     * Create dialog
     *
     * ex: new game.l5r5e.DicePickerDialog({skillId: 'aesthetics', ringId: 'fire', actor: game.user.character}).render();
     *
     * @param options actor, ringId, skillId, difficulty, difficultyHidden
     */
    constructor(options = null) {
        super(options);

        // Try to get Actor from: options, first selected token or player's selected character
        [options?.actor, canvas.tokens.controlled[0]?.actor, game.user.character].forEach((actor) => {
            if (!this._actor) {
                this.actor = actor;
            }
        });

        // Ring ?
        if (options?.ringId) {
            this.ringId = options.ringId;
        }

        // Skill ?
        if (options?.skillId) {
            this.skillId = options.skillId;
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
        this._ringId = DicePickerDialog.stances.includes(ringId) || null;
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

        const cat = RollL5r5e.getCategoryForSkillId(skillId);
        if (!cat) {
            return;
        }
        this._skillData.cat = cat;
        this._skillData.name = game.i18n.localize("l5r5e.skills." + cat + "." + this._skillData.id);
        this._skillData.value = this._actor?.data?.data?.skills[cat]?.[this._skillData.id].value || 0;
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
            elementsList: this._getElements(),
            dicesList: [0, 1, 2, 3, 4, 5, 6],
            skillData: this._skillData,
            actor: this._actor,
            difficulty: this._difficulty,
            canUseVoidPoint: !this._actor || this._actor.data.data.void_points.current > 0,
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

        // ****************** ROLL ******************
        // Roll button
        html.find('button[name="roll"]').on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();

            const approach = $(html.find(".ring-selection.ring-selected > input")[0]).data("ringid") || null;
            const ring = html.find("#ring_value")[0].value || null;
            const skill = html.find("#skill_value")[0].value || null;

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
                if ($("#use_void_point").attr("checked")) {
                    this._actor.data.data.void_points.current = Math.max(
                        this._actor.data.data.void_points.current - 1,
                        0
                    );
                }

                // If hidden add void 1pt
                if (this._difficulty.isHidden) {
                    this._actor.data.data.void_points.current = Math.min(
                        this._actor.data.data.void_points.current + 1,
                        this._actor.data.data.void_points.max
                    );
                }
            }

            // Let's roll !
            const roll = await new RollL5r5e(formula.join("+"));

            roll.actor = this._actor;
            roll.l5r5e.stance = approach;
            roll.l5r5e.skillId = this._skillData.id;
            roll.l5r5e.summary.difficulty = this._difficulty.difficulty;
            roll.l5r5e.summary.difficultyHidden = this._difficulty.isHidden;

            await roll.roll();
            await roll.toMessage();
            await this.close();
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
     * Load elements (id, label, value)
     * @private
     */
    _getElements() {
        return DicePickerDialog.stances.map((e) => {
            return {
                id: e,
                label: game.i18n.localize(`l5r5e.rings.${e}`),
                value: this._actor?.data?.data?.rings?.[e] || 0,
            };
        });
    }

    // /**
    //  * Return a reference to the target attribute
    //  * @type {String}
    //  */
    // get attribute() {
    //     console.log('L5R.DicePickerDialog.attribute', this); // TODO tmp
    //
    //     return this.options.name;
    // }
}
