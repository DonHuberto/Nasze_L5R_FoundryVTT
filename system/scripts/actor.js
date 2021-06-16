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
                        actorLink: false,
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
        }
        await super.create(data, options);
    }

    /**
     * Entity-specific actions that should occur when the Entity is updated
     * @override
     */
    async update(data = {}, context = {}) {
        // Need a _id
        if (!data._id) {
            data["_id"] = this.id;
        }

        // Context informations (needed for unlinked token update)
        context.parent = this.parent;
        context.pack = this.pack;

        // Only on linked Actor
        if (data.token?.actorLink || (data.token?.actorLink === undefined && this.data.token.actorLink)) {
            // Update the token name/image if the sheet name/image changed, but only if they was previously the same
            ["name", "img"].forEach((fieldName) => {
                if (
                    data[fieldName] &&
                    this.data[fieldName] === this.data.token[fieldName] &&
                    this.data[fieldName] !== data[fieldName]
                ) {
                    data["token." + fieldName] = data[fieldName];
                }
            });
        }

        // Now using updateDocuments
        data = data instanceof Array ? data : [data];
        return Actor.updateDocuments(data, context);
    }

    /** @override */
    prepareData() {
        super.prepareData();

        if (["character", "npc"].includes(this.data.type)) {
            const data = this.data.data;

            // No automation for npc as they cheat in stats
            if (this.data.type === "character") {
                data.endurance = (Number(data.rings.earth) + Number(data.rings.fire)) * 2;
                data.composure = (Number(data.rings.earth) + Number(data.rings.water)) * 2;
                data.focus = Number(data.rings.air) + Number(data.rings.fire);
                data.vigilance = Math.ceil((Number(data.rings.air) + Number(data.rings.water)) / 2);
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
}
