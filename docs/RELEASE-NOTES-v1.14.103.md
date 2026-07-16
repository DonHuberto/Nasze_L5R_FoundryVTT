# L5R5e system 1.14.103 — Combat Tracker Dock backend

This patch provides the minimal public backend required by the independent L5R5e Combat Tracker Dock module.

## Changes

- Added the public `game.l5r5e.lateArrivals` service.
- Added lifecycle hooks for every Combatant created during an active conflict, regardless of whether it was added through the native Token HUD, the native Combat Tracker, or a module frontend.
- Persisted only the late-arrival data not supplied by Foundry's native `Combatant#roundJoined`: schema version, joined/eligible rounds, conflict type, initiative skill, TN, and resolver state.
- Added Intrigue late arrival using the normal Sentiment initiative test immediately after arrival.
- Added Skirmish late arrival using Tactics TN 2 at the start of the next eligible round.
- Added Mass Battle late arrival using Command TN 2 at the start of the next eligible round.
- Rejected a third participant in an active Duel, including a defensive authority-side check for batch creation races.
- Delegated PC pickers, adversary automation, minion initiative, Strife, Opportunity, stance, tie keys, and initiative groups to the existing core initiative workflow.
- Restricted persistent mutations and late initiative resolution to the elected authority GM.
- Updated `CombatL5r5e#rollInitiative` so per-call `messageOptions.difficulty` and `difficultyHidden` also apply to automated adversaries.
- Updated initiative lookup to use the receiving Combat document instead of the globally active Combat.
- Documented the new public API and the inherited public `Combat#rollNPC` integration point.
- Added English and Polish localization for Duel rejection.
- Bumped the system manifest, tag URLs, and download URL from `1.14.102` to `1.14.103`.

## Verification

- 46/46 system tests pass, including six late-arrival regression tests.
- Syntax validation passes for 84 files.
- ESLint passes without errors.
- `git diff --check` reports no whitespace errors.
