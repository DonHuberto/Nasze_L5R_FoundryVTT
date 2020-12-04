/**
 * Establish each L5r5e dice type here as extensions of DiceTerm.
 * @extends {DiceTerm}
 */

export { AbilityDie } from "./dice/dietype/AbilityDie.js";
export { RingsDie } from "./dice/dietype/RingsDie.js";

/**
 * New extension of the core DicePool class for evaluating rolls with the L5r5e DiceTerms
 */
export { RollL5r5e } from "./dice/roll.js";

/**
 * Dice pool utility specializing in the L5r5e special dice
 */
export { DicePoolL5r5e } from "./dice/pool.js";
