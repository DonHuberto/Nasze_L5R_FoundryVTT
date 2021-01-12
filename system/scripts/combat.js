/**
 * Roll initiative for one or multiple Combatants within the Combat entity
 * @param {string|string[]} ids     A Combatant id or Array of ids for which to roll
 * @param {string|null} [formula]   A non-default initiative formula to roll. Otherwise the system default is used.
 * @param {boolean} [updateTurn]    Update the Combat turn after adding new initiative scores to keep the turn on
 *                                  the same Combatant.
 * @param {object} [messageOptions] Additional options with which to customize created Chat Messages
 * @return {Promise<Combat>}        A promise which resolves to the updated Combat entity once updates are complete.
 */
export async function rollInitiative(ids, { formula = null, updateTurn = true, messageOptions = {} } = {}) {
    if (!Array.isArray(ids)) {
        ids = [ids];
    }
    const updatedCombatants = [];
    ids.forEach((combatantId) => {
        const combatant = game.combat.combatants.find((c) => c._id === combatantId);
        if (!combatant || !combatant.actor) {
            return;
        }
        const data = combatant.actor.data.data;
        const formula = [`${data.rings[data.stance]}dr`];
        const skillValue =
            combatant.actor.data.type === "npc" ? data.skills["martial"] : data.skills["martial"]["tactics"];
        if (skillValue > 0) {
            formula.push(`${skillValue}ds`);
        }

        const roll = new game.l5r5e.RollL5r5e(formula.join("+"));

        roll.actor = combatant.actor;
        roll.l5r5e.stance = data.stance;
        roll.l5r5e.skillId = "tactics";
        roll.l5r5e.summary.difficulty = 1;

        roll.roll();
        roll.toMessage({ flavor: game.i18n.localize("l5r5e.chatdices.initiative_roll") });

        updatedCombatants.push({
            _id: combatant._id,
            initiative: roll.l5r5e.summary.success,
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
export function _sortCombatants(a, b) {
    // if tie, sort by honor, less honorable first
    if (a.initiative === b.initiative) {
        return a.actor.data.data.social.honor - b.actor.data.data.social.honor;
    }
    return b.initiative - a.initiative;
}
