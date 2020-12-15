import { L5R5E } from "../l5r5e-config.js";

/**
 * L5R Twenty Questions form
 * @extends {FormApplication}
 */
export class TwentyQuestionsDialog extends FormApplication {
    /**
     * Current actor data
     */
    actor = null;

    /**
     * Assign the default options
     * @override
     */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "l5r5e-twenty-questions-dialog",
            classes: ["l5r5e", "twenty-questions-dialog"],
            template: CONFIG.L5r5e.paths.templates + "sheets/twenty-questions-dialog.html",
            title: "L5R Twenty Questions", // TODO Localize
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
            skillsList: this._getSkills(),
            featsList: CONFIG.L5r5e.feats,
            actor: this.actor.data.data,
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
     * This method is called upon form submission after form data is validated
     * @param event    The initial triggering submission event
     * @param formData The object of validated form data with which to update the object
     * @returns        A Promise which resolves once the update operation has completed
     * @override
     */
    async _updateObject(event, formData) {
        // this.actor
        const actorTmp = this.actor.data.data; //.clone();

        console.log(actorTmp);

        actorTmp.identity.clan = formData.step1_clan;
        actorTmp.social.status = formData.step1_social_status;
        actorTmp.identity.family = formData.step2_family;
        // actorTmp = formData.step2_wealth;
        actorTmp.social.glory = formData.step2_social_glory;
        actorTmp.identity.school = formData.step3_school;
        actorTmp.identity.roles = formData.step3_roles;
        // actorTmp = formData.step3_feat_kata;
        // actorTmp = formData.step3_feat_kiho;
        // actorTmp = formData.step3_feat_invocations;
        // actorTmp = formData.step3_feat_rituals;
        // actorTmp = formData.step3_feat_shuji;
        // actorTmp = formData.step3_feat_maho;
        // actorTmp = formData.step3_feat_ninjutsu;
        // actorTmp = formData.step3_feats;
        // actorTmp = formData.step3_school_ability;
        // actorTmp = formData.step3_equipment;
        actorTmp.social.honor = formData.step3_social_honor;
        // actorTmp = formData.step4_stand_out;
        actorTmp.social.giri = formData.step5_social_giri;
        actorTmp.social.ninjo = formData.step6_social_ninjo;
        // actorTmp = formData.step7_clan_relations;
        // actorTmp = formData.step7_social_add_glory;
        // actorTmp = formData.step8_bushido;
        // actorTmp = formData.step8_social_add_honor;
        // actorTmp = formData.step9_success;
        // actorTmp = formData.step9_distinction;
        // actorTmp = formData.step10_difficulty;
        // actorTmp = formData.step10_adversity;
        // actorTmp = formData.step11_calms;
        // actorTmp = formData.step11_passion;
        // actorTmp = formData.step12_worries;
        // actorTmp = formData.step12_failure;
        // actorTmp = formData.step13_most_learn;
        // actorTmp = formData.step13_disadvantage;
        // actorTmp = formData.step13_advantage;
        // actorTmp = formData.step14_first_sight;
        // actorTmp = formData.step14_special_features;
        // actorTmp = formData.step15_stress;
        // actorTmp = formData.step16_relations;
        // actorTmp = formData.step16_item;
        // actorTmp = formData.step17_parents_pov;
        // actorTmp = formData.step18_heritage_name;
        // actorTmp = formData.step18_heritage_1;
        // actorTmp = formData.step18_heritage_2;
        actorTmp.name = actorTmp.identity.family + " " + formData.step19_firstname;
        // actorTmp = formData.step20_death;

        const rings = this._filterRingOrSkills(formData.rings);
        const skills = this._filterRingOrSkills(formData.skills);

        // TODO
        console.log(rings, skills, actorTmp, formData);

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
     * Load elements list (id, label)
     * @private
     */
    _getElements() {
        return CONFIG.L5r5e.stances.map((e) => {
            return {
                id: e,
                label: game.i18n.localize(`l5r5e.rings.${e}`),
            };
        });
    }

    /**
     * Load Skills list (id, cat, label)
     * @private
     */
    _getSkills() {
        const skills = {};
        Array.from(L5R5E.skills).forEach(([id, cat]) => {
            if (!skills[cat]) {
                skills[cat] = [];
            }
            skills[cat].push({
                id: id,
                cat: cat,
                label: game.i18n.localize(`l5r5e.skills.${cat}.${id}`),
            });
        });
        return skills;
    }
}
