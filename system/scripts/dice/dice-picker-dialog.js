/**
 * L5R Dice picker dialog
 * @extends {FormApplication}
 */
import { RollL5r5e } from "./roll.js";

export class DicePickerDialog extends Application {
    /**
     * Current actor
     */
    actor = {};

    /**
     * Selected Skill data from actor
     */
    skillData = {
        id: "",
        value: 0,
        cat: "",
        name: "",
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
            width: 360,
            // height: 400,
            // title: "L5R Dice Roller",
        });
    }

    /**
     * Create dialog
     * @param options actor, skillId
     */
    constructor(options = null) {
        super(options);

        // Get Actor from: sheet, selected token, nothing
        this.actor = options?.actor || canvas.tokens.controlled[0]?.actor.data || null;

        // Skill ?
        if (!!this.actor && !!options?.skillId) {
            this.setSkillData(options.skillId);
        }
    }

    /**
     * Add the Entity name into the window title
     * @type {String}
     */
    get title() {
        return `L5R Dice Roller` + (this.actor ? " - " + this.actor.name : "");
    }

    /**
     * Construct and return the data object used to render the HTML template for this form application.
     * @param options
     * @return {Object}
     */
    getData(options = null) {
        return {
            elementsList: this._getElements(),
            dicesList: [0, 1, 2, 3, 4, 5, 6],
            skillData: this.skillData,
            actor: this.actor,
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

        // on change approaches
        html.find('input[name="approach"]').on("click", async (event) => {
            $("#ring_" + event.target.dataset.dice).prop("checked", true);
        });

        // Roll button
        html.find('button[name="roll"]').on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();

            const approach = html.find('input[name="approach"]:checked')[0].value || null;
            const ring = html.find('input[name="ring"]:checked')[0].value || null;
            const skill = html.find('input[name="skill"]:checked')[0].value || null;

            if (!approach || !skill || !ring || (skill < 1 && ring < 1)) {
                return false;
            }

            await new RollL5r5e(
                `${ring}dr[${approach}] + ${skill}ds` + (this.skillData.id ? `[${this.skillData.id}]` : "")
            )
                .roll()
                .toMessage();

            await this.close();
        });

        // Default Selected
        html.find("#approach_air").trigger("click");
        html.find("#skill_" + this.skillData.value).trigger("click");
    }

    /**
     * Load skill's required data from actor and skillId
     */
    setSkillData(skillId) {
        if (!skillId) {
            return;
        }

        const skillData = {
            id: skillId.trim(),
            value: 0,
            cat: "",
            name: "",
        };

        if (!this.actor) {
            return;
        }

        skillData.cat = Object.keys(this.actor.data.skills).find((e) => !!this.actor.data.skills[e][skillData.id]);
        skillData.value = this.actor.data.skills[skillData.cat][skillData.id].value ?? 0;
        skillData.name = game.i18n.localize("L5r5e.Skills." + skillData.cat + "." + skillData.id);

        return skillData;
    }

    /**
     * Load elements (id, label, value)
     * @private
     */
    _getElements() {
        return ["air", "earth", "fire", "water", "void"].map((e) => {
            return {
                id: e,
                label: game.i18n.localize(`L5r5e.Rings.${e.capitalize()}`),
                value: this.actor ? this.actor.data.rings[e] : 0,
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
