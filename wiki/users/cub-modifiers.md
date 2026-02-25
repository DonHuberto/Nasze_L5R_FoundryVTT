
> ⚠ ***Warning***:  This module is outdated and the project has been abandoned.  If you are using more current versions of Foundry (v11+), it is **not** recommended that you continue to use *Combat Utility Belt*.

# Using Combat Utility Belt (CUB) for Modifiers

> ⚠ The module [Combat Utility Belt](https://foundryvtt.com/packages/combat-utility-belt) is required.

## Attributes modifiers
Replace `<attribute>` with the actual system attribute (i.e. `endurance`, `vigilance`, `focus`, `composure`) and `<number>` with actual number to be added.

When setup in CUB this would modify PC-derived attributes to increase or reduce them by the number given.

This allows automating certain invocations and item effects (such as the cursed Kama from Sins of Regret supplement).

### For `character` type

Syntax:
> system.modifiers.character.`<attribute>` += `<number>`

Examples:
> system.modifiers.character.endurance += 1  // add 1
> <br>system.modifiers.character.focus += -2 // remove 2


### For `adversary` or `minion` types

Syntax:
> system.`<attribute>` += `<number>`

Examples:
> system.vigilance += 1      // add 1
> <br>system.composure += -2 // remove 2

## Rings/Skills modifiers

Both PCs and NPCs can have their skills and rings increased as well by conditions (should you wish to ignore some of the RAW).

Syntax:
> system.rings.`<ring>` += `<number>`
> <br>system.skills.`<skillGroup>`.`<skill>` += `<number>` // for PCs
> <br>system.skills.`<skillGroup>`           += `<number>` // for NPCs

Examples:
> system.rings.earth += 1
> <br>system.skills.artisan.aesthetics += 1  // for PCs
> <br>system.skills.martial            += -1 // for NPCs


The above has to be set up as conditions using CUB at the moment so that they can be added/removed as required.

Regarding skills and rings modifiers, you may need to remove them temporarily for advancements as it might cause extra XP to be spent.  This has not been fully tested.
