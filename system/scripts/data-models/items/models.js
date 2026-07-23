import { createSystemDataModel, mergeDefaults } from "../schema.js";

const basics = {
    rulesKey: "",
    source_reference: { source: "", page: 0 },
    description: "",
    parent_id: null,
    items: [],
};
const advancement = {
    in_curriculum: false, xp_used: 3, xp_cost: 3, rank: 1, bought_at_rank: 1, ring: "void",
};
const physicalItem = {
    equipped: false, quantity: 1, weight: 0, rarity: "0", zeni: "0", properties: [],
};

export const ITEM_DEFAULTS = {
    item: mergeDefaults(basics, physicalItem),
    armor: mergeDefaults(basics, physicalItem, { armor: { physical: 0, supernatural: 0 } }),
    weapon: mergeDefaults(basics, physicalItem, {
        category: "", skill: "melee", readied: false, range: "0", damage: 0, deadliness: 0,
        damage_type: "physical", active_grip: "one-handed",
        grip_profiles: {
            "one-handed": { label: "", damage_modifier: 0, deadliness_modifier: 0, skill_id: "melee", hands: 1, range_min: 0, range_max: 0 },
            "two-handed": { label: "", damage_modifier: 0, deadliness_modifier: 0, skill_id: "melee", hands: 2, range_min: 0, range_max: 0 },
        },
        grip_1: "", grip_2: "",
    }),
    technique: mergeDefaults(basics, advancement, {
        skill: "", difficulty: "", technique_type: "kata",
        activation: {
            requires_check: true, action_types: [], action_id: "",
            target: { mode: "none", filters: {} },
            range: { minimum: 0, maximum: 0 },
            movement: { mode: "none", bands: 0, multiplier: 1 },
            weapon: { required: false, quantity: 1, readied: false, grip: "", skill_mode: "" },
            outcome: {}, opportunity_rules_keys: [],
        },
    }),
    opportunity: mergeDefaults(basics, {
        sourceReference: { source: "Core Rulebook", page: 328 },
        ring: "any",
        contexts: {
            conflictTypes: [], checkKinds: [], actionTypes: [], actionIds: [], skillGroups: [],
            skillIds: [], techniqueTypes: [], itemTypes: [], initiative: null,
        },
        cost: { base: 1, increment: 1, scalable: false, maxSpend: null },
        requirements: {}, timing: "manual", target: { mode: "none", filters: {} },
        effect: { type: "manual", params: {} }, duration: null, automation: "manual",
    }),
    property: mergeDefaults(basics, { properties: [] }),
    peculiarity: mergeDefaults(basics, advancement, { peculiarity_type: "distinction", types: "", automationTags: [] }),
    advancement: mergeDefaults(basics, advancement, { advancement_type: "skill", skill: "" }),
    title: mergeDefaults(basics, advancement, { advancements: [], xp_used_total: 0 }),
    bond: mergeDefaults(basics, advancement, { bond_type: "" }),
    signature_scroll: mergeDefaults(basics, advancement),
    item_pattern: mergeDefaults(basics, advancement, { linked_property_id: null, rarity_modifier: "" }),
    army_cohort: mergeDefaults(basics, {
        leader: "", leader_actor_id: null, equipment: "", abilities: "",
        battle_readiness: {
            casualties_strength: { max: 0, value: 0 },
            panic_discipline: { max: 0, value: 0 },
        },
    }),
    army_fortification: mergeDefaults(basics, { difficulty: 0, attrition_reduction: 0, notes: "" }),
};

export const ITEM_DATA_MODELS = Object.freeze(Object.fromEntries(
    Object.entries(ITEM_DEFAULTS).map(([type, defaults]) => [
        type,
        createSystemDataModel(defaults, [
            "description",
            ...(type === "army_cohort" ? ["abilities"] : []),
            ...(type === "army_fortification" ? ["notes"] : []),
        ]),
    ]),
));
