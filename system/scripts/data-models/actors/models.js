import { createSystemDataModel, mergeDefaults } from "../schema.js";

const softlock = { soft_locked: false };
const identity = {
    identity: {
        age: "", clan: "", family: "", female: null, marital_status: "", roles: "", school: "",
        school_rank: 1, school_curriculum_journal: {},
    },
};
const rings = { rings: { earth: 1, air: 1, water: 1, fire: 1, void: 1 } };
const social = {
    notes: "",
    description: "",
    social: {
        honor: 0, glory: 0, status: 0, ninjo: "", giri: "",
        bushido_tenets: { paramount: "", less_significant: "" },
    },
};
const characterSkills = {
    skills: {
        artisan: { aesthetics: 0, composition: 0, design: 0, smithing: 0 },
        martial: { fitness: 0, melee: 0, ranged: 0, unarmed: 0, meditation: 0, tactics: 0 },
        scholar: { culture: 0, government: 0, medicine: 0, sentiment: 0, theology: 0 },
        social: { command: 0, courtesy: 0, games: 0, performance: 0 },
        trade: { commerce: 0, labor: 0, seafaring: 0, skulduggery: 0, survival: 0 },
    },
};
const techniques = {
    techniques: {
        kata: false, kiho: false, inversion: false, invocation: false, ritual: false,
        shuji: false, maho: false, ninjutsu: false, mantra: false, specificity: true,
    },
};
const conflict = {
    endurance: 0, composure: 0, focus: 0, vigilance: 0,
    void_points: { max: 1, value: 0 },
    fatigue: { max: 1, value: 0 },
    strife: { max: 1, value: 0 },
    stance: "void",
    prepared: true,
};
const advancement = { xp_total: 0, xp_spent: 0, xp_saved: 0 };

export const ACTOR_DEFAULTS = {
    character: mergeDefaults(
        softlock, identity, rings, social, characterSkills, techniques, conflict, advancement,
        { template: "core", twenty_questions: {}, zeni: 0 },
    ),
    npc: mergeDefaults(
        softlock, identity, rings, social, techniques, conflict,
        {
            type: "adversary",
            attitude: "",
            conflict_rank: { martial: 0, social: 0 },
            rings_affinities: { earth: 0, air: 0, water: 0, fire: 0, void: 0 },
            skills: { artisan: 0, martial: 0, scholar: 0, social: 0, trade: 0 },
        },
    ),
    army: mergeDefaults(softlock, {
        warlord: "", warlord_actor_id: null, allies_backers: "", purpose_mustering: "",
        battle_readiness: {
            casualties_strength: { max: 0, value: 0 },
            panic_discipline: { max: 0, value: 0 },
        },
        commander: "", commander_actor_id: null, commander_abilities: "", army_abilities: "",
        commander_standing: { honor: 0, glory: 0, status: 0 },
        supplies_logistics: "", notes: "", description: "", past_battles: "",
    }),
};

export const CharacterData = createSystemDataModel(ACTOR_DEFAULTS.character, ["description", "notes"]);
export const NpcData = createSystemDataModel(ACTOR_DEFAULTS.npc, ["description", "notes"]);
export const ArmyData = createSystemDataModel(ACTOR_DEFAULTS.army, [
    "army_abilities", "supplies_logistics", "notes", "description", "past_battles",
]);

export const ACTOR_DATA_MODELS = Object.freeze({
    character: CharacterData,
    npc: NpcData,
    army: ArmyData,
});
