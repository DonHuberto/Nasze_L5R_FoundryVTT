# Foundry VTT 14 manual smoke tests

Use a disposable migrated world with a gridded skirmish scene, a gridless scene, two player clients and two simultaneously active GM clients. Keep the browser console open. Confirm that only the elected GM applies foreign/NPC mutations and that no effect is duplicated.

## Roll and Opportunity

1. Open an ordinary Dice Picker: no action type is selected. Open a Strike/structured technique: its metadata selects only the declared types; manual toggles remain usable.
2. Reduce TN with modifiers below 1 and confirm final TN remains 1. Combine Air, Dazed, Wounded, Prone and Silenced contexts and confirm every reason appears once.
3. Fail a Fire check with kept Strife; Fire cannot turn it into success. Succeed and verify Fire bonus successes affect initiative/damage.
4. With Compromised, keep a Strife die; with Incapacitated, open and roll a checked action. Both reach final summary but are blocked there.
5. On the same Void roll spend `conflict-void-ignore-condition` for the relevant condition. Confirm finalization succeeds, the visible condition remains, and its suspension expires at the end of the next turn.
6. Inspect the informational Opportunity panel while choosing dice, then the selectable final panel. Test checkbox, `op+` counter, overspend, required condition/target, automatic/confirm/manual effects and unknown executor fallback.
7. Verify the Strife ledger for Void, universal check-only removal, Water removal of prior Strife and Intoxicated. There must be no manual applied-Strife counter.
8. Spend an Opportunity whose executor inflicts a direct critical strike. Confirm it opens its own mitigation workflow after the parent roll commits and is linked to that roll's transaction history.

## Damage and critical

1. Attack a selected target with an explicitly selected weapon/grip. Missing weapon or target must produce a manual warning, never choose the first equipped weapon.
2. Exercise physical/supernatural resistance, increases/reductions, zero damage, normal defense, voluntary Void/critical and Incapacitated automatic critical.
3. Use a Razor-Edged weapon against Durable armor and reduce attack damage to zero. Confirm Razor-Edged item damage and Durable/Damaged/Destroyed transitions are atomic and no invented damage state appears.
4. Resolve critical severities at 0, 3, 5, 7, 9, 12, 14 and 16. Verify Ring wounds, Bleeding, Dying and Dead. Test Unconscious +10 and Incapacitated becoming Unconscious.
5. Invoke Shattering Parry once per session, select a readied weapon, reroll all mitigation dice and confirm no critical consequence was committed before the branch.
6. Apply a critical to a minion and confirm Fatigue equal to severity instead of the standard table. Defeat minions with source damage 6 and 7 to verify non-lethal/lethal outcomes.
7. Create a repeated scar and confirm the GM choice for Dying 5 uses a compendium UUID.
8. Edit or rename the newly embedded scar, then attempt replay. Confirm rollback reports a conflict and does not delete the edited Item.

## Turns, conditions and movement

1. Open/cancel an action dialog; the reservation clears. Complete an action; the primary slot commits. Test Water's no-check extra action with both distinct and overlapping action types.
2. Trigger Burning after an action, Bleeding after kept Strife, end-turn Dazed/Disoriented/Immobilized cleanup, Dying countdown and scene-end recovery with/without Exhausted.
3. On a square grid, test orthogonal cost 1, diagonal cost 2 and difficult-square exit surcharge capped at 3. Use multi-waypoint paths.
4. Confirm walls and impassable Regions block Foundry pathfinding. Put an enemy token in the route and verify ordinary movement blocks it while explicit GM override is audited.
5. Test free movement, unchecked Maneuver, failed TN 2 Maneuver (one band), successful Maneuver (two plus one band per two bonus successes), Water Maneuver and structured technique budget modifiers.
6. Move by dragging and keyboard. Exceeding budget must prevent drop. Confirm movement ID/history, remaining budget and hook refresh.
7. Undo before another action: return to the anchor and restore budget without refunding Maneuver/action. After another action, end turn or non-reversible Region effect, verify undo is disabled/warns.
8. Repeat on a gridless scene; automation disables without console errors.

## Initiative, authority and replay

1. PC opens its own picker. Adversary rolls once, secretly, by the authoritative GM. Minion uses Focus when Prepared and Vigilance when Unprepared without rolling.
2. Verify Ring is chosen before one adversary roll, Fire and Opportunity policy are applied, and the raw pool stays GM-only.
3. Test equal initiative: lower Honor, PC/adversary/minion, then persisted tie key. Test a structural initiative group sharing result/stance.
4. With two active GMs and two players, apply damage/condition once and inspect transaction/request IDs for deduplication.
5. From the roll message change TN, assign/change target, reopen Opportunity and show history. Verify Air/resistance/defense/damage/critical are recalculated.
6. Change a target document independently after resolution, then replay. Confirm a visible conflict/diff and no silent overwrite. With unchanged documents, confirm rollback, incremented revision and updated message history.
7. Repeat replay for a roll made by a Bleeding actor and for a roll that committed Burning/action state. Confirm the old revision is reverted before new `before` values are calculated and both lifecycle effects remain exactly once.
