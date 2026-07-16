# L5R5e core automation implementation plan

Baseline audited on 2026-07-16:

- repository: `DonHuberto/Nasze_L5R_FoundryVTT`, branch `master`;
- commit: `138503bc617ab7ee7a8308c47ef486e8a4eacd12`;
- manifest: system `1.14.101`, Foundry VTT 14 only;
- tracked worktree clean; pre-existing untracked `system.zip` is outside this change;
- no local `AGENTS.md` instructions were found.

## Integration points found during audit

- `system/scripts/dice/dice-picker-dialog.js`: action metadata, base/final TN, item/target context, provisional legality and roll creation.
- `system/scripts/dice/roll-n-keep-dialog.js`: kept/exploding dice, current symbol summary, final result form, ChatMessage replacement and the existing manual Strife control.
- `system/scripts/dice/roll.js`: canonical serialized roll payload and ChatMessage rendering.
- `system/scripts/actor.js`: derived thresholds, condition synchronization, NPC subtype helpers and Prepared state.
- `system/scripts/combat.js`: initiative routing, score calculation and tie ordering.
- `system/scripts/socket-handler.js`: current socket transport; authoritative GM request/response and idempotency belong here or in a service used by it.
- `system/scripts/hooks.js`: combat, chat context menu, movement and lifecycle hook registration.
- `system/scripts/tatical-grid-rulers.js`: legacy ruler/settings integration to preserve while moving enforcement to public Foundry VTT 14 movement APIs.
- `system/scripts/main-l5r5e.js`: service construction, public `game.l5r5e` API and sheet registration.
- `system/template.json`: Opportunity Item, structured weapon grip, technique activation and stable rule metadata.
- `system/scripts/migration.js`: versioned Actor, Item, Combatant, ChatMessage and compendium migration/seed.
- `system/templates/dice/*`, item sheets and `system/styles/l5r5e.scss`: Roll and Keep panels, Opportunity sheet and structured metadata editors.
- `system/lang/en-en.json` plus new `system/lang/pl-pl.json`: all new UI, warnings and audit labels.
- `system/system.json`: native Opportunity pack and Polish language registration; release version remains unchanged.

Foundry VTT 14 API verified for implementation: `Token.planMovement({maxCost, preventDrop, ...})`, `Token.findMovementPath`, `Token.measureMovementPath`, `TokenDocument.movementHistory`, `TokenDocument.revertRecordedMovement(movementId)` and `TokenDocument.clearMovementHistory()`, with public `preMoveToken`, `moveToken`, `stopToken` and `recordToken` hooks.

## Stage checklist

- [x] Stage 1 — data foundation and confirmed bug fixes
  - [x] Empty default action tags and structural inference with manual override preserved.
  - [x] Actual checks clamp final TN to at least 1 and apply each TN modifier once.
  - [x] Correct Fire success gating/effective bonus successes, Prepared boolean, NPC subtype and zero initiative handling.
  - [x] Threshold synchronization, minion defeat/critical conversion and Bleeding through `DamageService`.
  - [x] Stable `rulesKey` data and migration for qualities/rules documents.
- [x] Stage 2 — native, data-driven opportunities
  - [x] `opportunity` Item schema, ApplicationV2 sheet, validation and native compendium/seed.
  - [x] `OpportunityRepository`, filtering/budget/executor `OpportunityService` and unknown-effect manual fallback.
  - [x] Informational panel during keep selection and selectable final spending plan.
  - [x] Automatic Strife ledger; remove manual applied-Strife selector.
  - [x] Phased `RollResolutionService` with explicit `preValidation` and complete message flags snapshot.
- [x] Stage 3 — actions, turns and conditions
  - [x] Structural Combatant turn state, action reservations/commit/cancel and Water action rules.
  - [x] Central `ConditionService`, suspended-condition lifecycle and required end-action/end-turn/end-scene rules.
  - [x] Public state-change hooks.
- [x] Stage 4 — damage, defense, critical strikes and item qualities
  - [x] `DamageService` ordering, resistance, defense choice, minion outcomes and authoritative decisions.
  - [x] Atomic `ItemQualityService` and Razor-Edged/Durable/Damaged/Destroyed behavior.
  - [x] Structured weapon grips and technique activation metadata with migration/sheets.
  - [x] Complete `CriticalService`, mitigation, Shattering Parry-before-commit, table, scars and repeated injury.
- [x] Stage 5 — GM replay tools and transactions
  - [x] Versioned, idempotent `ResolutionTransactionService` with compare-before-rollback/replay conflict detection.
  - [x] GM chat context tools for TN, target, Opportunity reopening and history.
  - [x] Single-active-GM `GmAuthorityService` request/response handling.
- [x] Stage 6 — tactical grid movement
  - [x] Public Foundry VTT 14 path planning/measuring with costs, blockers, budget and gridless fallback.
  - [x] Free movement, Maneuver/Water/technique budgets and condition integration.
  - [x] Recorded movement IDs, anchor, safe undo and public reachable-space data.
- [x] Stage 7 — NPC initiative
  - [x] PC picker, authoritative secret adversary roll and no-roll minion score.
  - [x] Ring policy, legal keep optimizer, effective Fire bonuses and native opportunities.
  - [x] Stable full tie-break and initiative groups.
- [x] Stage 8 — HUD compatibility
  - [x] Stable `game.l5r5e` actions/turns/opportunities/damage/critical/movement/rangeBands/initiative APIs.
  - [x] Hook-driven HUD state and documented legacy mapping without HUD namespace writes.
- [x] Stage 9 — tests, migrations and documentation
  - [x] `node:test` coverage for the required rule, movement, transaction, authority, initiative and migration matrix.
  - [x] `npm test`, lint/syntax scripts and checks for changed JavaScript.
  - [x] `docs/core-automation.md`, `docs/opportunity-schema.md`, `docs/hud-api.md`, `docs/manual-foundry-v14-tests.md`.
  - [x] English/Polish localization key parity and compendium data corrections.

## Session hand-off

All implementation stages are integrated. Automated checks cover the pure rule, transaction, movement, initiative, migration and localization layers. The remaining verification is the documented multi-client Foundry VTT 14 smoke matrix, which requires a running Foundry world and cannot be reproduced by the Node test harness.
