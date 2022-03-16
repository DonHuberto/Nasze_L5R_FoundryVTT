/**
 * Extends the actor to process special things from L5R.
 */
export class ActorL5r5e extends Actor {
    /**
     * Create a new entity using provided input data
     * @override
     */
    static async create(data, options = {}) {
        // if (!Object.keys(data).includes("type")) {
        //     data.type = "character";
        // }

        // Replace default image
        if (data.img === undefined) {
            data.img = `${CONFIG.l5r5e.paths.assets}icons/actors/${data.type}.svg`;
        }

        // Some tweak on actors token
        data.token = data.token || {};
        switch (data.type) {
            case "character":
                foundry.utils.mergeObject(
                    data.token,
                    {
                        // vision: true,
                        // dimSight: 30,
                        // brightSight: 0,
                        actorLink: true,
                        disposition: 1, // friendly
                        bar1: {
                            attribute: "fatigue",
                        },
                        bar2: {
                            attribute: "strife",
                        },
                    },
                    { overwrite: false }
                );
                break;

            case "npc":
                foundry.utils.mergeObject(
                    data.token,
                    {
                        actorLink: true,
                        disposition: 0, // neutral
                        bar1: {
                            attribute: "fatigue",
                        },
                        bar2: {
                            attribute: "strife",
                        },
                    },
                    { overwrite: false }
                );
                break;

            case "army":
                foundry.utils.mergeObject(
                    data.token,
                    {
                        actorLink: true,
                        disposition: 0, // neutral
                        bar1: {
                            attribute: "battle_readiness.casualties_strength",
                        },
                        bar2: {
                            attribute: "battle_readiness.panic_discipline",
                        },
                    },
                    { overwrite: false }
                );
                break;
        }
        await super.create(data, options);
    }

    /**
     * Entity-specific actions that should occur when the Entity is updated
     * @override
     */
    async update(data = {}, context = {}) {
        // fix foundry v0.8.8 (config token=object, update=flat array)
        data = foundry.utils.flattenObject(data);

        // Need a _id
        if (!data["_id"]) {
            data["_id"] = this.id;
        }

        // Context informations (needed for unlinked token update)
        context.parent = this.parent;
        context.pack = this.pack;

        // NPC switch between types : Linked actor for Adversary, unlinked for Minion
        if (!!data["data.type"] && this.data.type === "npc" && data["data.type"] !== this.data.data.type) {
            data["token.actorLink"] = data["data.type"] === "adversary";
        }

        // Only on linked Actor
        if (!!data["token.actorLink"] || (data["token.actorLink"] === undefined && this.data.token.actorLink)) {
            // Update the token name/image if the sheet name/image changed, but only if
            // they was previously the same, and token img was not set in same time
            ["name", "img"].forEach((fieldName) => {
                if (
                    data[fieldName] &&
                    !data["token." + fieldName] &&
                    this.data[fieldName] === this.data.token[fieldName] &&
                    this.data[fieldName] !== data[fieldName]
                ) {
                    data["token." + fieldName] = data[fieldName];
                }
            });
        }

        // Now using updateDocuments
        return Actor.updateDocuments([data], context).then(() => {
            // Notify the "Gm Monitor" if this actor is watched
            if (game.settings.get("l5r5e", "gm-monitor-actors").find((e) => e === this.id)) {
                game.l5r5e.HelpersL5r5e.refreshLocalAndSocket("l5r5e-gm-monitor");
            }
        });
    }

    /** @override */
    prepareData() {
        super.prepareData();

        if (this.isCharacter) {
            const data = this.data.data;

            // No automation for npc as they cheat in stats
            if (this.data.type === "character") {
                ActorL5r5e.computeDerivedAttributes(data);
            }

            // Attributes bars
            data.fatigue.max = data.endurance;
            data.strife.max = data.composure;
            data.void_points.max = data.rings.void;

            // if compromise, vigilance = 1
            data.is_compromised = data.strife.value > data.strife.max;

            // Make sure void points are never greater than max
            if (data.void_points.value > data.void_points.max) {
                data.void_points.value = data.void_points.max;
            }
        }
    }

    /**
     * Set derived attributes (endurance, composure, focus, vigilance) from rings values
     */
    static computeDerivedAttributes(data) {
        data.endurance = (Number(data.rings.earth) + Number(data.rings.fire)) * 2;
        data.composure = (Number(data.rings.earth) + Number(data.rings.water)) * 2;
        data.focus = Number(data.rings.air) + Number(data.rings.fire);
        data.vigilance = Math.ceil((Number(data.rings.air) + Number(data.rings.water)) / 2);
    }

    /**
     * Add a Ring/Skill point to the current actor if the item is a advancement
     * @param {Item} item
     * @return {Promise<void>}
     */
    async addBonus(item) {
        return this._updateActorFromAdvancement(item, true);
    }

    /**
     * Remove a Ring/Skill point to the current actor if the item is a advancement
     * @param {Item} item
     * @return {Promise<void>}
     */
    async removeBonus(item) {
        return this._updateActorFromAdvancement(item, false);
    }

    /**
     * Alter Actor skill/ring from a advancement
     * @param {Item}    item
     * @param {boolean} isAdd True=add, false=remove
     * @return {Promise<void>}
     * @private
     */
    async _updateActorFromAdvancement(item, isAdd) {
        if (item && item.type === "advancement") {
            const actor = foundry.utils.duplicate(this.data.data);
            const itemData = item.data.data;
            if (itemData.advancement_type === "ring") {
                // Ring
                if (isAdd) {
                    actor.rings[itemData.ring] = Math.min(9, actor.rings[itemData.ring] + 1);
                } else {
                    actor.rings[itemData.ring] = Math.max(1, actor.rings[itemData.ring] - 1);
                }
            } else {
                // Skill
                const skillCatId = CONFIG.l5r5e.skills.get(itemData.skill);
                if (skillCatId) {
                    if (isAdd) {
                        actor.skills[skillCatId][itemData.skill] = Math.min(
                            9,
                            actor.skills[skillCatId][itemData.skill] + 1
                        );
                    } else {
                        actor.skills[skillCatId][itemData.skill] = Math.max(
                            0,
                            actor.skills[skillCatId][itemData.skill] - 1
                        );
                    }
                }
            }

            // Update Actor
            await this.update({
                data: foundry.utils.diffObject(this.data.data, actor),
            });
        }
    }

    /**
     * Render the text template for this Actor (tooltips and chat)
     * @return {Promise<string|null>}
     */
    async renderTextTemplate() {
        const data = (await this.sheet?.getData()) || this;
        const tpl = await renderTemplate(`${CONFIG.l5r5e.paths.templates}actors/actor-text.html`, data);
        if (!tpl) {
            return null;
        }
        return tpl;
    }

    /**
     * Return true if this actor is a PC or NPC
     * @return {boolean}
     */
    get isCharacter() {
        return ["character", "npc"].includes(this.data.type);
    }

    /**
     * Return true if a weapon is equipped
     * @return {boolean}
     */
    get haveWeaponEquipped() {
        return this.items.some((e) => e.type === "weapon" && !!e.data.data.equipped);
    }

    /**
     * Return true if a weapon is readied
     * @return {boolean}
     */
    get haveWeaponReadied() {
        return this.items.some((e) => e.type === "weapon" && !!e.data.data.equipped && !!e.data.data.readied);
    }

    /**
     * Return true if a armor is equipped
     * @return {boolean}
     */
    get haveArmorEquipped() {
        return this.items.some((e) => e.type === "armor" && !!e.data.data.equipped);
    }

    /**
     * Return true if this actor is prepared (overridden by global)
     * @return {boolean}
     */
    get isPrepared() {
        if (!this.isCharacter) {
            return false;
        }

        const cfg = {
            character: game.settings.get("l5r5e", "initiative-prepared-character"),
            adversary: game.settings.get("l5r5e", "initiative-prepared-adversary"),
            minion: game.settings.get("l5r5e", "initiative-prepared-minion"),
        };

        // Prepared is a boolean or if null we get the info in the actor
        let isPrepared = this.data.type === "character" ? cfg.character : cfg[this.data.data.type];
        if (isPrepared === "null") {
            isPrepared = this.data.data.prepared ? "true" : "false";
        }

        return isPrepared;
    }

    /**
     * Return the Status Rank of this actor
     * @return {number|null}
     */
    get statusRank() {
        if (!this.isCharacter) {
            return null;
        }
        return Math.floor(this.data.data.social.status / 10);
    }

    /**
     * Return the Intrigue Rank of this actor
     * @return {number|null}
     */
    get intrigueRank() {
        if (!this.isCharacter) {
            return null;
        }
        return this.data.type === "npc" ? this.data.data.conflict_rank.social : this.data.data.identity.school_rank;
    }

    /**
     * Return the Martial Rank of this actor
     * @return {number|null}
     */
    get martialRank() {
        if (!this.isCharacter) {
            return null;
        }
        return this.data.type === "npc" ? this.data.data.conflict_rank.martial : this.data.data.identity.school_rank;
    }
}
