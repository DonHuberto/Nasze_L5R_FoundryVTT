import { ItemSheetL5r5e } from "./item-sheet.js";

/**
 * @extends {ItemSheet}
 */
export class AdvancementSheetL5r5e extends ItemSheetL5r5e {
    /**
     * Sub Types of advancements
     */
    static types = ["ring", "skill"]; // "peculiarity" and "technique" have theirs own xp count

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "sheet", "advancement"],
            template: CONFIG.l5r5e.paths.templates + "items/advancement/advancement-sheet.html",
            width: 520,
            height: 480,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
        });
    }

    async getData() {
        const sheetData = await super.getData();

        sheetData.data.subTypesList = AdvancementSheetL5r5e.types;
        sheetData.data.skillsList = game.l5r5e.HelpersL5r5e.getSkillsList(true);

        return sheetData;
    }

    /**
     * Subscribe to events from the sheet.
     * @param html HTML content of the sheet.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) {
            return;
        }

        // const currentType = this.object.data.data.advancement_type;
        const currentRing = this.object.data.data.ring;
        const currentSkill = this.object.data.data.skill;

        html.find("#advancement_type").on("change", (event) => {
            if ($(event.target).val() === "skill") {
                this._updateChoice(
                    {
                        ring: currentRing,
                    },
                    {
                        skill: currentSkill,
                    }
                );
            } else {
                this._updateChoice(
                    {
                        skill: currentSkill,
                    },
                    {
                        ring: currentRing,
                    }
                );
            }
        });

        html.find("#advancement_ring").on("change", (event) => {
            this._updateChoice(
                {
                    ring: currentRing,
                },
                {
                    ring: $(event.target).val(),
                }
            );
        });

        html.find("#advancement_skill").on("change", (event) => {
            this._updateChoice(
                {
                    skill: currentSkill,
                },
                {
                    skill: $(event.target).val(),
                }
            );
        });
    }

    /**
     * Update Actor and Object to the current choice
     * @private
     */
    _updateChoice(oldChoice, newChoice) {
        let skillCatId = null;
        const actor = duplicate(this.actor.data.data);
        let xp_used = this.object.data.data.xp_used;

        // Old choices
        if (oldChoice.ring) {
            actor.rings[oldChoice.ring] = Math.max(1, actor.rings[oldChoice.ring] - 1);
        }
        if (oldChoice.skill) {
            skillCatId = CONFIG.l5r5e.skills.get(oldChoice.skill);
            actor.skills[skillCatId][oldChoice.skill] = Math.max(0, actor.skills[skillCatId][oldChoice.skill] - 1);
        }

        // new choices
        if (newChoice.ring) {
            actor.rings[newChoice.ring] = actor.rings[newChoice.ring] + 1;
            xp_used = actor.rings[newChoice.ring] * CONFIG.l5r5e.xp.ringCostMultiplier;
        }
        if (newChoice.skill) {
            skillCatId = CONFIG.l5r5e.skills.get(newChoice.skill);
            actor.skills[skillCatId][newChoice.skill] = actor.skills[skillCatId][newChoice.skill] + 1;
            xp_used = actor.skills[skillCatId][newChoice.skill] * CONFIG.l5r5e.xp.skillCostMultiplier;
        }

        // Update Actor
        this.actor.update({
            data: diffObject(this.actor.data.data, actor),
        });

        // Update object
        this.object.update({
            data: {
                xp_used: xp_used,
            },
        });

        // Re render
        this.render(false);
    }
}
