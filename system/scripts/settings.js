/**
 * Custom system settings register
 */
export const RegisterSettings = function () {
    /**
     * Settings set by Initiative Roll Dialog (GM only)
     */
    game.settings.register("l5r5e", "initiative.difficulty.hidden", {
        name: "Initiative difficulty is hidden",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
    });
    game.settings.register("l5r5e", "initiative.difficulty.value", {
        name: "Initiative difficulty value",
        scope: "world",
        config: false,
        type: Number,
        default: 2,
    });
    game.settings.register("l5r5e", "initiative.encounter", {
        name: "Initiative encounter type",
        scope: "world",
        config: false,
        type: String,
        default: "skirmish",
    });
    game.settings.register("l5r5e", "initiative.prepared", {
        name: "Initiative NPC prepared or not",
        scope: "world",
        config: false,
        type: Boolean,
        default: true,
    });
};
