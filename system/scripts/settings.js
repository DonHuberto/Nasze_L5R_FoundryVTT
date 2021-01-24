/**
 * Custom system settings register
 */
export const RegisterSettings = function () {
    /* ------------------------------------ */
    /* Update                               */
    /* ------------------------------------ */
    game.settings.register("l5r5e", "systemMigrationVersion", {
        name: "System Migration Version",
        scope: "world",
        config: false,
        type: String,
        default: 0,
    });

    /* ------------------------------------ */
    /* Initiative Roll Dialog (GM only)     */
    /* ------------------------------------ */
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
    game.settings.register("l5r5e", "initiative.prepared.character", {
        name: "Initiative PC prepared or not",
        scope: "world",
        config: false,
        type: String,
        default: "null",
    });
    game.settings.register("l5r5e", "initiative.prepared.adversary", {
        name: "Initiative NPC adversary are prepared or not",
        scope: "world",
        config: false,
        type: String,
        default: "null",
    });
    game.settings.register("l5r5e", "initiative.prepared.minion", {
        name: "Initiative NPC minion are prepared or not",
        scope: "world",
        config: false,
        type: String,
        default: "null",
    });
};
