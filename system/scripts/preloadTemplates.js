export const PreloadTemplates = async function () {
    const templatePaths = [
        // Add paths to "systems/l5r5e/templates"
        // actors
        "systems/l5r5e/templates/actors/character/rings.html",
        "systems/l5r5e/templates/actors/character/narrative.html",
        "systems/l5r5e/templates/actors/character/identity.html",
        "systems/l5r5e/templates/actors/character/category.html",
        "systems/l5r5e/templates/actors/character/skill.html",
        "systems/l5r5e/templates/actors/character/social.html",
        "systems/l5r5e/templates/actors/character/attributes.html",
        "systems/l5r5e/templates/actors/character/conflict.html",
        "systems/l5r5e/templates/actors/character/stance.html",
        "systems/l5r5e/templates/actors/character/techniques.html",
        "systems/l5r5e/templates/actors/character/experience.html",
        "systems/l5r5e/templates/actors/character/advancement.html",
        "systems/l5r5e/templates/actors/character/twenty-questions-item.html",
        // npc
        "systems/l5r5e/templates/actors/npc/identity.html",
        "systems/l5r5e/templates/actors/npc/narrative.html",
        "systems/l5r5e/templates/actors/npc/social.html",
        "systems/l5r5e/templates/actors/npc/rings.html",
        "systems/l5r5e/templates/actors/npc/attributes.html",
        "systems/l5r5e/templates/actors/npc/skill.html",
        "systems/l5r5e/templates/actors/npc/techniques.html",
        // items
        "systems/l5r5e/templates/items/advancement/advancements.html",
        "systems/l5r5e/templates/items/advancement/advancement-entry.html",
        "systems/l5r5e/templates/items/advancement/advancement-sheet.html",
        "systems/l5r5e/templates/items/armor/armors.html",
        "systems/l5r5e/templates/items/armor/armor-entry.html",
        "systems/l5r5e/templates/items/armor/armor-sheet.html",
        "systems/l5r5e/templates/items/item/items.html",
        "systems/l5r5e/templates/items/item/item-entry.html",
        "systems/l5r5e/templates/items/item/item-value.html",
        "systems/l5r5e/templates/items/item/item-sheet.html",
        "systems/l5r5e/templates/items/item/item-infos.html",
        "systems/l5r5e/templates/items/peculiarity/peculiarities.html",
        "systems/l5r5e/templates/items/peculiarity/peculiarity-entry.html",
        "systems/l5r5e/templates/items/peculiarity/peculiarity-sheet.html",
        "systems/l5r5e/templates/items/property/properties.html",
        "systems/l5r5e/templates/items/property/property-entry.html",
        "systems/l5r5e/templates/items/property/property-sheet.html",
        "systems/l5r5e/templates/items/technique/technique-entry.html",
        "systems/l5r5e/templates/items/technique/technique-sheet.html",
        "systems/l5r5e/templates/items/weapon/weapons.html",
        "systems/l5r5e/templates/items/weapon/weapon-entry.html",
        "systems/l5r5e/templates/items/weapon/weapon-sheet.html",
    ];

    return loadTemplates(templatePaths);
};
