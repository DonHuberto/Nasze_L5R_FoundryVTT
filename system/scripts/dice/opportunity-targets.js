function actorFromTarget(target) {
    const document = target?.document ?? target;
    return document?.actor ?? document;
}

function targetChoice(actor, label = null) {
    if (!actor?.uuid) return null;
    return { value: actor.uuid, label: label ?? actor.name ?? actor.uuid };
}

/**
 * Build legal user-selectable Opportunity targets.
 *
 * During combat this list is authoritative: only visible, undefeated combatants
 * may be chosen. Outside combat, preserve the normal roll target/token-target
 * fallback used by non-conflict checks.
 */
export function buildOpportunityTargetChoices({ combat = null, fallbackTargets = [] } = {}) {
    const choices = [];
    if (combat) {
        for (const combatant of combat.combatants ?? []) {
            if (combatant?.hidden || combatant?.token?.hidden || combatant?.isDefeated || combatant?.defeated) continue;
            const choice = targetChoice(combatant.actor, combatant.name ?? combatant.actor?.name);
            if (choice) choices.push(choice);
        }
    } else {
        for (const target of fallbackTargets) {
            const actor = actorFromTarget(target);
            const choice = targetChoice(actor, actor?.name ?? target?.name);
            if (choice) choices.push(choice);
        }
    }
    return [...new Map(choices.map((choice) => [choice.value, choice])).values()];
}
