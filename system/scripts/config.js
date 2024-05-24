export const L5R5E = {
    namespace: "l5r5e",
    paths: {
        assets: "systems/l5r5e/assets/",
        templates: "systems/l5r5e/templates/",
    },
    money: [50, 10],
    stances: ["earth", "air", "water", "fire", "void"],
    roles: ["artisan", "bushi", "courtier", "monk", "sage", "shinobi", "shugenja"],
    xp: {
        costPerRank: [0, 20, 24, 32, 44, 60],
        bondCostPerRank: [0, 3, 4, 6, 8, 10],
        ringCostMultiplier: 3,
        skillCostMultiplier: 2,
        techniqueCost: 3,
    },
    regex: {
        techniqueDifficulty: /^@([TS]):([^|]+?)(?:\|(min|max)(?:\(([^)]+?)\))?)?$/,
    },
    initiativeSkills: {
        intrigue: "sentiment",
        duel: "meditation",
        skirmish: "tactics",
        mass_battle: "command",
    },
    noHonorSkillsList: ["commerce", "skulduggery", "medicine", "seafaring", "survival", "labor"],
};

// *** Techniques ***
L5R5E.techniques = new Map();
// Core
L5R5E.techniques.set("kata", { type: "core", displayInTypes: true });
L5R5E.techniques.set("kiho", { type: "core", displayInTypes: true });
L5R5E.techniques.set("inversion", { type: "core", displayInTypes: true });
L5R5E.techniques.set("invocation", { type: "core", displayInTypes: true });
L5R5E.techniques.set("ritual", { type: "core", displayInTypes: true });
L5R5E.techniques.set("shuji", { type: "core", displayInTypes: true });
L5R5E.techniques.set("maho", { type: "core", displayInTypes: true });
L5R5E.techniques.set("ninjutsu", { type: "core", displayInTypes: true });
L5R5E.techniques.set("mantra", { type: "core", displayInTypes: true });
// School
L5R5E.techniques.set("school_ability", { type: "school", displayInTypes: false });
L5R5E.techniques.set("mastery_ability", { type: "school", displayInTypes: false });
// Title
L5R5E.techniques.set("title_ability", { type: "title", displayInTypes: false });
// Custom
L5R5E.techniques.set("specificity", { type: "custom", displayInTypes: false });

// *** SkillId - CategoryId ***
L5R5E.skills = new Map();
L5R5E.skills.set("aesthetics", "artisan");
L5R5E.skills.set("composition", "artisan");
L5R5E.skills.set("design", "artisan");
L5R5E.skills.set("smithing", "artisan");

L5R5E.skills.set("fitness", "martial");
L5R5E.skills.set("melee", "martial");
L5R5E.skills.set("ranged", "martial");
L5R5E.skills.set("unarmed", "martial");
L5R5E.skills.set("meditation", "martial");
L5R5E.skills.set("tactics", "martial");

L5R5E.skills.set("culture", "scholar");
L5R5E.skills.set("government", "scholar");
L5R5E.skills.set("medicine", "scholar");
L5R5E.skills.set("sentiment", "scholar");
L5R5E.skills.set("theology", "scholar");

L5R5E.skills.set("command", "social");
L5R5E.skills.set("courtesy", "social");
L5R5E.skills.set("games", "social");
L5R5E.skills.set("performance", "social");

L5R5E.skills.set("commerce", "trade");
L5R5E.skills.set("labor", "trade");
L5R5E.skills.set("seafaring", "trade");
L5R5E.skills.set("skulduggery", "trade");
L5R5E.skills.set("survival", "trade");

// *** Symbols ***
L5R5E.symbols = new Map();
L5R5E.symbols.set("(op)", { class: "i_opportunity", label: "l5r5e.dice.chat.opportunities" });
L5R5E.symbols.set("(su)", { class: "i_success", label: "l5r5e.dice.chat.successes" });
L5R5E.symbols.set("(ex)", { class: "i_explosive", label: "l5r5e.dice.chat.explosives" });
L5R5E.symbols.set("(st)", { class: "i_strife", label: "l5r5e.dice.chat.strife" });
L5R5E.symbols.set("(ring)", { class: "i_ring", label: "l5r5e.rings.title" });
L5R5E.symbols.set("(skill)", { class: "i_skill", label: "l5r5e.skills.title" });

L5R5E.symbols.set("(earth)", { class: "i_earth", label: "l5r5e.rings.earth" });
L5R5E.symbols.set("(water)", { class: "i_water", label: "l5r5e.rings.water" });
L5R5E.symbols.set("(fire)", { class: "i_fire", label: "l5r5e.rings.fire" });
L5R5E.symbols.set("(air)", { class: "i_air", label: "l5r5e.rings.air" });
L5R5E.symbols.set("(void)", { class: "i_void", label: "l5r5e.rings.void" });

L5R5E.symbols.set("(kiho)", { class: "i_kiho", label: "l5r5e.techniques.kiho" });
L5R5E.symbols.set("(maho)", { class: "i_maho", label: "l5r5e.techniques.maho" });
L5R5E.symbols.set("(ninjutsu)", { class: "i_ninjitsu", label: "l5r5e.techniques.ninjutsu" });
L5R5E.symbols.set("(ninjitsu)", { class: "i_ninjitsu", label: "l5r5e.techniques.ninjutsu" }); // for compatibility
L5R5E.symbols.set("(ritual)", { class: "i_rituals", label: "l5r5e.techniques.ritual" });
L5R5E.symbols.set("(shuji)", { class: "i_shuji", label: "l5r5e.techniques.shuji" });
L5R5E.symbols.set("(inversion)", { class: "i_inversion", label: "l5r5e.techniques.inversion" });
L5R5E.symbols.set("(invocation)", { class: "i_invocations", label: "l5r5e.techniques.invocation" });
L5R5E.symbols.set("(kata)", { class: "i_kata", label: "l5r5e.techniques.kata" });
L5R5E.symbols.set("(mantra)", { class: "i_mantra", label: "l5r5e.techniques.mantra" });
L5R5E.symbols.set("(prereq)", { class: "i_prerequisite_exemption", label: "l5r5e.advancements.curriculum" });

L5R5E.symbols.set("(imperial)", { class: "i_imperial", label: "l5r5e.clans.imperial" });
L5R5E.symbols.set("(ronin)", { class: "i_ronin", label: "l5r5e.clans.ronin" });
L5R5E.symbols.set("(crab)", { class: "i_crab", label: "l5r5e.clans.crab" });
L5R5E.symbols.set("(crane)", { class: "i_crane", label: "l5r5e.clans.crane" });
L5R5E.symbols.set("(dragon)", { class: "i_dragon", label: "l5r5e.clans.dragon" });
L5R5E.symbols.set("(lion)", { class: "i_lion", label: "l5r5e.clans.lion" });
L5R5E.symbols.set("(mantis)", { class: "i_mantis", label: "l5r5e.clans.mantis" });
L5R5E.symbols.set("(phoenix)", { class: "i_phoenix", label: "l5r5e.clans.phoenix" });
L5R5E.symbols.set("(scorpion)", { class: "i_scorpion", label: "l5r5e.clans.scorpion" });
L5R5E.symbols.set("(tortoise)", { class: "i_tortoise", label: "l5r5e.clans.tortoise" });
L5R5E.symbols.set("(unicorn)", { class: "i_unicorn", label: "l5r5e.clans.unicorn" });

L5R5E.symbols.set("(bushi)", { class: "i_bushi", label: "l5r5e.roles.bushi" });
L5R5E.symbols.set("(courtier)", { class: "i_courtier", label: "l5r5e.roles.courtier" });
L5R5E.symbols.set("(shugenja)", { class: "i_shugenja", label: "l5r5e.roles.shugenja" });

// *** Clans and Families ***
L5R5E.families = new Map();
// Majors
L5R5E.families.set("imperial", ["Miya", "Otomo", "Seppun"]);
L5R5E.families.set("crab", ["Hida", "Hiruma", "Kaiu", "Kuni", "Yasuki"]);
L5R5E.families.set("crane", ["Asahina", "Daidoji", "Doji", "Kakita"]);
L5R5E.families.set("dragon", ["Agasha", "Kitsuki", "Mirumoto", "Togashi"]);
L5R5E.families.set("lion", ["Akodo", "Ikoma", "Kitsu", "Matsu"]);
L5R5E.families.set("phoenix", ["Asako", "Isawa", "Shiba", "Kaito"]);
L5R5E.families.set("scorpion", ["Bayushi", "Shosuro", "Soshi", "Yogo"]);
L5R5E.families.set("unicorn", ["Ide", "Iuchi", "Moto", "Shinjo", "Utaku"]);
// Minors
L5R5E.families.set("mantis", ["(boat name)"]); // no family name, boat name
L5R5E.families.set("ronin", ["(ronin)"]); // can be anything
L5R5E.families.set("badger", ["Ichiro"]);
L5R5E.families.set("bat", ["Komori"]);
L5R5E.families.set("boar", ["Heichi"]);
L5R5E.families.set("dragonfly", ["Tonbo"]);
L5R5E.families.set("firefly", ["Hotaru"]);
L5R5E.families.set("hare", ["Ujina", "Usagi"]);
L5R5E.families.set("monkey", ["Toku", "Fuzake"]);
L5R5E.families.set("oriole", ["Tsi"]);
L5R5E.families.set("ox", ["Morito"]);
L5R5E.families.set("sparrow", ["Suzume"]);
L5R5E.families.set("tortoise", ["Kasuga"]);
// External
L5R5E.families.set("ivory_kingdoms", []);
L5R5E.families.set("qamarist", []);
L5R5E.families.set("ujik", []);

// *** demeanor ***
L5R5E.demeanors = [
    { id: "adaptable", mod: { fire: 2, earth: -2 } },
    { id: "adaptable", mod: { water: 2, earth: -2 } },
    { id: "aggressive", mod: { fire: 2, air: -2 } },
    { id: "aggressive", mod: { fire: 2, water: -2 } },
    { id: "ambitious", mod: { fire: 2, water: -2 } },
    { id: "amiable", mod: { air: 2, earth: -2 } },
    { id: "analytical", mod: { fire: 2, air: -2 } },
    { id: "angry", mod: { fire: 2, air: -2 } },
    { id: "arrogant", mod: { fire: 2, water: -2 } },
    { id: "assertive", mod: { earth: 2, air: -2 } },
    { id: "assertive", mod: { earth: 2, air: 2 } },
    { id: "beguiling", mod: { air: 2, earth: -2 } },
    { id: "beguiling", mod: { fire: 2, earth: -2 } },
    { id: "bitter", mod: { fire: 2, air: -2 } },
    { id: "bold", mod: { fire: 1, earth: -1 } },
    { id: "calculating", mod: { air: 2, fire: -2 } },
    { id: "calm", mod: { fire: 2, air: -2 } },
    { id: "capricious", mod: { air: 2, earth: -2 } },
    { id: "cautious", mod: { air: 2, earth: -2 } },
    { id: "clever", mod: { air: 2, earth: -2 } },
    { id: "confused", mod: { fire: 1, void: 1, air: -2 } },
    { id: "courageous", mod: { air: 2, earth: -2 } },
    { id: "cowardly", mod: { earth: 2, fire: -2 } },
    { id: "curious", mod: { earth: 1, void: -2 } },
    { id: "curious", mod: { fire: 1, void: 1, air: -2 } },
    { id: "dependable", mod: { fire: 1, water: 1, earth: -2 } },
    { id: "detached", mod: { earth: 1, fire: 1, void: -2 } },
    { id: "disheartened", mod: { fire: 1, earth: -1 } },
    { id: "enraged", mod: { air: 1, fire: -2 } },
    { id: "feral", mod: { air: 2, fire: -2 } },
    { id: "fickle", mod: { fire: 2, air: -2 } },
    { id: "fierce", mod: { fire: 2, earth: -2 } },
    { id: "flighty", mod: { air: 2, fire: -2 } },
    { id: "flighty", mod: { water: 2, fire: -2 } },
    { id: "flippant", mod: { fire: 2, air: -2 } },
    { id: "friendly", mod: { fire: 1, earth: -2, water: -2 } },
    { id: "gruff", mod: { water: 2, earth: -2 } },
    { id: "hungry", mod: { fire: 2, air: -2 } },
    { id: "intense", mod: { air: 2, water: -2 } },
    { id: "intense", mod: { fire: 2, water: -2 } },
    { id: "intimidating", mod: { fire: 2, air: -2 } },
    { id: "irritable", mod: { fire: 2, air: -1, water: -1 } },
    { id: "loyal", mod: { air: 1, earth: -2, fire: -2 } },
    { id: "loyal", mod: { water: 2, fire: -2 } },
    { id: "mischievous", mod: { fire: 2, air: -2 } },
    { id: "mischievous", mod: { air: 2, earth: -2 } },
    { id: "mischievous", mod: { earth: 2, fire: -2 } },
    { id: "morose", mod: { water: 2, fire: -2 } },
    { id: "nurturing", mod: { earth: 2, fire: -2 } },
    { id: "obstinate", mod: { earth: 2, air: -2 } },
    { id: "obstinate", mod: { water: 2, air: -2 } },
    { id: "opportunistic", mod: { water: 2, fire: -2 } },
    { id: "passionate", mod: { earth: 2, air: -2 } },
    { id: "playful", mod: { earth: 2, water: -2 } },
    { id: "playful", mod: { fire: 1, air: 1, void: -2 } },
    { id: "power_hungry", mod: { fire: 2, earth: -2 } },
    { id: "proud", mod: { fire: 2, earth: -2 } },
    { id: "restrained", mod: { earth: 2, air: -2 } },
    { id: "scheming", mod: { air: 2, void: -2 } },
    { id: "serene", mod: { fire: 2, void: -2 } },
    { id: "serene", mod: { void: 2, fire: -2 } },
    { id: "serious", mod: { fire: 2, earth: -2 } },
    { id: "shrewd", mod: { air: 2, fire: -2 } },
    { id: "stubborn", mod: { earth: 2, water: -2 } },
    { id: "suspicious", mod: { air: 2, earth: -2 } },
    { id: "teasing", mod: { air: 2, earth: -2 } },
    { id: "territorial", mod: { fire: 2, air: -2 } },
    { id: "uncertain", mod: { air: 2, fire: -2 } },
    { id: "unenthused", mod: { earth: 2, fire: -2 } },
    { id: "vain", mod: { earth: 2, air: -2 } },
    { id: "wary", mod: { earth: 2, fire: -2 } },
];
