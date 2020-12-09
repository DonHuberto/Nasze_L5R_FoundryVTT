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
     * Skill data from actor
     */
    skillData = {};

    elementsList = [];
    dicesList = [1, 2, 3, 4, 5, 6];

    /**
     * Assign the default options
     * @override
     */
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "dice-picker";
        options.template = "systems/l5r5e/templates/dice/dice-picker-dialog.html";
        options.width = 400;
        return options;
    }

    /**
     * Create dialog
     * @param options actor
     */
    constructor(options = null) {
        super(options);

        // Get Actor from: sheet, selected token, nothing
        this.actor = options?.actor || canvas.tokens.controlled[0]?.actor.data || null;

        if (!!this.actor && options?.skillId) {
            this._loadSkillData(options?.skillId);
        }

        this.elementsList = ["air", "earth", "fire", "water", "void"].map((e) => {
            return { element: e, label: game.i18n.localize(`L5r5e.Rings.${e.capitalize()}`) };
        });

        console.log("DicePickerDialog.constructor", options, this);
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
            truc: true,
        };
    }

    /**
     * Render the dialog
     * @param force
     * @param options
     * @returns {Application}
     */
    render(force, options) {
        console.log("DicePickerDialog.render !", force, options);

        if (force === undefined) {
            force = true;
        }

        options = {};

        return super.render(force, options);
    }
    //
    // /**
    //  * Display dialog for rolling dices
    //  */
    // async show(params) {
    //     const unqId = randomID();
    //
    //
    //     // Dialog Template
    //     let content = await renderTemplate("systems/l5r5e/templates/dice/dice-picker-dialog.html", {
    //         id: unqId,
    //         elementsList: ["air", "earth", "fire", "water", "void"].map(e => {
    //             return { element: e, label: game.i18n.localize(`L5r5e.Rings.${e.capitalize()}`) };
    //         }),
    //         dicesList: [1, 2, 3, 4, 5, 6],
    //         currentActor: currentActor
    //     });
    //
    //     new Dialog({
    //         title: "L5R Dice Roller" + (currentActor ? " - " + currentActor.name : ""),
    //         content: content,
    //         buttons: {
    //             yes: {
    //                 icon: "<i class='fas fa-check'></i>",
    //                 label: "Roll !",
    //                 callback: async (html) => {
    //                     const approach = html.find("input[name=\"approach\"]:checked")[0].value || null;
    //                     const ring = html.find("input[name=\"ring\"]:checked")[0].value || null;
    //                     const skill = html.find("input[name=\"skill\"]:checked")[0].value || null;
    //
    //                     if (!approach || !skill || !ring || (skill < 1 && ring < 1)) {
    //                         return false;
    //                     }
    //
    //                     // TODO skill
    //                     await new RollL5r5e(
    //                         `${ring}dr[${approach}]`
    //                         + ` + ${skill}ds[unknown skill]`
    //                     ).roll().toMessage();
    //
    //                     // const message = await roll.toMessage();
    //                     //
    //                     // // const message = game.specialDiceRoller.l5r.rollFormula(
    //                     // //     "r".repeat(ring) + "s".repeat(skill)
    //                     // //     , `${game.i18n.localize("L5R.Rings." + approach)}` + (!!skillData?.name ? ` (${skillData?.name})` : "")
    //                     // // );
    //                     //
    //                     // ChatMessage.create({
    //                     //     flags: {},
    //                     //     // isRoll: true,
    //                     //     user: game.user._id,
    //                     //     speaker: ChatMessage.getSpeaker(),
    //                     //     content: message,
    //                     // }, currentActor ?? {});
    //
    //                 }
    //             },
    //             no: {
    //                 icon: "<i class='fas fa-times'></i>",
    //                 label: "Cancel"
    //             }
    //         },
    //         default: "no"
    //     }).render(true);
    // }

    /**
     * Listen to html elements
     * @override
     */
    activateListeners(html) {
        console.log("activateListeners", html);

        super.activateListeners(html);

        // on change approaches
        html.find('input[name="approach"]:checked').on("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();

            console.log("approach clicked !");

            this.close();
        });
    }

    /**
     * Load skill's required data from actor and skillId
     *
     * @param skillId
     * @private
     */
    _loadSkillData(skillId) {
        if (!this.actor || typeof skillId == "undefined") {
            return;
        }

        this.skillData = {
            id: skillId.trim(),
            dices: 0,
            cat: "",
            name: "",
        };

        this.skillData.cat = Object.keys(this.actor.data.skills).find(
            (e) => !!this.actor.data.skills[e][this.skillData.id]
        );
        this.skillData.dices = this.actor.data.skills[this.skillData.cat][this.skillData.id].value ?? 0;
        this.skillData.name = game.i18n.localize("L5r5e.Skills." + this.skillData.cat + "." + this.skillData.id);
    }

    // static changeElementsByToken(sElmt) {
    //     if (DicePickerDialog.currentActor?.data) {
    //         $("#ring_dices_" + DicePickerDialog.currentActor.data.rings[sElmt]).prop("checked", true);
    //     }
    // }

    /**
     * Helper for dices radios
     */
    // static fctRadioDice(params) {
    //     let defaults = { name: "radio", min: 0, max: 6, selected: null };
    //     params = { ...defaults, ...params };
    //     if (params.selected === null) {
    //         params.selected = params.min;
    //     }
    //     let s = "";
    //     let id = "";
    //     for (let idx = 0; idx <= params.max; idx++) {
    //         id = `${params.name.toLowerCase()}_${idx}`;
    //         s += ` <input type="radio" id="${id}" name="${params.name}" value="${idx}" ${idx === params.selected ? "checked" : ""} ${idx < params.min ? "disabled" : ""}>`;
    //         s += ` <label for="${id}">${idx}</label>`;
    //     }
    //     return s;
    // }

    /**
     * Helper for element radios
     */
    // static fctRadioElements(name) {
    //     let s = "";
    //     let id = "";
    //     ["air", "earth", "fire", "water", "void"].forEach((element, idx) => {
    //         id = `${name.toLowerCase()}_${element}`;
    //         s += ` <input type="radio" id="${id}" name="${name}" value="${element}" ${idx === 0 ? "checked" : ""} onclick="DicePickerDialog.changeElementsByToken('${element}')">`;
    //         s += ` <label for="${id}"><i class="i_${element} ${element}" title="${game.i18n.localize("L5R.Rings." + element)}"></i></label>`;
    //     });
    //     return s;
    // }

    // /** @override */
    // static get defaultOptions() {
    //
    //     console.log('L5R.DicePickerDialog.defaultOptions', this); // TODO tmp
    //
    //     return mergeObject(super.defaultOptions, {
    //         id: "l5r5e-dice-picker-dialog",
    //         classes: ["l5r5e", "dice-picker-dialog"],
    //         title: "Skill List Importer",
    //         width: 400,
    //         height: 400,
    //         template: "systems/l5r5e/templates/dice/dice-picker-dialog.html"
    //     });
    // }
    //
    // /**
    //  * Return a reference to the target attribute
    //  * @type {String}
    //  */
    // get attribute() {
    //     console.log('L5R.DicePickerDialog.attribute', this); // TODO tmp
    //
    //     return this.options.name;
    // }
    //
    // /** @override */
    // async getData() {
    //
    //     console.log('L5R.DicePickerDialog.getData', this); // TODO tmp
    //
    //     // $(".import-progress").addClass("import-hidden");
    //
    //     // if (!CONFIG?.temporary) {
    //     //     CONFIG.temporary = {};
    //     // }
    //
    //     return {
    //         cssClass: "dice-picker-dialog"
    //     };
    // }
    //
    // /** @override */
    // activateListeners(html) {
    //     console.log('L5R.DicePickerDialog.activateListeners', this); // TODO tmp
    //
    //     super.activateListeners(html);
    //
    //     html.find(".reset-button").on("click", async (event) => {
    //         event.preventDefault();
    //         event.stopPropagation();
    //         this.close();
    //     });
    //
    //
    //     html.find(".dialog-button").on("click", async (event) => {
    //         event.preventDefault();
    //         event.stopPropagation();
    //
    //         const form = html[0];
    //         if (!form.data.files.length) return ui.notifications.error("You did not upload a data file!");
    //
    //         // let currentSkillList = await JSON.parse(game.settings.get("starwarsffg", "arraySkillList"));
    //         // const newSkillList = JSON.parse(text);
    //         // const newMasterSkillListData = JSON.stringify(currentSkillList);
    //         // window.location.reload();
    //
    //         this.close();
    //     });
    // }
}
