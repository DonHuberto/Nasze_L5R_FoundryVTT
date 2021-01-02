/**
 * L5R Twenty Questions Base object
 */
export class TwentyQuestions {
    /**
     * Shortcut for all rings Id in data
     */
    static ringList = ["step1.ring", "step2.ring", "step3.ring1", "step3.ring2", "step4.ring"];

    /**
     * Shortcut for all skills Id in data
     */
    static skillList = [
        "step1.skill",
        "step2.skill1",
        "step2.skill2",
        "step3.skill1",
        "step3.skill2",
        "step3.skill3",
        "step3.skill4",
        "step3.skill5",
        "step7.skill",
        "step8.skill",
        "step13.skill",
        "step17.skill",
    ];

    /**
     * Shortcut for all Items to build cache
     */
    static itemsList = [
        "step3.techniques",
        "step3.school_ability",
        "step3.equipment",
        "step9.distinction",
        "step10.adversity",
        "step11.passion",
        "step12.anxiety",
        "step13.advantage",
        "step13.disadvantage",
        "step14.special_features",
        "step16.item",
    ];

    /**
     * All this object data (Steps)
     */
    data = {
        generated: false,
        step1: {
            clan: "",
            ring: "",
            skill: "",
            social_status: 30,
        },
        step2: {
            family: "",
            ring: "",
            skill1: "",
            skill2: "",
            wealth: 3,
            social_glory: 39,
        },
        step3: {
            school: "",
            roles: "",
            ring1: "",
            ring2: "",
            skill1: "",
            skill2: "",
            skill3: "",
            skill4: "",
            skill5: "",
            allowed_techniques: {
                kata: false,
                kiho: false,
                invocation: false,
                ritual: false,
                shuji: false,
                maho: false,
                ninjutsu: false,
            },
            techniques: [],
            school_ability: [],
            equipment: [],
            social_honor: 30,
        },
        step4: {
            stand_out: "",
            ring: "",
        },
        step5: {
            social_giri: "",
        },
        step6: {
            social_ninjo: "",
        },
        step7: {
            clan_relations: "",
            skill: "",
            social_add_glory: 5,
        },
        step8: {
            bushido: "",
            skill: "",
            social_add_honor: 10,
        },
        step9: {
            success: "",
            distinction: [],
        },
        step10: {
            difficulty: "",
            adversity: [],
        },
        step11: {
            calms: "",
            passion: [],
        },
        step12: {
            worries: "",
            anxiety: [],
        },
        step13: {
            most_learn: "",
            skill: "",
            advantage: [],
            disadvantage: [],
        },
        step14: {
            first_sight: "",
            special_features: [],
        },
        step15: {
            stress: "",
        },
        step16: {
            relations: "",
            item: [],
        },
        step17: {
            parents_pov: "",
            skill: "",
        },
        step18: {
            heritage_name: "",
            heritage_1: null,
            heritage_2: null,
        },
        step19: {
            firstname: "",
        },
        step20: {
            death: "",
        },
    };

    /**
     * Create
     */
    constructor(actor = null) {
        if (actor instanceof Actor) {
            this.fromActor(actor);
        }
    }

    /**
     * Update object with form data
     */
    updateFromForm(formData) {
        this.data = mergeObject(this.data, expandObject(formData));
    }

    /**
     * Initialize data from a actor
     */
    fromActor(actor) {
        const actorDatas = actor.data.data;

        // already 20q struct ?
        if (actorDatas.twenty_questions?.step1?.clan) {
            this.data = {
                ...this.data,
                ...actorDatas.twenty_questions,
            };
            return;
        }

        // If not fill some values
        this.data.step1.clan = actorDatas.identity.clan;
        this.data.step2.family = actorDatas.identity.family;
        this.data.step3.school = actorDatas.identity.school;
        this.data.step3.roles = actorDatas.identity.roles;
        this.data.step3.allowed_techniques.kata = actorDatas.techniques.kata;
        this.data.step3.allowed_techniques.kiho = actorDatas.techniques.kiho;
        this.data.step3.allowed_techniques.invocation = actorDatas.techniques.invocation;
        this.data.step3.allowed_techniques.ritual = actorDatas.techniques.ritual;
        this.data.step3.allowed_techniques.shuji = actorDatas.techniques.shuji;
        this.data.step3.allowed_techniques.maho = actorDatas.techniques.maho;
        this.data.step3.allowed_techniques.ninjutsu = actorDatas.techniques.ninjutsu;
        this.data.step5.social_giri = actorDatas.social.giri;
        this.data.step6.social_ninjo = actorDatas.social.ninjo;
        this.data.step19.firstname = actor.data.name.replace(/^(?:\w+\s+)?(.+)$/gi, "$1") || "";
    }

    /**
     * Fill a actor data from this object
     */
    async toActor(actor, itemsCache) {
        const actorDatas = actor.data.data;
        const formData = this.data;

        // Update the actor
        actorDatas.zeni = Math.floor(formData.step2.wealth * 50);
        actorDatas.identity = {
            ...actorDatas.identity,
            clan: formData.step1.clan,
            family: formData.step2.family,
            school: formData.step3.school,
            roles: formData.step3.roles,
        };

        actorDatas.social = {
            ...actorDatas.social,
            status: formData.step1.social_status,
            glory: formData.step2.social_glory,
            honor: formData.step3.social_honor,
            giri: formData.step5.social_giri,
            ninjo: formData.step6.social_ninjo,
        };

        actorDatas.techniques = {
            ...actorDatas.techniques,
            kata: !!formData.step3.allowed_techniques.kata,
            kiho: !!formData.step3.allowed_techniques.kiho,
            invocation: !!formData.step3.allowed_techniques.invocation,
            ritual: !!formData.step3.allowed_techniques.ritual,
            shuji: !!formData.step3.allowed_techniques.shuji,
            maho: !!formData.step3.allowed_techniques.maho,
            ninjutsu: !!formData.step3.allowed_techniques.ninjutsu,
        };

        // Rings - Reset to 1, and apply modifiers
        CONFIG.l5r5e.stances.forEach((ring) => (actorDatas.rings[ring] = 1));
        TwentyQuestions.ringList.forEach((formName) => {
            const ring = getProperty(this.data, formName);
            if (ring !== "none") {
                actorDatas.rings[ring] = actorDatas.rings[ring] + 1;
            }
        });

        // Skills - Reset to 0, and apply modifiers
        Array.from(CONFIG.l5r5e.skills).forEach(([skillId, skillCat]) => {
            actorDatas.skills[skillCat][skillId] = 0;
        });
        TwentyQuestions.skillList.forEach((formName) => {
            const skillId = getProperty(this.data, formName);
            const skillCat = CONFIG.l5r5e.skills.get(skillId);
            if (skillId !== "none") {
                actorDatas.skills[skillCat][skillId] = actorDatas.skills[skillCat][skillId] + 1;
            }
        });

        // Clear and add items to actor
        const deleteIds = actor.data.items.map((e) => e._id);
        await actor.deleteEmbeddedEntity("OwnedItem", deleteIds);

        // Add items in 20Q to actor
        for (const types of Object.values(itemsCache)) {
            for (const item of types) {
                const itemData = duplicate(item.data);
                if (itemData.data?.bought_at_rank) {
                    itemData.data.bought_at_rank = 0;
                }
                if (itemData.data?.xp_spent) {
                    itemData.data.xp_spent = 0;
                }
                await actor.createEmbeddedEntity("OwnedItem", itemData);
            }
        }

        // Update actor
        await actor.update({
            name: (formData.step2.family + " " + formData.step19.firstname).trim(),
            data: actorDatas,
        });
    }

    /**
     * Return a array of errors, empty array if no errors founds
     */
    validateForm() {
        const errors = [];

        // Rings & Skills, 3pt max for each
        const rings = this._checkRingsOrSkills("ringList", 2); // ring start at 1
        for (const key in rings) {
            errors.push(`${game.i18n.localize("l5r5e.rings." + key)} (${rings[key]})`);
        }

        const skills = this._checkRingsOrSkills("skillList", 3); // skill start at 0
        for (const key in skills) {
            errors.push(
                `${game.i18n.localize("l5r5e.skills." + CONFIG.l5r5e.skills.get(key) + "." + key)} (${skills[key]})`
            );
        }

        return errors;
    }

    /**
     * Return a list of exceeded ring/skill
     */
    _checkRingsOrSkills(listName, max) {
        const store = {};
        const exceed = {};
        TwentyQuestions[listName].forEach((formName) => {
            const id = getProperty(this.data, formName);
            if (!id || id === "none") {
                return;
            }
            if (!store[id]) {
                store[id] = 0;
            }
            store[id] = store[id] + 1;
            if (store[id] > max) {
                exceed[id] = store[id];
            }
        });
        return exceed;
    }
}
