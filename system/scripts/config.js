export const L5R5E = {};

L5R5E.paths = {
    assets: `systems/l5r5e/assets/`,
    templates: `systems/l5r5e/templates/`,
};

L5R5E.stances = ["earth", "air", "water", "fire", "void"];
L5R5E.techniques = ["kata", "kiho", "invocation", "ritual", "shuji", "maho", "ninjutsu"];
L5R5E.xp = {
    costPerRank: [20, 24, 32, 44, 60],
    ringCostMultiplier: 3,
    skillCostMultiplier: 2,
    techniqueCost: 3,
};

// Map SkillId - CategoryId
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

// Symbols Map
L5R5E.symbols = new Map();
L5R5E.symbols.set("(op)", { class: "i_opportunity", label: "l5r5e.chatdices.opportunities" });
L5R5E.symbols.set("(su)", { class: "i_success", label: "l5r5e.chatdices.successes" });
L5R5E.symbols.set("(ex)", { class: "i_explosive", label: "l5r5e.chatdices.explosives" });
L5R5E.symbols.set("(st)", { class: "i_strife", label: "l5r5e.chatdices.strives" });

L5R5E.symbols.set("(earth)", { class: "i_earth", label: "l5r5e.rings.earth" });
L5R5E.symbols.set("(water)", { class: "i_water", label: "l5r5e.rings.water" });
L5R5E.symbols.set("(fire)", { class: "i_fire", label: "l5r5e.rings.fire" });
L5R5E.symbols.set("(air)", { class: "i_air", label: "l5r5e.rings.air" });
L5R5E.symbols.set("(void)", { class: "i_void", label: "l5r5e.rings.void" });

L5R5E.symbols.set("(kiho)", { class: "i_kiho", label: "l5r5e.techniques.kiho" });
L5R5E.symbols.set("(maho)", { class: "i_maho", label: "l5r5e.techniques.maho" });
L5R5E.symbols.set("(ninjitsu)", { class: "i_ninjitsu", label: "l5r5e.techniques.ninjutsu" });
L5R5E.symbols.set("(ritual)", { class: "i_rituals", label: "l5r5e.techniques.ritual" });
L5R5E.symbols.set("(shuji)", { class: "i_shuji", label: "l5r5e.techniques.shuji" });
L5R5E.symbols.set("(invocation)", { class: "i_invocations", label: "l5r5e.techniques.invocation" });
L5R5E.symbols.set("(kata)", { class: "i_kata", label: "l5r5e.techniques.kata" });
L5R5E.symbols.set("(prereq)", { class: "i_prerequisite_exemption", label: "l5r5e.advancements.curriculum" });

L5R5E.symbols.set("(imperial)", { class: "i_imperial", label: "" });
L5R5E.symbols.set("(crab)", { class: "i_crab", label: "" });
L5R5E.symbols.set("(crane)", { class: "i_crane", label: "" });
L5R5E.symbols.set("(dragon)", { class: "i_dragon", label: "" });
L5R5E.symbols.set("(lion)", { class: "i_lion", label: "" });
L5R5E.symbols.set("(mantis)", { class: "i_mantis", label: "" });
L5R5E.symbols.set("(phoenix)", { class: "i_phoenix", label: "" });
L5R5E.symbols.set("(scorpion)", { class: "i_scorpion", label: "" });
L5R5E.symbols.set("(tortoise)", { class: "i_tortoise", label: "" });
L5R5E.symbols.set("(unicorn)", { class: "i_unicorn", label: "" });

L5R5E.symbols.set("(bushi)", { class: "i_bushi", label: "" });
L5R5E.symbols.set("(courtier)", { class: "i_courtier", label: "" });
L5R5E.symbols.set("(shugenja)", { class: "i_shugenja", label: "" });
