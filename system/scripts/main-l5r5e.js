// Import Modules
import { L5R5E } from "./l5r5e-config.js";
import { RegisterSettings } from "./settings.js";
import { PreloadTemplates } from "./preloadTemplates.js";
import { ActorL5r5e } from "./actor-l5r5e.js";
import { ActorSheetL5r5e } from "./sheets/actor-sheet.js";
import { NpcSheetL5r5e } from "./sheets/npc-sheet.js";
import { RollL5r5e, AbilityDie, RingDie, DicePickerDialog } from "./dice-l5r5e.js";
import { ItemL5r5e } from "./items/item.js";
import { ItemSheetL5r5e } from "./items/item-sheet.js";
import { ArmorSheetL5r5e } from "./items/armor-sheet.js";
import { WeaponSheetL5r5e } from "./items/weapon-sheet.js";
import { TechniqueSheetL5r5e } from "./items/technique-sheet.js";
import { QualitySheetL5r5e } from "./items/quality-sheet.js";
import { AdvancementSheetL5r5e } from "./items/advancement-sheet.js";

// Import Dice Types

/* ------------------------------------ */
/* Initialize system                    */
/* ------------------------------------ */
Hooks.once("init", async function () {
    // console.log("L5R5e | Initializing l5r5e");
    // Ascii art
    console.log(
        "  _    ___ ___   ___\n" +
            " | |  | __| _ \\ | __| ___ \n" +
            " | |__|__ \\   / |__ \\/ -_)\n" +
            " |____|___/_|_\\ |___/\\___|\n" +
            " "
    );

    // Global access to L5R Config
    CONFIG.L5r5e = L5R5E;

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

    // Register custom system settings
    RegisterSettings();

    // Preload Handlebars templates
    await PreloadTemplates();

    // Register custom sheets (if any)
    // Actors sheet
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("l5r5e", ActorSheetL5r5e, { types: ["character"], makeDefault: true });
    Actors.registerSheet("l5r5e", NpcSheetL5r5e, { types: ["npc"], makeDefault: false });

    // Items sheet
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("l5r5e", ItemSheetL5r5e, { types: ["item"], makeDefault: true });
    Items.registerSheet("l5r5e", ArmorSheetL5r5e, { types: ["armor"], makeDefault: true });
    Items.registerSheet("l5r5e", WeaponSheetL5r5e, { types: ["weapon"], makeDefault: true });
    Items.registerSheet("l5r5e", TechniqueSheetL5r5e, { types: ["technique"], makeDefault: true });
    Items.registerSheet("l5r5e", QualitySheetL5r5e, { types: ["quality"], makeDefault: true });
    Items.registerSheet("l5r5e", AdvancementSheetL5r5e, { types: ["advancement"], makeDefault: true });

    // for debug
    Handlebars.registerHelper("json", function (...objects) {
        objects.pop(); // remove this function call
        return new Handlebars.SafeString(objects.map((e) => `<textarea>${JSON.stringify(e)}</textarea>`));
    });

    // Add props "checked" if a and b are equal ({{radioChecked a b}}
    Handlebars.registerHelper("radioChecked", function (a, b) {
        return a === b ? new Handlebars.SafeString('checked="checked"') : "";
    });

    Handlebars.registerHelper("localizeSkillCategory", function (skillName) {
        const key = "l5r5e.skills." + skillName.toLowerCase() + ".title";
        return game.i18n.localize(key);
    });

    Handlebars.registerHelper("localizeSkill", function (skillCategory, skillName) {
        const key = "l5r5e.skills." + skillCategory.toLowerCase() + "." + skillName.toLowerCase();
        return game.i18n.localize(key);
    });

    Handlebars.registerHelper("localizeSkillId", function (skillName) {
        const key = "l5r5e.skills." + L5R5E.skills.get(skillName.toLowerCase()) + "." + skillName.toLowerCase();
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

    Handlebars.registerHelper("localizeTechnique", function (techniqueName) {
        return game.i18n.localize("l5r5e.techniques." + techniqueName.toLowerCase());
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
    $(".chat-control-icon")[0].title = game.i18n.localize("l5r5e.chatdices.dicepicker");
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

// Logo & Menu options
Hooks.once("ready", async function () {
    // -- Function Open Edge-Studio Website
    function openEdge() {
        ui.notifications.info(game.i18n.localize("l5r5e.logo.edge-info"));
        var windowObjectReference = window.open(game.i18n.localize("l5r5e.logo.edge-link"), "_blank");
    }
    // -- Open Function Edge's DriveThruRpg
    function openDrive() {
        ui.notifications.info(game.i18n.localize("l5r5e.logo.drive-info"));
        var windowObjectReference = window.open(game.i18n.localize("l5r5e.logo.drive-link"), "_blank");
    }
    // -- Open Function Discord Link
    function openDiscord() {
        ui.notifications.info(game.i18n.localize("l5r5e.logo.discord-info"));
        var windowObjectReference = window.open(game.i18n.localize("l5r5e.logo.discord-link"), "_blank");
    }

    //-- Logo Menu Link
    let liensExt = new Dialog({
        title: game.i18n.localize("l5r5e.logo.title"),
        content: "<p>" + game.i18n.localize("l5r5e.logo.content") + "</p>",
        buttons: {
            one: {
                icon: '<i class="fas fa-check"></i>',
                label: game.i18n.localize("l5r5e.logo.edge"),
                callback: () => openEdge(),
            },
            two: {
                icon: '<i class="fas fa-check"></i>',
                label: game.i18n.localize("l5r5e.logo.drive"),
                callback: () => openDrive(),
            },
            three: {
                icon: '<i class="fas fa-check"></i>',
                label: game.i18n.localize("l5r5e.logo.discord"),
                callback: () => openDiscord(),
            },
        },
    });
    //-- Logo
    var logo = document.getElementById("logo");
    logo.setAttribute("src", game.i18n.localize("l5r5e.logo.src"));

    //-- Open menu on Logo click
    logo.setAttribute("title", game.i18n.localize("l5r5e.logo.alt"));
    logo.addEventListener("click", function () {
        liensExt.render(true);
    });
});

// Add any additional hooks if necessary
