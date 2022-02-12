/**
 * L5R Character generator base object
 */
export class CharacterGenerator {
    //<editor-fold desc="Config Datas">
    static demeanorList = [
        { id: "adaptable", mod: { fire: 2, earth: -2 } },
        { id: "adaptable", mod: { water: 2, earth: -2 } },
        { id: "aggressive", mod: { fire: 2, air: -2 } },
        { id: "aggressive", mod: { fire: 2, water: -2 } },
        { id: "ambitious", mod: { fire: 2, water: -2 } },
        { id: "amiable", mod: { air: 2, earth: -2 } },
        { id: "analytical", mod: { fire: 2, air: -2 } },
        { id: "angry", mod: { fire: 2, air: -2 } },
        { id: "arrogant", mod: { fire: 2, water: -2 } },
        { id: "assertive", mod: { earth: 2, air: -2 } },
        { id: "assertive", mod: { earth: 2, air: 2 } },
        { id: "beguiling", mod: { air: 2, earth: -2 } },
        { id: "beguiling", mod: { fire: 2, earth: -2 } },
        { id: "bitter", mod: { fire: 2, air: -2 } },
        { id: "bold", mod: { fire: 1, earth: -1 } },
        { id: "calculating", mod: { air: 2, fire: -2 } },
        { id: "calm", mod: { fire: 2, air: -2 } },
        { id: "capricious", mod: { air: 2, earth: -2 } },
        { id: "cautious", mod: { air: 2, earth: -2 } },
        { id: "clever", mod: { air: 2, earth: -2 } },
        { id: "confused", mod: { fire: 1, void: 1, air: -2 } },
        { id: "courageous", mod: { air: 2, earth: -2 } },
        { id: "cowardly", mod: { earth: 2, fire: -2 } },
        { id: "curious", mod: { earth: 1, void: -2 } },
        { id: "curious", mod: { fire: 1, void: 1, air: -2 } },
        { id: "dependable", mod: { fire: 1, water: 1, earth: -2 } },
        { id: "detached", mod: { earth: 1, fire: 1, void: -2 } },
        { id: "disheartened", mod: { fire: 1, earth: -1 } },
        { id: "enraged", mod: { air: 1, fire: -2 } },
        { id: "feral", mod: { air: 2, fire: -2 } },
        { id: "fickle", mod: { fire: 2, air: -2 } },
        { id: "fierce", mod: { fire: 2, earth: -2 } },
        { id: "flighty", mod: { air: 2, fire: -2 } },
        { id: "flighty", mod: { water: 2, fire: -2 } },
        { id: "flippant", mod: { fire: 2, air: -2 } },
        { id: "friendly", mod: { fire: 1, earth: -2, water: -2 } },
        { id: "gruff", mod: { water: 2, earth: -2 } },
        { id: "hungry", mod: { fire: 2, air: -2 } },
        { id: "intense", mod: { air: 2, water: -2 } },
        { id: "intense", mod: { fire: 2, water: -2 } },
        { id: "intimidating", mod: { fire: 2, air: -2 } },
        { id: "irritable", mod: { fire: 2, air: -1, water: -1 } },
        { id: "loyal", mod: { air: 1, earth: -2, fire: -2 } },
        { id: "loyal", mod: { water: 2, fire: -2 } },
        { id: "mischievous", mod: { fire: 2, air: -2 } },
        { id: "mischievous", mod: { air: 2, earth: -2 } },
        { id: "mischievous", mod: { earth: 2, fire: -2 } },
        { id: "morose", mod: { water: 2, fire: -2 } },
        { id: "nurturing", mod: { earth: 2, fire: -2 } },
        { id: "obstinate", mod: { earth: 2, air: -2 } },
        { id: "obstinate", mod: { water: 2, air: -2 } },
        { id: "opportunistic", mod: { water: 2, fire: -2 } },
        { id: "passionate", mod: { earth: 2, air: -2 } },
        { id: "playful", mod: { earth: 2, water: -2 } },
        { id: "playful", mod: { fire: 1, air: 1, void: -2 } },
        { id: "power_hungry", mod: { fire: 2, earth: -2 } },
        { id: "proud", mod: { fire: 2, earth: -2 } },
        { id: "restrained", mod: { earth: 2, air: -2 } },
        { id: "scheming", mod: { air: 2, void: -2 } },
        { id: "serene", mod: { fire: 2, void: -2 } },
        { id: "serene", mod: { void: 2, fire: -2 } },
        { id: "serious", mod: { fire: 2, earth: -2 } },
        { id: "shrewd", mod: { air: 2, fire: -2 } },
        { id: "stubborn", mod: { earth: 2, water: -2 } },
        { id: "suspicious", mod: { air: 2, earth: -2 } },
        { id: "teasing", mod: { air: 2, earth: -2 } },
        { id: "territorial", mod: { fire: 2, air: -2 } },
        { id: "uncertain", mod: { air: 2, fire: -2 } },
        { id: "unenthused", mod: { earth: 2, fire: -2 } },
        { id: "vain", mod: { earth: 2, air: -2 } },
        { id: "wary", mod: { earth: 2, fire: -2 } },
    ];
    //</editor-fold>

    /**
     * Payload Object
     */
    data = {
        avgRingsValue: 3, // 1-5
        clan: "random",
        family: "",
        gender: "male",
        age: 15,
        maritalStatus: "",
    };

    /**
     * Initialize the generator
     * @param {number} avgRingsValue number between 1 and 5
     * @param {string} clanName      random|crab|crane...
     * @param {string} gender        random|male|female
     */
    constructor({ avgRingsValue = 3, clanName = "random", gender = "random" }) {
        if (!CONFIG.l5r5e.families.has(clanName)) {
            clanName = "random";
        }
        if (clanName === "random") {
            clanName = CharacterGenerator._getRandomArrayValue(Array.from(CONFIG.l5r5e.families.keys()));
        }
        if (gender === "random" || !["male", "female"].includes(gender)) {
            gender = Math.random() > 0.5 ? "male" : "female";
        }

        this.data.avgRingsValue = CharacterGenerator.sanitizeMinMax(avgRingsValue);
        this.data.clan = clanName;
        this.data.family = CharacterGenerator._getRandomFamily(clanName);
        this.data.gender = gender;
    }

    /**
     * Return true if the gender is Female
     * @return {boolean}
     */
    get isFemale() {
        return this.data.gender === "female";
    }

    /**
     * Return a random value for this array
     * @param  {String[]} array
     * @return {String}
     * @private
     */
    static _getRandomArrayValue(array) {
        return array[Math.floor(Math.random() * array.length)] ?? "";
    }

    /**
     * Return a random value between min and max
     * @param  {number} min
     * @param  {number} max
     * @return {number}
     * @private
     */
    static _randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    /**
     * Always return a number between 1 and 5
     * @param  {number} number
     * @return {number}
     */
    static sanitizeMinMax(number) {
        return Math.min(5, Math.max(1, number));
    }

    /**
     * Return a Item from this pack (by id if provided, or random otherwise)
     * @param  {string} packName
     * @param  {string} id
     * @return {Promise<Document|undefined>}
     * @private
     */
    static async _getItemFromPack(packName, id = null) {
        const comp = await game.packs.get(packName);
        if (!comp) {
            console.log(`L5R5E | Pack not found[${packName}]`);
            return;
        }
        if (id) {
            return comp.getDocument(id);
        }
        if (!comp.indexed) {
            await comp.getDocuments();
        }
        return comp.getDocument(CharacterGenerator._getRandomArrayValue(Array.from(comp.keys())));
    }

    /**
     * Generate and return a family name for this clan
     * @param  {string} clanName
     * @return {string}
     * @private
     */
    static _getRandomFamily(clanName) {
        let originClan = clanName;

        // Ronin specific, can be any other family name
        if (clanName === "ronin") {
            originClan = CharacterGenerator._getRandomArrayValue(
                Array.from(CONFIG.l5r5e.families.keys()).filter((e) => e !== "ronin")
            );
        }

        return CharacterGenerator._getRandomArrayValue(CONFIG.l5r5e.families.get(originClan));
    }

    /**
     * Generate and return a firstname
     * @return {Promise<string>}
     */
    static async getRandomizedFirstname(isFemale, clan) {
        let table = `Japanese names (${isFemale ? "Female" : "Male"})`;
        switch (clan) {
            case "ivory_kingdoms":
                table = "Ivory Kingdoms names";
                break;
            case "qamarist":
                table = "Qamarist names";
                break;
            case "ujik":
                table = "Ujik names";
                break;
        }
        const randomNames = await game.l5r5e.HelpersL5r5e.drawManyFromPack("l5r5e.core-name-tables", table, 1, {
            displayChat: false,
        });
        return randomNames?.results[0]?.data.text || "";
    }

    /**
     * Generate the actor age
     * @param  {number} avgRingsValue
     * @return {number}
     */
    static genAge(avgRingsValue) {
        return CharacterGenerator._randomInt(15, avgRingsValue * 10 + 15);
    }

    /**
     * Return the marriage state
     * @param  {number} age
     * @return {string} unmarried|betrothed|married|widowed
     */
    static genMaritalStatus(age) {
        const rng = Math.random();
        if (age < 20) {
            return rng < 0.1 ? "married" : rng < 0.4 ? "betrothed" : "unmarried";
        }
        if (age < 30) {
            return rng < 0.4 ? "married" : rng < 0.7 ? "betrothed" : "unmarried";
        }
        return rng < 0.8 ? "married" : rng < 0.9 ? "widowed" : "unmarried";
    }

    /**
     * Generate the marital partner
     * @param  {string}  maritalStatus unmarried|betrothed|married|widowed
     * @param  {number}  avgRingsValue
     * @param  {string}  clan
     * @param  {string}  family
     * @param  {boolean} isFemale
     * @return {Promise<{age: number, name: string, clan: string, family: string, female: boolean}>}
     */
    static async genMaritalPartner(maritalStatus, avgRingsValue, clan, family, isFemale) {
        const alreadyMerged = maritalStatus !== "betrothed";
        const partner = {
            age: CharacterGenerator.genAge(avgRingsValue),
            clan: "",
            family: "",
            female: Math.random() > 0.9 ? isFemale : !isFemale,
            name: "",
        };

        partner.clan =
            alreadyMerged || Math.random() > 0.7
                ? clan
                : CharacterGenerator._getRandomArrayValue(Array.from(CONFIG.l5r5e.families.keys()));

        partner.family = alreadyMerged ? family : CharacterGenerator._getRandomFamily(partner.clan);
        partner.name = await CharacterGenerator.getRandomizedFirstname(partner.female, partner.clan);
        return partner;
    }

    /**
     * Generate Honor, Glory and Status values
     * @param  {number} age
     * @param  {string} clan
     * @return {{honor: number, glory: number, status: number}}
     */
    static genSocialStanding(age, clan) {
        const karma = Math.random() < 0.66 ? 1 : -1;
        const rng = (initial, variation) => {
            return initial + CharacterGenerator._randomInt(5, variation) * karma;
        };

        let honor = rng(34, age / 2);
        switch (clan) {
            case "lion":
                honor += 10;
                break;
            case "scorpion":
                honor -= 10;
                break;
        }
        return {
            honor,
            glory: rng(40, age / 3),
            status: rng(30, age / 4),
        };
    }

    /**
     * Modify the current actor datas with selected options
     *
     * @param  {ActorL5r5e} actor                 Actor object
     * @param  {Object}     generate
     * @param  {boolean}    generate.name          If true generate a new name
     * @param  {boolean}    generate.identity      If true generate Clan, Gender, Age, Marital status
     * @param  {boolean}    generate.attributes    If true generate Rings, attributes, skills and confrontation ranks
     * @param  {boolean}    generate.demeanor      If true generate Demeanor and rings affinities
     * @param  {boolean}    generate.peculiarities If true generate Advantage and Disadvantage
     * @param  {boolean}    generate.items         If true generate Armor, Weapons and Items
     * @param  {boolean}    generate.techniques    If true generate Shuji, Katas...
     * @param  {boolean}    generate.narrative     If true generate Narrative and fluff
     * @return {Promise<Object>}
     */
    async toActor(
        actor,
        generate = {
            name: true,
            attributes: true,
            identity: true,
            demeanor: true,
            peculiarities: true,
            items: true,
            techniques: true,
            narrative: true,
        }
    ) {
        const actorDatas = actor.data.data;
        const isNpc = actor.type === "npc";

        // Need to set some required values
        this.data.age = actorDatas.identity.age || CharacterGenerator.genAge(this.data.avgRingsValue);
        this.data.maritalStatus =
            actorDatas.identity.marital_status || CharacterGenerator.genMaritalStatus(this.data.age);

        actorDatas.identity.clan = this.data.clan;
        actorDatas.identity.family = this.data.family;
        actorDatas.identity.female = this.isFemale;

        // Name
        let newName = actor.data.name;
        if (generate.name) {
            newName =
                this.data.family +
                " " +
                (await CharacterGenerator.getRandomizedFirstname(this.isFemale, this.data.clan));
        }

        // Identity
        if (generate.identity) {
            actorDatas.identity.age = CharacterGenerator.genAge(this.data.avgRingsValue);
            actorDatas.identity.marital_status = CharacterGenerator.genMaritalStatus(this.data.age);
            await this._generateNotes(actorDatas);
        }

        // Img (only if system defaults)
        const folder = "systems/l5r5e/assets/icons/actors";
        const newImg = [
            `${folder}/npc.svg`,
            `${folder}/traditional-japanese-man.svg`,
            `${folder}/traditional-japanese-woman.svg`,
        ].includes(actor.data.img)
            ? `${folder}/traditional-japanese-${this.isFemale ? "woman" : "man"}.svg`
            : actor.data.img;

        // Generate attributes & Social Standing
        if (generate.attributes) {
            // Generate attributes (rings, attributes, skills, confrontation ranks)
            this._generateAttributes(isNpc, actorDatas);

            // Social Standing
            const social = CharacterGenerator.genSocialStanding(this.data.age, this.data.clan);
            actorDatas.social.honor = social.honor;
            actorDatas.social.glory = social.glory;
            actorDatas.social.status = social.status;
        }

        // Demeanor (npc only)
        if (isNpc && generate.demeanor) {
            this._generateDemeanor(actorDatas);
        }

        // Item types
        if (generate.peculiarities || generate.items || generate.techniques) {
            const newItemsData = [];

            // Advantage / Disadvantage
            if (generate.peculiarities) {
                await this._generatePeculiarities(actor, newItemsData);
            }

            // Items
            if (generate.items) {
                await this._generateItems(actor, newItemsData);
            }

            // Techniques
            if (generate.techniques) {
                await this._generateTechniques(actor, newItemsData);
            }

            // Add to actor
            if (newItemsData.length > 0) {
                await actor.createEmbeddedDocuments("Item", newItemsData);
            }
        }

        // Narrative
        if (generate.narrative) {
            this._generateNarrative(actorDatas);
        }

        // return actor data
        return {
            img: newImg,
            name: newName,
            data: actorDatas,
        };
    }

    //<editor-fold desc="toActor generators">
    /**
     * Generate attributes (rings, attributes, skills, confrontation ranks)
     * @param {boolean}           isNpc
     * @param {DocumentData.data} actorDatas
     * @private
     */
    _generateAttributes(isNpc, actorDatas) {
        const stats = { min: 5, max: 1 };

        // Rings
        CONFIG.l5r5e.stances.forEach((ringName) => {
            // avgRingsValue + (-1|0|1)
            actorDatas.rings[ringName] = CharacterGenerator.sanitizeMinMax(
                this.data.avgRingsValue - 1 + Math.floor(Math.random() * 3)
            );
            stats.min = Math.min(stats.min, actorDatas.rings[ringName]);
            stats.max = Math.max(stats.max, actorDatas.rings[ringName]);
        });

        // Attributes
        game.l5r5e.ActorL5r5e.computeDerivedAttributes(actorDatas);

        // Skills
        if (isNpc) {
            Object.keys(actorDatas.skills).forEach(
                (skillName) => (actorDatas.skills[skillName] = Math.floor(Math.random() * stats.max))
            );
        } else {
            // TODO PC skills
        }

        // Confrontation ranks (npc only)
        if (isNpc) {
            actorDatas.conflict_rank.martial = this.data.avgRingsValue + actorDatas.skills.martial;
            actorDatas.conflict_rank.social = this.data.avgRingsValue + actorDatas.skills.social;
        }
    }

    /**
     * Generate Demeanor (npc only)
     * @param {DocumentData.data} actorDatas
     * @private
     */
    _generateDemeanor(actorDatas) {
        // demeanor { id: "adaptable", mod: { fire: 2, earth: -2 } },
        const demeanor = CharacterGenerator._getRandomArrayValue(CharacterGenerator.demeanorList);
        actorDatas.attitude = game.i18n.localize("l5r5e.demeanor." + demeanor.id);
        actorDatas.rings_affinities = foundry.utils.mergeObject(
            {
                earth: 0,
                air: 0,
                water: 0,
                fire: 0,
                void: 0,
            },
            demeanor.mod
        );
    }

    /**
     * Generate Advantages and Disadvantages
     * @param  {ActorL5r5e} actor
     * @param  {DocumentData[]} newItemsData
     * @return {Promise<void>}
     * @private
     */
    async _generatePeculiarities(actor, newItemsData) {
        // Clear actor peculiarities
        const deleteIds = actor.data.items.filter((e) => e.type === "peculiarity").map((e) => e.id);
        if (deleteIds.length > 0) {
            await actor.deleteEmbeddedDocuments("Item", deleteIds);
        }

        // Add 1 each peculiarity
        for (const pack of ["adversities", "distinctions", "passions", "anxieties"]) {
            const item = await CharacterGenerator._getItemFromPack(`l5r5e.core-peculiarities-${pack}`);
            if (item) {
                newItemsData.push(foundry.utils.duplicate(item.data));
            }
        }
    }

    /**
     * Generate Armor, Weapons, Items
     * @param  {ActorL5r5e} actor
     * @param  {DocumentData[]} newItemsData
     * @return {Promise<void>}
     * @private
     */
    async _generateItems(actor, newItemsData) {
        // Clear actor items
        const deleteIds = actor.data.items.filter((e) => ["armor", "weapon", "item"].includes(e.type)).map((e) => e.id);
        if (deleteIds.length > 0) {
            await actor.deleteEmbeddedDocuments("Item", deleteIds);
        }

        // Items
        const itemCfg = {
            armors: [
                "L5RCoreArm000009", // Common Clothes
            ],
            weapons: [
                "L5RCoreWea000036", // Punch
                "L5RCoreWea000037", // Kick
                "L5RCoreWea000009", // Wakizashi
                "L5RCoreWea000007", // Katana
                "L5RCoreWea000019", // Knife
            ],
            items: [
                null, // Random item
            ],
        };
        if (this.data.clan === "crab") {
            itemCfg.armors.push("L5RCoreArm000001"); // Ashigaru Armor
            itemCfg.weapons.push("L5RCoreWea000017"); // Tetsubō
        }

        for (const pack in itemCfg) {
            for (const itemId of itemCfg[pack]) {
                const item = await CharacterGenerator._getItemFromPack(`l5r5e.core-${pack}`, itemId);
                if (item) {
                    newItemsData.push(foundry.utils.duplicate(item.data));
                }
            }
        }
    }

    /**
     * Generate Techniques
     * @param  {ActorL5r5e} actor
     * @param  {DocumentData[]} newItemsData
     * @return {Promise<void>}
     * @private
     */
    async _generateTechniques(actor, newItemsData) {
        // Clear actor items
        const deleteIds = actor.data.items.filter((e) => e.type === "technique").map((e) => e.id);
        if (deleteIds.length > 0) {
            await actor.deleteEmbeddedDocuments("Item", deleteIds);
        }

        const avgrv = this.data.avgRingsValue;

        /**
         * Techs config
         *
         * exemple: {
         *   probability: .7,
         *     skill: {
         *     grp_name: "scholar",
         *     value_min: 1,
         *   },
         *   qty: {
         *     min: 1,
         *     max: avgrv,
         *   },
         * },
         */
        const techCfg = {
            kata: {
                probability: 1,
                skill: {
                    grp_name: "martial",
                    value_min: 1,
                },
                qty: {
                    min: 1,
                    max: avgrv,
                },
            },
            kiho: {
                probability: 0.1,
                skill: {
                    grp_name: "martial",
                    value_min: 1,
                },
            },
            ninjutsu: {
                probability: 0.1,
                skill: {
                    grp_name: "martial",
                    value_min: 1,
                },
            },
            shuji: {
                probability: 1,
                qty: {
                    min: 1,
                },
            },
            rituals: {
                probability: 0.2,
            },
            maho: {
                probability: 0.1,
            },
            invocations: {
                probability: 0.3,
                skill: {
                    grp_name: "scholar",
                    value_min: 1,
                },
                qty: {
                    min: 2,
                    max: Math.max(2, avgrv),
                },
            },
        };

        for (const pack in techCfg) {
            const cfg = techCfg[pack];

            // Minimum skill required (npc only for now)
            if (!!cfg.skill && actor.data.data.skills[cfg.skill.grp_name] < cfg.skill.value_min) {
                continue;
            }

            // Check probabilities to have more than min qty
            let qtyMax = cfg.qty?.min ?? 0;
            if (Math.random() < cfg.probability) {
                qtyMax = CharacterGenerator._randomInt(cfg.qty?.min ?? 0, cfg.qty?.max ?? avgrv);
            }

            for (let qty = 0; qty < qtyMax; qty++) {
                // Rank is limited by avgRingsValue
                let item;
                do {
                    item = await CharacterGenerator._getItemFromPack(`l5r5e.core-techniques-${pack}`);
                } while (item && item.data.data.rank > avgrv);

                if (item) {
                    newItemsData.push(foundry.utils.duplicate(item.data));
                }
            } // fr qty
        } // fr techCfg
    }

    /**
     * Fill notes with some values that don't appear in sheet
     * @param  {DocumentData.data} actorDatas
     * @return {Promise<void>}
     * @private
     */
    async _generateNotes(actorDatas) {
        actorDatas.notes =
            `${game.i18n.localize("l5r5e.social.age")}: ${this.data.age}</p>` +
            `<p>${game.i18n.localize("l5r5e.social.gender.title")}: ${game.i18n.localize(
                "l5r5e.social.gender." + this.data.gender
            )}</p>` +
            `<p>${game.i18n.localize("l5r5e.clan")}: ${game.i18n.localize("l5r5e.clans." + this.data.clan)}</p>` +
            `<p>${game.i18n.localize("l5r5e.social.marital_status.title")}: ${game.i18n.localize(
                "l5r5e.social.marital_status." + this.data.maritalStatus
            )}</p>`;

        // Define partner identity
        if (this.data.maritalStatus !== "unmarried") {
            const partner = await CharacterGenerator.genMaritalPartner(
                this.data.maritalStatus,
                this.data.avgRingsValue,
                this.data.clan,
                this.data.family,
                this.isFemale
            );

            actorDatas.notes +=
                "<p>" +
                `${game.i18n.localize("l5r5e.social.marital_status.partner")}:` +
                ` ${partner.family} ${partner.name}` +
                ` (${partner.age}, ${game.i18n.localize(
                    "l5r5e.social.gender." + (partner.female ? "female" : "male")
                )})` +
                "</p>";
        }
    }

    /**
     * Generate Narrative fluff
     * @param {DocumentData.data} actorDatas
     * @private
     */
    _generateNarrative(actorDatas) {
        // TODO generateNarrative
        // actorDatas.description = '';
    }
    //</editor-fold>
}
