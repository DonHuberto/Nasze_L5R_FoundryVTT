export const L5R5E = {};

L5R5E.paths = {
    assets: `systems/l5r5e/assets/`,
    templates: `systems/l5r5e/templates/`,
};

L5R5E.stances = ["earth", "air", "water", "fire", "void"];
L5R5E.techniques = ["kata", "kiho", "invocation", "ritual", "shuji", "maho", "ninjutsu"];
L5R5E.xpPerRank = [20, 24, 32, 44, 60];

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
