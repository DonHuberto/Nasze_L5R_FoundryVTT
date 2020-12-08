export const PreloadTemplates = async function() {
	const templatePaths = [
		// Add paths to "systems/l5r5e/templates"
		'systems/l5r5e/templates/sheets/actor/rings.html',
		'systems/l5r5e/templates/sheets/actor/narrative.html',
		'systems/l5r5e/templates/sheets/actor/identity.html',
		'systems/l5r5e/templates/sheets/actor/category.html',
		'systems/l5r5e/templates/sheets/actor/skill.html',
		'systems/l5r5e/templates/sheets/actor/social.html',
		'systems/l5r5e/templates/sheets/actor/attributes.html',
		'systems/l5r5e/templates/sheets/actor/conflict.html',
		'systems/l5r5e/templates/sheets/actor/stance.html',
		'systems/l5r5e/templates/sheets/actor/feats.html',
		'systems/l5r5e/templates/sheets/actor/experience.html',
		'systems/l5r5e/templates/sheets/actor/adquisition.html',
		// items
		'systems/l5r5e/templates/item/weapon-sheet.html',
		'systems/l5r5e/templates/item/items.html',
		'systems/l5r5e/templates/item/item-entry.html',
		'systems/l5r5e/templates/item/weapons.html',
		'systems/l5r5e/templates/item/weapon-entry.html',
		'systems/l5r5e/templates/item/feat-sheet.html',
		'systems/l5r5e/templates/item/feat-entry.html'
	];

	return loadTemplates(templatePaths);
}
