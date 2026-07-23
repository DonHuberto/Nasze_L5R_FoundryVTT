const emptyContexts = () => ({ conflictTypes: [], checkKinds: [], actionTypes: [], actionIds: [], skillGroups: [], skillIds: [], techniqueTypes: [], itemTypes: [], initiative: null });

function opportunity({ rulesKey, name, description, ring = "any", contexts = {}, cost = {}, requirements = {}, timing = "manual", target = {}, effect = {}, duration = null, automation = "manual", page = 328 }) {
    return {
        rulesKey,
        name,
        description,
        sourceReference: { source: "Core Rulebook", page },
        ring,
        contexts: { ...emptyContexts(), ...contexts },
        cost: { base: 1, increment: 1, scalable: false, maxSpend: null, ...cost },
        requirements,
        timing,
        target: { mode: "none", filters: {}, ...target },
        effect: { type: "manual", params: {}, ...effect },
        duration,
        automation,
    };
}

export const CORE_OPPORTUNITIES = Object.freeze([
    opportunity({ rulesKey: "general-failure-guidance", name: "Easiest path", description: "After a failed check, learn the easiest approach and skill for the attempted task.", requirements: { success: false } }),
    opportunity({ rulesKey: "general-remove-check-strife", name: "Release check strife", description: "Remove one Strife gained from this check per Opportunity spent.", cost: { scalable: true }, timing: "strife", effect: { type: "remove-check-strife" }, automation: "automatic" }),
    opportunity({ rulesKey: "general-assist-next-similar", name: "Prepare assistance", description: "Assist the next character who attempts a sufficiently similar check.", cost: { base: 2 }, timing: "deferred" }),

    opportunity({ rulesKey: "air-read-demeanor", name: "Read demeanor", description: "Learn a character's demeanor and current Strife.", ring: "air", target: { mode: "single" }, automation: "confirm" }),
    opportunity({ rulesKey: "air-subtle-action", name: "Act subtly", description: "Reduce the attention drawn by the task; additional spend makes it subtler.", ring: "air", cost: { scalable: true } }),
    opportunity({ rulesKey: "air-notice-character-detail", name: "Notice a detail", description: "Notice an interesting detail about a character.", ring: "air", cost: { base: 2 }, target: { mode: "single" } }),
    opportunity({ rulesKey: "earth-reassure", name: "Reassure", description: "Another character removes 2 Strife.", ring: "earth", target: { mode: "single" }, timing: "strife", effect: { type: "remove-strife", params: { amount: 2 } }, automation: "confirm" }),
    opportunity({ rulesKey: "earth-minimize-risk", name: "Minimize risk", description: "Reduce incidental consequences or dangers from the task.", ring: "earth", cost: { scalable: true } }),
    opportunity({ rulesKey: "earth-recall-preparation", name: "Recall preparation", description: "Recall relevant information or a small earlier preparation.", ring: "earth", cost: { base: 2 } }),
    opportunity({ rulesKey: "fire-inflame", name: "Inflame", description: "Another character receives 2 Strife.", ring: "fire", target: { mode: "single" }, timing: "strife", effect: { type: "resource", params: { resource: "strife", amount: 2 } }, automation: "confirm" }),
    opportunity({ rulesKey: "fire-flashy-action", name: "Act flashily", description: "Draw attention; additional spend attracts more notice.", ring: "fire", cost: { scalable: true } }),
    opportunity({ rulesKey: "fire-notice-absence", name: "Notice an absence", description: "Notice something missing or out of place nearby.", ring: "fire", cost: { base: 2 } }),
    opportunity({ rulesKey: "water-remove-strife", name: "Recover composure", description: "Remove 2 Strife, including Strife held before the check.", ring: "water", timing: "strife", effect: { type: "remove-strife", params: { amount: 2 } }, automation: "automatic" }),
    opportunity({ rulesKey: "water-efficient-action", name: "Act efficiently", description: "Reduce the time or supplies needed; additional spend improves the saving.", ring: "water", cost: { scalable: true } }),
    opportunity({ rulesKey: "water-environment-detail", name: "Notice the environment", description: "Notice a useful physical detail, terrain feature, or mundane object nearby.", ring: "water", cost: { base: 2 } }),
    opportunity({ rulesKey: "void-next-ring-tn", name: "Future ring insight", description: "Choose a non-Void Ring; reduce the TN of the next check using it by 1.", ring: "void", requirements: { ringChoice: true }, timing: "deferred", effect: { type: "tn-modifier", params: { amount: -1, selector: "chosenRing" } }, automation: "confirm" }),
    opportunity({ rulesKey: "void-sense-supernatural", name: "Sense disturbance", description: "Sense signs of a spiritual disturbance; additional spend improves precision.", ring: "void", cost: { scalable: true } }),
    opportunity({ rulesKey: "void-spiritual-insight", name: "Spiritual insight", description: "Gain an insight concerning the universe or your character's heart.", ring: "void", cost: { base: 2 } }),

    opportunity({ rulesKey: "conflict-air-reserve-ring-die", name: "Reserve Air die", description: "Add a kept Ring die showing Opportunity to the next Martial check.", ring: "air", contexts: { conflictTypes: ["conflict", "skirmish", "mass-battle"], skillGroups: ["martial"] }, timing: "deferred", effect: { type: "reserve-die" }, automation: "confirm" }),
    opportunity({ rulesKey: "conflict-air-vertical-movement", name: "Vertical movement", description: "During a Movement action, one range band per spend may follow a vertical surface.", ring: "air", contexts: { conflictTypes: ["conflict", "skirmish"], actionTypes: ["move"] }, cost: { scalable: true }, effect: { type: "ignore-terrain", params: { quality: "vertical" } }, automation: "confirm" }),
    opportunity({ rulesKey: "conflict-air-ranged-defense", name: "Ranged defense", description: "Increase the TN of the next ranged Martial check targeting you before your next turn by 2.", ring: "air", contexts: { conflictTypes: ["conflict", "skirmish"] }, cost: { base: 2 }, timing: "deferred", effect: { type: "tn-modifier", params: { amount: 2, selector: "nextRangedAgainstSelf" } }, duration: { until: "startNextTurn" }, automation: "automatic" }),
    opportunity({ rulesKey: "conflict-earth-ignore-terrain", name: "Ignore terrain", description: "Ignore one terrain quality during this Movement action.", ring: "earth", contexts: { conflictTypes: ["conflict", "skirmish"], actionTypes: ["move"] }, target: { mode: "none", filters: { terrainQuality: true } }, effect: { type: "ignore-terrain" }, automation: "confirm" }),
    opportunity({ rulesKey: "conflict-earth-reduce-critical", name: "Brace against critical", description: "Reduce the next critical strike severity suffered before your next turn by 1 per spend.", ring: "earth", contexts: { conflictTypes: ["conflict", "skirmish"] }, cost: { scalable: true }, timing: "deferred", effect: { type: "critical-modifier", params: { amount: -1 } }, duration: { until: "startNextTurn" }, automation: "automatic" }),
    opportunity({ rulesKey: "conflict-fire-target-resist-critical", name: "Expose target", description: "During an Attack check, increase the TN of the target's next critical mitigation check before your next turn.", ring: "fire", contexts: { conflictTypes: ["conflict", "skirmish"], actionTypes: ["attack"] }, cost: { scalable: true }, target: { mode: "rollTarget" }, timing: "deferred", effect: { type: "tn-modifier", params: { amount: 1, selector: "nextCriticalMitigation" } }, duration: { until: "startNextTurn" }, automation: "automatic" }),
    opportunity({ rulesKey: "conflict-water-remove-fatigue", name: "Second wind", description: "Remove 1 Fatigue.", ring: "water", contexts: { conflictTypes: ["conflict", "skirmish"] }, timing: "afterSuccess", effect: { type: "resource", params: { resource: "fatigue", amount: -1 } }, automation: "automatic" }),
    opportunity({ rulesKey: "conflict-water-ignore-resistance", name: "Bypass resistance", description: "During an Attack check, ignore 1 physical resistance per spend.", ring: "water", contexts: { conflictTypes: ["conflict", "skirmish"], actionTypes: ["attack"] }, cost: { scalable: true }, target: { mode: "rollTarget" }, timing: "beforeDamage", effect: { type: "resistance-modifier", params: { amount: -1, damageType: "physical" } }, automation: "automatic" }),
    opportunity({ rulesKey: "conflict-water-move-band", name: "Flowing movement", description: "Move 1 range band.", ring: "water", contexts: { conflictTypes: ["conflict", "skirmish"] }, cost: { base: 2 }, timing: "afterSuccess", effect: { type: "movement", params: { amount: 1 } }, automation: "confirm" }),
    opportunity({ rulesKey: "conflict-void-ignore-terrain-next-attack", name: "Unhindered attack", description: "Ignore one terrain quality during your next Attack check before the end of your next turn.", ring: "void", contexts: { conflictTypes: ["conflict", "skirmish"] }, timing: "deferred", effect: { type: "ignore-terrain" }, duration: { until: "endNextTurn" }, automation: "confirm" }),
    opportunity({ rulesKey: "conflict-void-support-initiative", name: "Centered support", description: "During a Support check, increase Initiative by 1 per spend.", ring: "void", contexts: { conflictTypes: ["conflict", "skirmish"], actionTypes: ["support"] }, cost: { scalable: true }, timing: "afterSuccess", effect: { type: "resource", params: { resource: "initiative", amount: 1 } }, automation: "automatic" }),
    opportunity({ rulesKey: "conflict-void-ignore-condition", name: "Transcend condition", description: "Ignore one suffered condition until the end of your next turn.", ring: "void", contexts: { conflictTypes: ["conflict", "skirmish"] }, cost: { base: 2 }, requirements: { conditionChoice: true }, timing: "preValidation", effect: { type: "ignore-condition" }, duration: { until: "endNextTurn" }, automation: "confirm" }),

    opportunity({
        rulesKey: "soaring-slice-range",
        name: "Soaring Slice range",
        description: "Increase Soaring Slice's maximum range by one band per Opportunity spent.",
        contexts: { actionTypes: ["attack"], actionIds: ["soaring-slice"] },
        cost: { scalable: true },
        timing: "afterSuccess",
        effect: { type: "range", params: { amount: 1 } },
        automation: "automatic",
        page: 177,
    }),

    opportunity({
        rulesKey: "strike-critical",
        name: "Strike critical",
        description: "After a successful Strike, inflict a critical strike using the deadliness snapshot of the attack profile.",
        contexts: { conflictTypes: ["conflict", "skirmish", "duel"], actionTypes: ["attack"], actionIds: ["strike"] },
        cost: { base: 2 },
        requirements: { success: true },
        timing: "afterSuccess",
        target: { mode: "rollTarget" },
        effect: { type: "critical", params: { severityMode: "activeAttackProfileDeadliness" } },
        automation: "confirm",
        page: 264,
    }),

    ...["air", "earth", "water", "void"].map((ring) => opportunity({ rulesKey: `initiative-${ring}-insight`, name: `Initiative ${ring} insight`, description: "Resolve the Ring-specific informational initiative effect with the GM.", ring, contexts: { initiative: true }, page: 329 })),
    opportunity({ rulesKey: "initiative-fire-focus-when-unprepared", name: "Sudden readiness", description: "Use Focus instead of Vigilance for Initiative when unprepared.", ring: "fire", contexts: { initiative: true }, timing: "beforeSuccess", effect: { type: "resource", params: { resource: "initiativeBase", amount: 0, mode: "focus" } }, automation: "automatic", page: 329 }),

    ...["air", "earth", "fire", "water", "void"].flatMap((ring) => ["artisan", "scholar", "social", "trade"].map((skillGroup) => opportunity({
        rulesKey: `skill-${ring}-${skillGroup}`,
        name: `${ring} ${skillGroup} opportunity`,
        description: "Apply the Core Rulebook skill-group Opportunity for this Ring; narrative or document-creation choices require GM confirmation.",
        ring,
        contexts: { skillGroups: [skillGroup] },
        automation: "manual",
        page: 329,
    }))),

    ...["air", "earth", "fire", "water", "void"].flatMap((ring) => [1, 2].map((index) => opportunity({
        rulesKey: `downtime-${ring}-${index}`,
        name: `${ring} downtime opportunity ${index}`,
        description: "Apply the corresponding Ring-specific downtime effect from the Core Rulebook.",
        ring,
        contexts: { conflictTypes: ["downtime"] },
        cost: index === 1 ? { scalable: true } : { base: 2 },
        automation: "manual",
        page: 329,
    }))),
]);
