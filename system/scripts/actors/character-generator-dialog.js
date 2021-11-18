import { CharacterGenerator } from "./character-generator.js";

/**
 * L5R NPC Generator form
 *
 * @extends {FormApplication}
 */
export class CharacterGeneratorDialog extends FormApplication {
    /**
     * Current actor data
     */
    actor = null;

    /**
     * Payload Object
     */
    object = {
        avg_rings: 3,
        clan: "random",
        gender: "random",
        generateAttributes: true,
        generateDemeanor: true,
        generateName: true,
        generateNarrative: true,
        generatePeculiarities: true,
        generateItems: true,
        generateSocial: true,
    };

    /**
     * Assign the default options
     * @override
     */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "l5r5e-character-generator-dialog",
            classes: ["l5r5e", "character-generator-dialog"],
            template: CONFIG.l5r5e.paths.templates + "actors/character-generator-dialog.html",
            title: game.i18n.localize("l5r5e.char_generator.title"),
            // width: 600,
            // height: 360,
            resizable: false,
            closeOnSubmit: false,
            submitOnClose: false,
            submitOnChange: false,
        });
    }

    /**
     * Define a unique and dynamic element ID for the rendered ActorSheet application
     */
    get id() {
        return `l5r5e-npc-generator-dialog-${this.actor.id}`;
    }

    /**
     * Create dialog
     */
    constructor(actor = null, options = {}) {
        super({}, options);
        this.actor = actor;
    }

    /**
     * Construct and return the data object used to render the HTML template for this form application.
     * @param options
     * @return {Object}
     */
    async getData(options = null) {
        const clans = Object.keys(CharacterGenerator.clansAndFamilies).map((e) => ({
            id: e,
            label: game.i18n.localize("l5r5e.clans." + e),
        }));
        return {
            ...super.getData(options),
            isNpc: this.actor.type === "npc",
            clanList: [{ id: "random", label: game.i18n.localize("l5r5e.random") }, ...clans],
            genderList: [
                { id: "random", label: game.i18n.localize("l5r5e.random") },
                { id: "male", label: game.i18n.localize("l5r5e.gender.male") },
                { id: "female", label: game.i18n.localize("l5r5e.gender.female") },
            ],
            data: this.object,
        };
    }

    /**
     * This method is called upon form submission after form data is validated
     * @param event    The initial triggering submission event
     * @param formData The object of validated form data with which to update the object
     * @returns        A Promise which resolves once the update operation has completed
     * @override
     */
    async _updateObject(event, formData) {
        // Generate datas
        const generator = new CharacterGenerator({
            avgRingsValue: formData.avg_rings,
            clanName: formData.clan,
            gender: formData.gender,
        });

        // Update current Object with new data to keep selection
        this.object = formData;

        // Update actor with selection
        const updatedDatas = await generator.toActor(this.actor, formData);
        await this.actor.update(updatedDatas);

        this.render(false);
    }
}
