/**
 * Custom system settings register
 */
export const RegisterSettings = function () {
    /* ------------------------------------ */
    /* User settings                        */
    /* ------------------------------------ */
    game.settings.register("l5r5e", "rnk-deleteOldMessage", {
        name: "SETTINGS.RollNKeep.DeleteOldMessage",
        hint: "SETTINGS.RollNKeep.DeleteOldMessageHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
    });
    game.settings.register("l5r5e", "initiative-setTn1OnTypeChange", {
        name: "SETTINGS.Initiative.SetTn1OnTypeChange",
        hint: "SETTINGS.Initiative.SetTn1OnTypeChangeHint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
    });
    game.settings.register("l5r5e", "token-reverseFatigueBar", {
        name: "SETTINGS.ReverseFatigueBar",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
    });
    game.settings.register("l5r5e", "techniques-customs", {
        name: "SETTINGS.CustomTechniques.Title",
        hint: "SETTINGS.CustomTechniques.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
    });

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
    game.settings.register("l5r5e", "initiative-difficulty-hidden", {
        name: "Initiative difficulty is hidden",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        onChange: () => game.l5r5e.HelpersL5r5e.notifyDifficultyChange(),
    });
    game.settings.register("l5r5e", "initiative-difficulty-value", {
        name: "Initiative difficulty value",
        scope: "world",
        config: false,
        type: Number,
        default: 2,
        onChange: () => game.l5r5e.HelpersL5r5e.notifyDifficultyChange(),
    });
    game.settings.register("l5r5e", "initiative-encounter", {
        name: "Initiative encounter type",
        scope: "world",
        config: false,
        type: String,
        default: "skirmish",
        onChange: () => {
            if (game.settings.get("l5r5e", "initiative-setTn1OnTypeChange")) {
                game.settings.set("l5r5e", "initiative-difficulty-value", 1);
            }
        },
    });
    game.settings.register("l5r5e", "initiative-prepared-character", {
        name: "Initiative PC prepared or not",
        scope: "world",
        config: false,
        type: String,
        default: "null",
    });
    game.settings.register("l5r5e", "initiative-prepared-adversary", {
        name: "Initiative NPC adversary are prepared or not",
        scope: "world",
        config: false,
        type: String,
        default: "null",
    });
    game.settings.register("l5r5e", "initiative-prepared-minion", {
        name: "Initiative NPC minion are prepared or not",
        scope: "world",
        config: false,
        type: String,
        default: "null",
    });

    /* ------------------------------------ */
    /* GM Monitor windows (GM only)         */
    /* ------------------------------------ */
    game.settings.register("l5r5e", "gm-monitor-actors", {
        name: "Gm Monitor",
        scope: "world", // for sync between gm
        config: false,
        type: Array,
        default: [],
    });
};
