/**
 * L5R Dice picker dialog
 * @extends {FormApplication}
 */
import { RollL5r5e } from "./roll.js";

export class DicePickerDialog extends Application {
    /**
     * Current Actor
     */
    actor = null;

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
            width: 400,
            // height: 400,
            // title: "L5R Dice Roller",
            actor: null,
            skillId: "",
        });
    }

    /**
     * Create dialog
     * @param options actor, skillId
     */
    constructor(options = null) {
        super(options);

        // Get Actor from: sheet, selected token, nothing
        const actor = options?.actor || canvas.tokens.controlled[0]?.actor || null;
        if (actor instanceof Actor) {
            this.actor = actor;
        }

        // Skill ?
        if (options?.skillId) {
            this.setSkillData(options.skillId);
        }
    }

    /**
     * Add the Entity name into the window title
     * @type {String}
     */
    get title() {
        return `L5R Dice Roller` + (this.actor ? " - " + this.actor.data.name : "");
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

            let formula = [];
            if (ring > 0) {
                formula.push(`${ring}dr`);
            }
            if (skill > 0) {
                formula.push(`${skill}ds`);
            }

            const roll = await new RollL5r5e(formula.join("+"));

            roll.l5r5e.stance = approach;
            roll.l5r5e.skillId = this.skillData.id;
            roll.l5r5e.actor = this.actor;

            await roll.roll();
            await roll.toMessage();
            await this.close();
        });

        // Check if a stance is selected
        let selectedStance = "air";
        if (this.actor) {
            ["air", "earth", "fire", "water", "void"].forEach((e) => {
                if (this.actor.data.data?.stances?.[e]?.isSelected?.value) {
                    selectedStance = e;
                }
            });
        }
        html.find(`#approach_${selectedStance}`).trigger("click");
        html.find("#skill_" + this.skillData.value).trigger("click");
    }

    /**
     * Load skill's required data from actor and skillId
     */
    setSkillData(skillId) {
        if (!skillId) {
            return;
        }

        this.skillData = {
            id: skillId.toLowerCase().trim(),
            value: 0,
            cat: "",
            name: "",
        };

        const cat = RollL5r5e.getCategoryForSkillId(skillId);
        if (!cat) {
            return;
        }
        this.skillData.cat = cat;
        this.skillData.name = game.i18n.localize("l5r5e.skills." + cat + "." + this.skillData.id);
        this.skillData.value = this.actor?.data?.data?.skills[cat]?.[this.skillData.id].value || 0;
    }

    /**
     * Load elements (id, label, value)
     * @private
     */
    _getElements() {
        return ["air", "earth", "fire", "water", "void"].map((e) => {
            return {
                id: e,
                label: game.i18n.localize(`l5r5e.rings.${e}`),
                value: this.actor?.data?.data?.rings?.[e] || 0,
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
