// Import Commons Modules
import { L5R5E } from "./config.js";
import { HelpersL5r5e } from "./helpers.js";
import { SocketHandlerL5r5e } from "./socket-handler.js";
import { RegisterSettings } from "./settings.js";
import { PreloadTemplates } from "./preloadTemplates.js";
import { RegisterHandlebars } from "./handlebars.js";
import { HelpDialog } from "./help/help-dialog.js";
import HooksL5r5e from "./hooks.js";
// Actors
import { ActorL5r5e } from "./actor.js";
import { CharacterSheetL5r5e } from "./actors/character-sheet.js";
import { NpcSheetL5r5e } from "./actors/npc-sheet.js";
// Dice and rolls
import { L5rBaseDie } from "./dice/dietype/l5r-base-die.js";
import { AbilityDie } from "./dice/dietype/ability-die.js";
import { RingDie } from "./dice/dietype/ring-die.js";
import { RollL5r5e } from "./dice/roll.js";
import { DicePickerDialog } from "./dice/dice-picker-dialog.js";
import { RollnKeepDialog } from "./dice/roll-n-keep-dialog.js";
import { CombatL5r5e } from "./combat.js";
import { GmToolsDialog } from "./dice/gm-tools-dialog.js";
// Items
import { ItemL5r5e } from "./item.js";
import { ItemSheetL5r5e } from "./items/item-sheet.js";
import { ArmorSheetL5r5e } from "./items/armor-sheet.js";
import { WeaponSheetL5r5e } from "./items/weapon-sheet.js";
import { TechniqueSheetL5r5e } from "./items/technique-sheet.js";
import { PropertySheetL5r5e } from "./items/property-sheet.js";
import { AdvancementSheetL5r5e } from "./items/advancement-sheet.js";
import { PeculiaritySheetL5r5e } from "./items/peculiarity-sheet.js";
// JournalEntry
import { JournalL5r5e } from "./journal.js";
import { BaseJournalSheetL5r5e } from "./journals/base-journal-sheet.js";
// Specific
import { MigrationL5r5e } from "./migration.js";

/* ------------------------------------ */
/* Initialize system                    */
/* ------------------------------------ */
Hooks.once("init", async () => {
    // ***** Initializing l5r5e *****
    // Ascii art :p
    console.log(
        "  _    ___ ___   ___\n" +
            " | |  | __| _ \\ | __| ___ \n" +
            " | |__|__ \\   / |__ \\/ -_)\n" +
            " |____|___/_|_\\ |___/\\___|\n" +
            " "
    );

    // ***** Config *****
    // Global access to L5R Config
    CONFIG.l5r5e = L5R5E;

    // Assign custom classes and constants here
    CONFIG.Combat.entityClass = CombatL5r5e;
    CONFIG.Actor.entityClass = ActorL5r5e;
    CONFIG.Actor.sheetClasses = CharacterSheetL5r5e;
    CONFIG.Item.entityClass = ItemL5r5e;
    CONFIG.JournalEntry.entityClass = JournalL5r5e;
    CONFIG.JournalEntry.sheetClass = BaseJournalSheetL5r5e;

    // Define custom Roll class
    CONFIG.Dice.rolls.push(CONFIG.Dice.rolls[0]);
    CONFIG.Dice.rolls[0] = RollL5r5e;

    // Define DiceTerms
    CONFIG.Dice.terms["s"] = AbilityDie;
    CONFIG.Dice.terms["r"] = RingDie;

    // Add some classes in game
    game.l5r5e = {
        L5rBaseDie,
        RingDie,
        AbilityDie,
        HelpersL5r5e,
        RollL5r5e,
        DicePickerDialog,
        RollnKeepDialog,
        GmToolsDialog,
        ActorL5r5e,
        HelpDialog,
        sockets: new SocketHandlerL5r5e(),
        migrations: MigrationL5r5e,
    };

    // Register custom system settings
    RegisterSettings();

    // Register custom Handlebars Helpers
    RegisterHandlebars();

    // Preload Handlebars templates
    await PreloadTemplates();

    // ***** Register custom sheets *****
    // Actors
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("l5r5e", CharacterSheetL5r5e, { types: ["character"], makeDefault: true });
    Actors.registerSheet("l5r5e", NpcSheetL5r5e, { types: ["npc"], makeDefault: true });

    // Items
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("l5r5e", ItemSheetL5r5e, { types: ["item"], makeDefault: true });
    Items.registerSheet("l5r5e", ArmorSheetL5r5e, { types: ["armor"], makeDefault: true });
    Items.registerSheet("l5r5e", WeaponSheetL5r5e, { types: ["weapon"], makeDefault: true });
    Items.registerSheet("l5r5e", TechniqueSheetL5r5e, { types: ["technique"], makeDefault: true });
    Items.registerSheet("l5r5e", PropertySheetL5r5e, { types: ["property"], makeDefault: true });
    Items.registerSheet("l5r5e", PeculiaritySheetL5r5e, { types: ["peculiarity"], makeDefault: true });
    Items.registerSheet("l5r5e", AdvancementSheetL5r5e, { types: ["advancement"], makeDefault: true });

    // Journal
    Items.unregisterSheet("core", JournalSheet);
    Items.registerSheet("l5r5e", BaseJournalSheetL5r5e, { makeDefault: true });

    // Override the default Token _drawBar function to allow fatigue bar reversing.
    Token.prototype._drawBar = function (number, bar, data) {
        const reverseBar = data.attribute === "fatigue" && game.settings.get("l5r5e", "token.reverseFatigueBar");

        // Bar value
        const pct = Math.clamped(Number(data.value), 0, data.max) / data.max;

        // Modify color
        let color = number === 0 ? [pct / 1.2, 1 - pct, 0] : [0.5 * pct, 0.7 * pct, 0.5 + pct / 2];

        // Red if compromised
        if (data.attribute === "strife" && data.value > data.max) {
            color = [1, 0.1, 0.1];
        }

        // Enlarge the bar for large tokens
        let h = Math.max(canvas.dimensions.size / 12, 8);
        if (this.data.height >= 2) {
            h *= 1.6;
        }

        // Draw the bar
        bar.clear()
            .beginFill(0x000000, 0.5)
            .lineStyle(2, 0x000000, 0.9)
            .drawRoundedRect(0, 0, this.w, h, 3)
            .beginFill(PIXI.utils.rgb2hex(color), 0.8)
            .lineStyle(1, 0x000000, 0.8)
            .drawRoundedRect(1, 1, (reverseBar ? 1 - pct : pct) * (this.w - 2), h - 2, 2);

        // Set position
        bar.position.set(0, number === 0 ? this.h - h : 0);
    };
});

/* ------------------------------------ */
/* Hooks Once                           */
/* ------------------------------------ */
Hooks.once("setup", HooksL5r5e.setup);
Hooks.once("ready", HooksL5r5e.ready);
Hooks.once("diceSoNiceReady", (dice3d) => HooksL5r5e.diceSoNiceReady(dice3d));

/* ------------------------------------ */
/* Hooks On                             */
/* ------------------------------------ */
Hooks.on("renderSidebarTab", (app, html, data) => HooksL5r5e.renderSidebarTab(app, html, data));
Hooks.on("renderChatMessage", (message, html, data) => HooksL5r5e.renderChatMessage(message, html, data));
Hooks.on("renderCombatTracker", (app, html, data) => HooksL5r5e.renderCombatTracker(app, html, data));
Hooks.on("renderCompendium", async (app, html, data) => HooksL5r5e.renderCompendium(app, html, data));
Hooks.on("diceSoNiceRollStart", (messageId, context) => HooksL5r5e.diceSoNiceRollStart(messageId, context));
