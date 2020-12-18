import { L5R5E } from "../config.js";

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
     * Current form datas
     */
    datas = {};

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
            height: 600,
            resizable: true,
        });
    }

    /**
     * Create dialog
     */
    constructor(options = null, actor = null) {
        super(options);
        this.actor = actor;
        this.datas = this._initFormDatas(actor);
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
    getData(options = null) {
        console.log(game.l5r5e.HelpersL5r5e.getRingsList());
        return {
            ...super.getData(options),
            ringsList: game.l5r5e.HelpersL5r5e.getRingsList(),
            skillsList: game.l5r5e.HelpersL5r5e.getSkillsList(true),
            techniquesList: CONFIG.l5r5e.techniques,
            datas: this.datas,
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

        // html.find('input[name="approach"]').on("click", async (event) => {});
    }

    /**
     * Handle dropped items
     */
    _onDropItem(type, event) {
        console.log("*** _onDrop event", event, type);
        if (!["item", "technique", "peculiarity"].includes(type)) {
            return;
        }

        // Try to extract the data
        // {type: "Item", id: "pC37smMSCqu3aSRM"}
        let data;
        try {
            data = JSON.parse(event.dataTransfer.getData("text/plain"));
            if (data.type !== "Item") {
                return;
            }

            const item = game.items.get(data.id);
            if (item || item.data.type !== type) {
                return;
            }

            // TODO
            console.log("** OK ", item);
            // sub_type === 'peculiarity'
        } catch (err) {
            console.warn(err);
        }
        return false;
    }

    // _canDragDrop(event) {
    //     console.log("*** _canDragDrop event", event);
    //     return false;
    // }

    /**
     * This method is called upon form submission after form data is validated
     * @param event    The initial triggering submission event
     * @param formData The object of validated form data with which to update the object
     * @returns        A Promise which resolves once the update operation has completed
     * @override
     */
    async _updateObject(event, formData) {
        // this.actor
        const actorDatas = this.actor.data.data;
        //this.actor.data.twenty_questions = formData; // TODO a tester

        actorDatas.name = (formData.step2_family + " " + formData.step19_firstname).trim();
        actorDatas.zeni = formData.step2_wealth;
        actorDatas.identity = {
            ...actorDatas.identity,
            clan: formData.step1_clan,
            family: formData.step2_family,
            school: formData.step3_school,
            roles: formData.step3_roles,
        };

        actorDatas.social = {
            ...actorDatas.social,
            status: formData.step1_social_status,
            glory: formData.step2_social_glory,
            honor: formData.step3_social_honor,
            giri: formData.step5_social_giri,
            ninjo: formData.step6_social_ninjo,
        };

        actorDatas.techniques = {
            kata: !!formData.step3_technique_kata,
            kiho: formData.step3_technique_kiho,
            invocation: !!formData.step3_technique_invocation,
            ritual: !!formData.step3_technique_ritual,
            shuji: !!formData.step3_technique_shuji,
            maho: !!formData.step3_technique_maho,
            ninjutsu: !!formData.step3_technique_ninjutsu,
        };

        // actorDatas = formData.step3_techniques;
        // actorDatas = formData.step3_school_ability;
        // actorDatas = formData.step3_equipment;
        // actorDatas = formData.step4_stand_out;
        // actorDatas = formData.step7_clan_relations;
        // actorDatas = formData.step7_social_add_glory;
        // actorDatas = formData.step8_bushido;
        // actorDatas = formData.step8_social_add_honor;
        // actorDatas = formData.step9_success;
        // actorDatas = formData.step9_distinction;
        // actorDatas = formData.step10_difficulty;
        // actorDatas = formData.step10_adversity;
        // actorDatas = formData.step11_calms;
        // actorDatas = formData.step11_passion;
        // actorDatas = formData.step12_worries;
        // actorDatas = formData.step12_anxiety;
        // actorDatas = formData.step13_most_learn;
        // actorDatas = formData.step13_disadvantage;
        // actorDatas = formData.step13_advantage;
        // actorDatas = formData.step14_first_sight;
        // actorDatas = formData.step14_special_features;
        // actorDatas = formData.step15_stress;
        // actorDatas = formData.step16_relations;
        // actorDatas = formData.step16_item;
        // actorDatas = formData.step17_parents_pov;
        // actorDatas = formData.step18_heritage_name;
        // actorDatas = formData.step18_heritage_1;
        // actorDatas = formData.step18_heritage_2;
        // actorDatas = formData.step20_death;

        const rings = this._filterRingOrSkills(formData.rings);
        const skills = this._filterRingOrSkills(formData.skills);

        console.log(actorDatas);

        // TODO
        console.log(rings, skills, formData, actorDatas, this.actor);

        // return this.close();
    }

    _filterRingOrSkills(obj) {
        return obj
            .filter((e) => e !== "none")
            .reduce((acc, id) => {
                if (!acc.has(id)) {
                    acc.set(id, 0);
                }
                acc.set(id, acc.get(id) + 1);
                return acc;
            }, new Map());
    }

    /**
     * Initialize form array
     * @private
     */
    _initFormDatas(actor) {
        const actorDatas = actor.data.data;

        // already 20q struct ?
        if (actorDatas.twenty_questions?.step1_clan) {
            return actorDatas.twenty_questions;
        }

        // If not fill some values
        return {
            step1_clan: actorDatas.identity.clan,
            step1_social_status: actorDatas.social.status,
            step2_family: actorDatas.identity.family,
            step2_social_glory: actorDatas.social.glory,
            step3_school: actorDatas.identity.school,
            step3_roles: actorDatas.identity.roles,
            step3_technique_kata: actorDatas.techniques.kata,
            step3_technique_kiho: actorDatas.techniques.kiho,
            step3_technique_invocation: actorDatas.techniques.invocation,
            step3_technique_ritual: actorDatas.techniques.ritual,
            step3_technique_shuji: actorDatas.techniques.shuji,
            step3_technique_maho: actorDatas.techniques.maho,
            step3_technique_ninjutsu: actorDatas.techniques.ninjutsu,
            step3_social_honor: actorDatas.social.honor,
            step5_social_giri: actorDatas.social.giri,
            step6_social_ninjo: actorDatas.social.ninjo,
            step19_firstname: actor.data.name.replace(/^(?:\w+\s+)?(.+)$/gi, "$1") || "",
        };
    }
}
