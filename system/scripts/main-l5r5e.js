// Import Commons Modules
import { L5R5E } from "./config.js";
import { HelpersL5r5e } from "./helpers.js";
import { RegisterSettings } from "./settings.js";
import { PreloadTemplates } from "./preloadTemplates.js";
import { HelpDialog } from "./help/help-dialog.js";
// Actors
import { ActorL5r5e } from "./actor.js";
import { CharacterSheetL5r5e } from "./actors/character-sheet.js";
import { NpcSheetL5r5e } from "./actors/npc-sheet.js";
// Dice and rolls
import { AbilityDie } from "./dice/dietype/ability-die.js";
import { RingDie } from "./dice/dietype/ring-die.js";
import { RollL5r5e } from "./dice/roll.js";
import { DicePickerDialog } from "./dice/dice-picker-dialog.js";
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

/* ------------------------------------ */
/* Initialize system                    */
/* ------------------------------------ */
Hooks.once("init", async function () {
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

    // Add some helper classes in game
    game.l5r5e = {
        HelpersL5r5e,
        RollL5r5e,
        DicePickerDialog,
        HelpDialog,
    };

    // Register custom system settings
    RegisterSettings();

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

    // Babele
    if (typeof Babele !== "undefined") {
        // eslint-disable-next-line no-undef
        Babele.get().register({
            module: "../systems/l5r5e", // babele only accept modules, so... well :D
            lang: "fr",
            dir: "babele/fr-fr",
        });
    }

    // ***** Handlebars *****
    // for debug
    Handlebars.registerHelper("json", function (...objects) {
        objects.pop(); // remove this function call
        return new Handlebars.SafeString(objects.map((e) => `<textarea>${JSON.stringify(e)}</textarea>`));
    });

    // Add props "checked" if a and b are equal ({{radioChecked a b}}
    Handlebars.registerHelper("radioChecked", function (a, b) {
        return a === b ? new Handlebars.SafeString('checked="checked"') : "";
    });

    Handlebars.registerHelper("localizeSkill", function (categoryId, skillId) {
        const key = "l5r5e.skills." + categoryId.toLowerCase() + "." + skillId.toLowerCase();
        return game.i18n.localize(key);
    });
    Handlebars.registerHelper("localizeSkillId", function (skillId) {
        const key = "l5r5e.skills." + L5R5E.skills.get(skillId.toLowerCase()) + "." + skillId.toLowerCase();
        return game.i18n.localize(key);
    });

    Handlebars.registerHelper("localizeRing", function (ringId) {
        const key = "l5r5e.rings." + ringId.toLowerCase();
        return game.i18n.localize(key);
    });

    Handlebars.registerHelper("localizeStanceTip", function (ringId) {
        const key = "l5r5e.conflict.stances." + ringId.toLowerCase() + "tip";
        return game.i18n.localize(key);
    });

    Handlebars.registerHelper("localizeTechnique", function (techniqueName) {
        return game.i18n.localize("l5r5e.techniques." + techniqueName.toLowerCase());
    });

    // Utility conditional, usable in nested expression
    // {{#ifCond (ifCond advancement.type '==' 'technique') '||' (ifCond item.data.technique_type '==' 'kata')}}
    // {#ifCond '["distinction","passion"]' 'includes' item.data.peculiarity_type}}
    Handlebars.registerHelper("ifCond", function (a, operator, b, options) {
        let result = false;
        switch (operator) {
            case "==":
                result = a == b;
                break;
            case "===":
                result = a === b;
                break;
            case "!=":
                result = a != b;
                break;
            case "!==":
                result = a !== b;
                break;
            case "<":
                result = a < b;
                break;
            case "<=":
                result = a <= b;
                break;
            case ">":
                result = a > b;
                break;
            case ">=":
                result = a >= b;
                break;
            case "&&":
                result = a && b;
                break;
            case "||":
                result = a || b;
                break;
            case "includes":
                result = a && b && a.includes(b);
                break;
            default:
                break;
        }
        if (typeof options.fn === "function") {
            return result ? options.fn(this) : options.inverse(this);
        }
        return result;
    });
});

/* ------------------------------------ */
/* Setup system                         */
/* ------------------------------------ */
// Hooks.once("setup", function () {
//     // Do anything after initialization but before ready
// });

/* ------------------------------------ */
/* Do anything once the system is ready */
/* ------------------------------------ */
Hooks.once("ready", function () {
    // Add title on button dice icon
    $(".chat-control-icon")[0].title = game.i18n.localize("l5r5e.chatdices.dicepicker");

    // Open Help dialog on clic on logo
    $("#logo")
        .on("click", () => new game.l5r5e.HelpDialog().render(true))
        .prop("title", game.i18n.localize("l5r5e.logo.alt"));
});

/* ------------------------------------ */
/* SidebarTab                           */
/* ------------------------------------ */
Hooks.on("renderSidebarTab", (app, html, data) => {
    // Add button on dice icon
    html.find(".chat-control-icon").click(async () => {
        new game.l5r5e.DicePickerDialog().render();
    });
});

/* ------------------------------------ */
/* Chat Message                         */
/* ------------------------------------ */
Hooks.on("renderChatMessage", (message, html, data) => {
    // Add a extra CSS class to roll
    if (message.isRoll) {
        html.addClass("roll");
    }
});

/* ------------------------------------ */
/* DiceSoNice Hook                      */
/* ------------------------------------ */
Hooks.once("diceSoNiceReady", (dice3d) => {
    const texturePath = `${CONFIG.l5r5e.paths.assets}dices/default/3d/`;

    // dice3d.addSystem({
    //     id: "l5r5e",
    //     name: "Legend of the Five Rings 5E"
    // }, "force");

    // Rings
    dice3d.addDicePreset(
        {
            name: "L5R Ring Dice",
            type: "ddr", // don't known why the "dd" prefix is required, term is "r"
            labels: Object.keys(RingDie.FACES).map(
                (e) => `${texturePath}${RingDie.FACES[e].image.replace("ring_", "")}.png`
            ),
            bumpMaps: Object.keys(RingDie.FACES).map(
                (e) => `${texturePath}${RingDie.FACES[e].image.replace("ring_", "")}_bm.png`
            ),
            colorset: "black",
            system: "standard",
        },
        "d6"
    );

    // Skills
    dice3d.addDicePreset(
        {
            name: "L5R Skill Dice",
            type: "dds",
            labels: Object.keys(AbilityDie.FACES).map(
                (e) => `${texturePath}${AbilityDie.FACES[e].image.replace("skill_", "")}.png`
            ),
            bumpMaps: Object.keys(AbilityDie.FACES).map(
                (e) => `${texturePath}${AbilityDie.FACES[e].image.replace("skill_", "")}_bm.png`
            ),
            colorset: "white",
            system: "standard",
        },
        "d12"
    );
});
