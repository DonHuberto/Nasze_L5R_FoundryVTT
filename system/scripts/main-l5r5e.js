// Import Modules
import { RegisterSettings } from "./settings.js";
import { PreloadTemplates } from "./preloadTemplates.js";
import { ActorL5r5e } from "./actor-l5r5e.js";
import { ActorSheetL5r5e } from "./sheets/actor-sheet.js";
import { RollL5r5e, AbilityDie, RingDie, DicePickerDialog } from "./dice-l5r5e.js";
import { ItemL5r5e } from "./items/item.js";
import { ItemSheetL5r5e } from "./items/item-sheet.js";
import { WeaponSheetL5r5e } from "./items/weapon-sheet.js";
import { FeatSheetL5r5e } from "./items/feat-sheet.js";

// Import Dice Types

/* ------------------------------------ */
/* Initialize system                    */
/* ------------------------------------ */
Hooks.once("init", async function () {
    console.log("l5r5e | Initializing l5r5e");

    // Assign custom classes and constants here
    CONFIG.Actor.entityClass = ActorL5r5e;
    CONFIG.Actor.sheetClasses = ActorSheetL5r5e;
    CONFIG.Item.entityClass = ItemL5r5e;

    // Define custom Roll class
    CONFIG.Dice.rolls.push(CONFIG.Dice.rolls[0]);
    CONFIG.Dice.rolls[0] = RollL5r5e;

    // Define DiceTerms
    CONFIG.Dice.terms["s"] = AbilityDie;
    CONFIG.Dice.terms["r"] = RingDie;

    // Add some helper classes in game
    game.l5r5e = {
        DicePickerDialog,
    };

    // Define L5R Paths
    CONFIG.L5r5e = {
        paths: {
            assets: `systems/l5r5e/assets/`,
            templates: `systems/l5r5e/templates/`,
        },
    };

    // Register custom system settings
    RegisterSettings();

    // Preload Handlebars templates
    await PreloadTemplates();

    // Register custom sheets (if any)
    // Actors sheet
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("l5r5e", ActorSheetL5r5e, { types: ["character"], makeDefault: true });

    // Items sheet
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("l5r5e", ItemSheetL5r5e, { types: ["item"], makeDefault: true });
    Items.registerSheet("l5r5e", WeaponSheetL5r5e, { types: ["weapon"], makeDefault: true });
    Items.registerSheet("l5r5e", FeatSheetL5r5e, { types: ["feat"], makeDefault: true });

    // for debug
    Handlebars.registerHelper("json", function (object) {
        return new Handlebars.SafeString(JSON.stringify(object));
    });

    Handlebars.registerHelper("localizeSkillCategory", function (skillName) {
        const key = "l5r5e.skills." + skillName.toLowerCase() + ".title";
        return game.i18n.localize(key);
    });

    Handlebars.registerHelper("localizeSkill", function (skillCategory, skillName) {
        const key = "l5r5e.skills." + skillCategory.toLowerCase() + "." + skillName.toLowerCase();
        return game.i18n.localize(key);
    });

    Handlebars.registerHelper("localizeRing", function (ringName) {
        const key = "l5r5e.rings." + ringName.toLowerCase();
        return game.i18n.localize(key);
    });

    Handlebars.registerHelper("localizeRingTip", function (ringName) {
        const key = "l5r5e.rings." + ringName.toLowerCase() + "tip";
        return game.i18n.localize(key);
    });

    Handlebars.registerHelper("localizeStanceTip", function (ringName) {
        const key = "l5r5e.conflict.stances." + ringName.toLowerCase() + "tip";
        return game.i18n.localize(key);
    });
});

/* ------------------------------------ */
/* Setup system                         */
/* ------------------------------------ */
Hooks.once("setup", function () {
    // Do anything after initialization but before
    // ready
});

/* ------------------------------------ */
/* Actor Dialog                         */
/* ------------------------------------ */

/* ------------------------------------ */
/* When ready                           */
/* ------------------------------------ */
Hooks.once("ready", function () {
    // Do anything once the system is ready
    // Add title on button dice icon
    $.find(".chat-control-icon")[0].title = game.i18n.localize("l5r5e.chatdices.dicepicker");
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
/* DiceSoNice Hook                      */
/* ------------------------------------ */
Hooks.once("diceSoNiceReady", (dice3d) => {
    const texturePath = `${CONFIG.L5r5e.paths.assets}dices/default/3d/`;

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

// Add any additional hooks if necessary
