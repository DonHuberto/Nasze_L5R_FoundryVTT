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

        // Get global modifiers
        const cfg = {
            difficulty: game.settings.get("l5r5e", "initiative.difficulty.value"),
            difficultyHidden: game.settings.get("l5r5e", "initiative.difficulty.hidden"),
            prepared: {
                character: game.settings.get("l5r5e", "initiative.prepared.character"),
                adversary: game.settings.get("l5r5e", "initiative.prepared.adversary"),
                minion: game.settings.get("l5r5e", "initiative.prepared.minion"),
            },
        };

        // SkillId from DicePicker or global
        const skillId = messageOptions.skillId
            ? messageOptions.skillId
            : CONFIG.l5r5e.initiativeSkills[game.settings.get("l5r5e", "initiative.encounter")];
        const skillCat = CONFIG.l5r5e.skills.get(skillId);

        // Get score for each combatant
        const updatedCombatants = [];
        for (const combatantId of ids) {
            const combatant = game.combat.combatants.find((c) => c._id === combatantId);

            // Skip if combatant already have a initiative value
            if (!messageOptions.rerollInitiative && (!combatant || !combatant.actor)) {
                return;
            }

            // Shortcut to data
            const data = combatant.actor.data.data;

            // Prepared is a boolean or if null we get the info in the actor sheet
            const isPc = combatant.actor.data.type === "character";
            let isPrepared = isPc ? cfg.prepared.character : cfg.prepared[data.type];
            if (isPrepared === "null") {
                isPrepared = data.prepared ? "true" : "false";
            }

            // A character’s initiative value is based on their state of preparedness when the conflict began.
            // If the character was ready for the conflict, their base initiative value is their focus attribute.
            // If the character was unprepared (such as when surprised), their base initiative value is their vigilance attribute.
            // Minion NPCs can generate initiative value without a check, using their focus or vigilance attribute
            let initiative = isPrepared === "true" ? data.focus : data.is_compromised ? 1 : data.vigilance;

            // Roll only for PC and Adversary
            if (isPc || data.type === "adversary") {
                // Roll formula
                if (!formula) {
                    const createFormula = [`${data.rings[data.stance]}dr`];
                    const skillValue = isPc ? data.skills[skillCat][skillId] : data.skills[skillCat];
                    if (skillValue > 0) {
                        createFormula.push(`${skillValue}ds`);
                    }
                    formula = createFormula.join("+");
                }

                let roll;
                let rnkMessage;
                const flavor =
                    game.i18n.localize("l5r5e.chatdices.initiative_roll") +
                    " (" +
                    game.i18n.localize(`l5r5e.conflict.initiative.prepared_${isPrepared}`) +
                    ")";

                if (messageOptions.rnkRoll instanceof game.l5r5e.RollL5r5e && ids.length === 1) {
                    // Specific RnK
                    roll = messageOptions.rnkRoll;
                    rnkMessage = await roll.toMessage({ flavor });
                } else {
                    // Regular
                    roll = new game.l5r5e.RollL5r5e(formula);
                    roll.actor = combatant.actor;
                    roll.l5r5e.isInitiativeRoll = true;
                    roll.l5r5e.stance = data.stance;
                    roll.l5r5e.skillId = skillId;
                    roll.l5r5e.skillCatId = skillCat;
                    roll.l5r5e.difficulty =
                        messageOptions.difficulty !== undefined ? messageOptions.difficulty : cfg.difficulty;
                    roll.l5r5e.difficultyHidden =
                        messageOptions.difficultyHidden !== undefined
                            ? messageOptions.difficultyHidden
                            : cfg.difficultyHidden;
                    roll.l5r5e.voidPointUsed = !!messageOptions.useVoidPoint;
                    roll.l5r5e.skillAssistance = messageOptions.skillAssistance || 0;

                    roll.roll();
                    rnkMessage = await roll.toMessage({ flavor });
                }

                // Ugly but work... i need the new message
                if (ids.length === 1) {
                    messageOptions.rnkMessage = rnkMessage;
                }

                // if the character succeeded on their Initiative check, they add 1 to their base initiative value,
                // plus an additional amount equal to their bonus successes.
                const successes = roll.l5r5e.summary.totalSuccess;
                if (successes >= roll.l5r5e.difficulty) {
                    initiative = initiative + 1 + Math.max(successes - roll.l5r5e.difficulty, 0);
                }
            }

            updatedCombatants.push({
                _id: combatant._id,
                initiative: initiative,
            });
        }

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
            // if tie, Character > Adversary > Minion
            if (a.actor.data.data.social.honor === b.actor.data.data.social.honor) {
                return (
                    CombatL5r5e._getWeightByActorType(a.actor.data) - CombatL5r5e._getWeightByActorType(b.actor.data)
                );
            }
            return a.actor.data.data.social.honor - b.actor.data.data.social.honor;
        }
        return b.initiative - a.initiative;
    }

    /**
     * Basic weight system for sorting Character > Adversary > Minion
     * @private
     */
    static _getWeightByActorType(data) {
        return data.type === "npc" ? (data.data.type === "minion" ? 3 : 2) : 1;
    }
}
