/**
 * Custom system settings register
 */
export const RegisterSettings = function () {
    const isBabeleRegistered = (typeof Babele !== "undefined");

    /* ------------------------------------ */
    /* User settings                        */
    /* ------------------------------------ */
    game.settings.register(CONFIG.l5r5e.namespace, "rnk-deleteOldMessage", {
        name: "SETTINGS.RollNKeep.DeleteOldMessage",
        hint: "SETTINGS.RollNKeep.DeleteOldMessageHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean,
    });
    game.settings.register(CONFIG.l5r5e.namespace, "initiative-setTn1OnTypeChange", {
        name: "SETTINGS.Initiative.SetTn1OnTypeChange",
        hint: "SETTINGS.Initiative.SetTn1OnTypeChangeHint",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
    });
    game.settings.register(CONFIG.l5r5e.namespace, "token-reverseFatigueBar", {
        name: "SETTINGS.ReverseFatigueBar",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
    });
    game.settings.register(CONFIG.l5r5e.namespace, "techniques-customs", {
        name: "SETTINGS.CustomTechniques.Title",
        hint: "SETTINGS.CustomTechniques.Hint",
        scope: "world",
        config: true,
        type: Boolean,
        default: false,
    });
    game.settings.register(CONFIG.l5r5e.namespace, "custom-compendium-name", {
        name: "SETTINGS.CustomCompendiumName.Title",
        hint: "SETTINGS.CustomCompendiumName.Hint",
        scope: "world",
        config: isBabeleRegistered,
        requiresReload: true,
        type: String,
        default: "l5r5e-custom-compendiums",
        onChange: (name) => {
            if (!Babele.get().modules.find((module) => module.module === name)) {
                ui.notifications.warn(game.i18n.format("SETTINGS.CustomCompendiumName.Notification", { name }), { permanent: true });
            }
        }
    });

    /* ------------------------------------ */
    /* Update                               */
    /* ------------------------------------ */
    game.settings.register(CONFIG.l5r5e.namespace, "systemMigrationVersion", {
        name: "System Migration Version",
        scope: "world",
        config: false,
        type: String,
        default: 0,
    });

    /* ------------------------------------ */
    /* Initiative Roll Dialog (GM only)     */
    /* ------------------------------------ */
    game.settings.register(CONFIG.l5r5e.namespace, "initiative-difficulty-hidden", {
        name: "Initiative difficulty is hidden",
        scope: "world",
        config: false,
        type: Boolean,
        default: false,
        onChange: () => game.l5r5e.HelpersL5r5e.notifyDifficultyChange(),
    });
    game.settings.register(CONFIG.l5r5e.namespace, "initiative-difficulty-value", {
        name: "Initiative difficulty value",
        scope: "world",
        config: false,
        type: Number,
        default: 2,
        onChange: () => game.l5r5e.HelpersL5r5e.notifyDifficultyChange(),
    });
    game.settings.register(CONFIG.l5r5e.namespace, "initiative-encounter", {
        name: "Initiative encounter type",
        scope: "world",
        config: false,
        type: String,
        default: "skirmish",
        onChange: () => {
            if (game.settings.get(CONFIG.l5r5e.namespace, "initiative-setTn1OnTypeChange")) {
                game.settings.set(CONFIG.l5r5e.namespace, "initiative-difficulty-value", 1);
            }
            ui.combat.render(true);
        },
    });
    game.settings.register(CONFIG.l5r5e.namespace, "initiative-prepared-character", {
        name: "Initiative PC prepared or not",
        scope: "world",
        config: false,
        type: String,
        default: "actor",
        onChange: () => {
            game.l5r5e.HelpersL5r5e.refreshLocalAndSocket("l5r5e-gm-monitor");
            ui.combat.render(true);
        },
    });
    game.settings.register(CONFIG.l5r5e.namespace, "initiative-prepared-adversary", {
        name: "Initiative NPC adversary are prepared or not",
        scope: "world",
        config: false,
        type: String,
        default: "actor",
        onChange: () => {
            game.l5r5e.HelpersL5r5e.refreshLocalAndSocket("l5r5e-gm-monitor");
            ui.combat.render(true);
        },
    });
    game.settings.register(CONFIG.l5r5e.namespace, "initiative-prepared-minion", {
        name: "Initiative NPC minion are prepared or not",
        scope: "world",
        config: false,
        type: String,
        default: "actor",
        onChange: () => {
            game.l5r5e.HelpersL5r5e.refreshLocalAndSocket("l5r5e-gm-monitor");
            ui.combat.render(true);
        },
    });

    /* ------------------------------------ */
    /* GM Monitor windows (GM only)         */
    /* ------------------------------------ */
    game.settings.register(CONFIG.l5r5e.namespace, "gm-monitor-actors", {
        name: "Gm Monitor",
        scope: "world",
        config: false,
        type: Array,
        default: [],
        onChange: () => game.l5r5e.HelpersL5r5e.refreshLocalAndSocket("l5r5e-gm-monitor"),
    });
};
