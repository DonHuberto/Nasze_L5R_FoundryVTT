/**
 * Extends the actor to process special things from L5R.
 */
export class CombatL5r5e extends Combat {
    // game.combat.settings.resource = "fatigue.value"; // nope :/
    // constructor(...args) {
    //     super(...args);
    //     console.log(args);
    // }

    /**
     * Roll initiative for one or multiple Combatants within the Combat entity
     * @param {string|string[]} ids     A Combatant id or Array of ids for which to roll
     * @param {string|null} [formula]   A non-default initiative formula to roll. Otherwise the system default is used.
     * @param {boolean} [updateTurn]    Update the Combat turn after adding new initiative scores to keep the turn on
     *                                  the same Combatant.
     * @param {object} [messageOptions] Additional options with which to customize created Chat Messages
     * @return {Promise<Combat>}        A promise which resolves to the updated Combat entity once updates are complete.
     */
    async rollInitiative(ids, { formula = null, updateTurn = true, messageOptions = {} } = {}) {
        if (!Array.isArray(ids)) {
            ids = [ids];
        }

        // Make combatants array
        const combatants = [];
        ids.forEach((combatantId) => {
            const combatant = game.combat.combatants.find((c) => c._id === combatantId);
            if (combatant && combatant.actor) {
                combatants.push(combatant);
            }
        });

        // Get modifiers
        const difficulty = game.settings.get("l5r5e", "initiative.difficulty.value");
        const difficultyHidden = game.settings.get("l5r5e", "initiative.difficulty.hidden");
        const skillId = CONFIG.l5r5e.initiativeSkills[game.settings.get("l5r5e", "initiative.encounter")];
        const skillCat = CONFIG.l5r5e.skills.get(skillId);

        // Get score for each combatant
        const updatedCombatants = [];
        combatants.forEach((combatant) => {
            const data = combatant.actor.data.data;

            // A character’s initiative value is based on their state of preparedness when the conflict began.
            // If the character was ready for the conflict, their base initiative value is their focus attribute.
            // If the character was unprepared (such as when surprised), their base initiative value is their vigilance attribute.
            const isPrepared = true; // TODO in actor ? (pc and npc)
            let initiative = isPrepared ? data.focus : data.vigilance;

            // PC and Adversary
            // (minion NPCs can generate initiative value without a check, using their focus or vigilance attribute)
            if (combatant.actor.data.type !== "npc" || combatant.actor.data.data.type === "minion") {
                const formula = [`${data.rings[data.stance]}dr`];
                const skillValue =
                    combatant.actor.data.type === "npc" ? data.skills[skillCat] : data.skills[skillCat][skillId];
                if (skillValue > 0) {
                    formula.push(`${skillValue}ds`);
                }

                const roll = new game.l5r5e.RollL5r5e(formula.join("+"));

                roll.actor = combatant.actor;
                roll.l5r5e.stance = data.stance;
                roll.l5r5e.skillId = skillId;
                roll.l5r5e.summary.difficulty = difficulty;
                roll.l5r5e.summary.difficultyHidden = difficultyHidden;

                roll.roll();
                roll.toMessage({ flavor: game.i18n.localize("l5r5e.chatdices.initiative_roll") });

                // if the character succeeded on their Initiative check, they add 1 to their base initiative value,
                // plus an additional amount equal to their bonus successes.
                if (roll.l5r5e.summary.success >= difficulty) {
                    initiative = initiative + 1 + Math.max(roll.l5r5e.summary.success - difficulty, 0);
                }
            }

            updatedCombatants.push({
                _id: combatant._id,
                initiative: initiative,
            });
        });

        // Update all combatants at once
        await this.updateEmbeddedEntity("Combatant", updatedCombatants);
        return this;
    }

    /**
     * Define how the array of Combatants is sorted in the displayed list of the tracker.
     * This method can be overridden by a system or module which needs to display combatants in an alternative order.
     * By default sort by initiative, falling back to name
     * @private
     */
    _sortCombatants(a, b) {
        // if tie, sort by honor, less honorable first
        if (a.initiative === b.initiative) {
            return a.actor.data.data.social.honor - b.actor.data.data.social.honor;
        }
        return b.initiative - a.initiative;
    }
}
