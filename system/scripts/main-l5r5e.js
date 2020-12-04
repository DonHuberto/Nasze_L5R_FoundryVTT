// Import Modules
import { RegisterSettings } from './settings.js';
import { PreloadTemplates } from './preloadTemplates.js';
import { ActorL5r5e } from "./actor-l5r5e.js";
import { ActorSheetL5r5e } from './sheets/actor-sheet.js';

// Import Dice Types

/* ------------------------------------ */
/* Initialize system                    */
/* ------------------------------------ */
Hooks.once('init', async function() {
    console.log('l5r5e | Initializing l5r5e');
    
    // Assign custom classes and constants here
    CONFIG.Actor.entityClass = ActorL5r5e;
    CONFIG.Actor.sheetClasses = ActorSheetL5r5e;
    
    // Register custom system settings
    RegisterSettings();
    
    // Preload Handlebars templates
    await PreloadTemplates();
    
    // Register custom sheets (if any)
    // Actors sheet
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("l5r5e", ActorSheetL5r5e, { types: ["character"], makeDefault: true });
    
    Handlebars.registerHelper('localizeSkillCategory', function(skillName) {
        const key = 'L5r5e.Skills.' + skillName + '.Title';
        return game.i18n.localize(key);
    });
    
    Handlebars.registerHelper('localizeSkill', function(skillCategory, skillName) {
        const key = 'L5r5e.Skills.' + skillCategory + '.' + skillName;
        return game.i18n.localize(key);
    });
    
    Handlebars.registerHelper('localizeRing', function(ringName) {
        const key = 'L5r5e.Rings.' + ringName.charAt(0).toUpperCase() + ringName.slice(1);
        return game.i18n.localize(key);
    });
    
    Handlebars.registerHelper('localizeRingTip', function(ringName) {
        const key = 'L5r5e.Rings.' + ringName.charAt(0).toUpperCase() + ringName.slice(1) + "Tip";
        return game.i18n.localize(key);
    });
    
    Handlebars.registerHelper('localizeStanceTip', function(ringName) {
        const key = 'L5r5e.Conflict.Stances.' + ringName.charAt(0).toUpperCase() + ringName.slice(1) + "Tip";
        return game.i18n.localize(key);
    });
});

/* ------------------------------------ */
/* Setup system                         */
/* ------------------------------------ */
Hooks.once('setup', function() {
    // Do anything after initialization but before
    // ready
});

/* ------------------------------------ */
/* Actor Dialog                         */
/* ------------------------------------ */

/* ------------------------------------ */
/* When ready                           */
/* ------------------------------------ */
Hooks.once('ready', function() {
    // Do anything once the system is ready
});

// Add any additional hooks if necessary
