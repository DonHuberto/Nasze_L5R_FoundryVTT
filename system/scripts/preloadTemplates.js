export const PreloadTemplates = async function () {
    const templatePaths = [
        // Add paths to "systems/l5r5e/templates"
        // actor
        "systems/l5r5e/templates/sheets/actor/rings.html",
        "systems/l5r5e/templates/sheets/actor/narrative.html",
        "systems/l5r5e/templates/sheets/actor/identity.html",
        "systems/l5r5e/templates/sheets/actor/category.html",
        "systems/l5r5e/templates/sheets/actor/skill.html",
        "systems/l5r5e/templates/sheets/actor/social.html",
        "systems/l5r5e/templates/sheets/actor/attributes.html",
        "systems/l5r5e/templates/sheets/actor/conflict.html",
        "systems/l5r5e/templates/sheets/actor/stance.html",
        "systems/l5r5e/templates/sheets/actor/techniques.html",
        "systems/l5r5e/templates/sheets/actor/experience.html",
        "systems/l5r5e/templates/sheets/actor/advancement.html",
        // npc
        "systems/l5r5e/templates/sheets/npc/identity.html",
        "systems/l5r5e/templates/sheets/npc/narrative.html",
        "systems/l5r5e/templates/sheets/npc/social.html",
        "systems/l5r5e/templates/sheets/npc/rings.html",
        "systems/l5r5e/templates/sheets/npc/attributes.html",
        "systems/l5r5e/templates/sheets/npc/skill.html",
        "systems/l5r5e/templates/sheets/npc/techniques.html",
        // items
        "systems/l5r5e/templates/item/weapon-sheet.html",
        "systems/l5r5e/templates/item/items.html",
        "systems/l5r5e/templates/item/item-entry.html",
        "systems/l5r5e/templates/item/weapons.html",
        "systems/l5r5e/templates/item/weapon-entry.html",
        "systems/l5r5e/templates/item/armors.html",
        "systems/l5r5e/templates/item/armor-entry.html",
        "systems/l5r5e/templates/item/technique-sheet.html",
        "systems/l5r5e/templates/item/technique-entry.html",
        "systems/l5r5e/templates/item/qualities.html",
        "systems/l5r5e/templates/item/quality-sheet.html",
        "systems/l5r5e/templates/item/quality-entry.html",
    ];

    return loadTemplates(templatePaths);
};
