# Core automation architecture

The automation backend is a set of small services constructed once during `init` and exposed through `game.l5r5e`. Services accept Foundry Documents or plain DTOs; their rule calculations do not depend on rendered HTML.

## Roll resolution

`RollResolutionService.resolve()` is the canonical path for skill, initiative and attack resolution. Its audit follows these named phases:

1. normalize the roll context;
2. collect kept/exploding dice;
3. calculate raw symbols;
4. load and filter Opportunity Items;
5. validate the spending plan and budget;
6. execute `preValidation`, including temporary condition suspension;
7. validate the action and kept dice;
8. build the Strife ledger;
9. execute the remaining Opportunity timings;
10. determine success and effective bonus successes;
11. resolve action, damage and critical effects;
12. commit a versioned transaction and write an audit snapshot.

Explosive Success, Strife, Opportunity and Success retain their rulebook order. `preValidation` is an explicit fork extension before final legality; it does not reorder ordinary Opportunity effects. Fire adds kept Strife as bonus successes only when raw successes already meet TN. An actual check always has final TN 1 or higher.

The resolution snapshot is stored both in the serialized roll and `flags.l5r5e.resolution` on its ChatMessage. It includes context UUIDs, dice, TN, raw/effective results, the Strife ledger, Opportunity choices/effects, transaction ID, revision and phase audit.

## Services

- `ActionService` normalizes structural action metadata, assesses legality, and reserves/commits/cancels actions. A completed checked action and its unambiguous after-action effects are included in the same transaction as the roll.
- `TurnStateService` owns per-turn state in `Combatant.flags.l5r5e.turnState`; opening a dialog does not consume a slot.
- `ConditionService` is the only condition activity/suspension, TN, threshold and lifecycle rules source.
- `OpportunityRepository` loads the native `l5r5e.core-opportunities` Item pack; bundled definitions are a safe fallback.
- `OpportunityService` filters definitions, enforces one effect instance and budget, and dispatches whitelisted executors. Unknown executor types become manual audit entries.
- `DamageService` resolves increases, reductions, resistance, defense, Fatigue, critical redirection and minion defeat in that order.
- `ItemQualityService` recognizes stable rule IDs and performs Durable/Damaged/Destroyed transitions atomically.
- `CriticalService` prepares TN 1 Fitness mitigation, delegates the roll to the target owner, branches Shattering Parry before effects, clamps severity, maps the complete result table, creates tagged compendium scars and handles repeated injury.
- `MovementService` uses V14 `planMovement`, `measureMovementPath`, movement IDs/history and `revertRecordedMovement`; gridless scenes opt out.
- `InitiativeService` provides Prepared booleans, adversary secret rolling/keep policy, minion base scores, stable ties and structural groups.
- `ResolutionTransactionService` coalesces same-path deltas, applies compare-before-write mutations, snapshots created embedded documents, and provides idempotent rollback/revision replay.
- `GmAuthorityService` elects the active GM with the lexicographically first user ID; the socket layer deduplicates requests by ID.

## Turn state

The structural state has primary action, free movement, Water extra action, used action types, movement budget/IDs/anchor/undo, Wait, Guard and reservations. A Water action must require no check and share no action type with an already committed action. Movement undo restores the route budget but never refunds the action or Maneuver check.

Public change hooks are:

- `l5r5e.turnStateChanged(combatant, state, diff)`;
- `l5r5e.actionResolved(resolution)`;
- `l5r5e.movementBudgetChanged(combatant, movementState)`;
- `l5r5e.rollResolutionChanged(message, resolution)`.

## Authority and transactions

Mutations record `{documentUuid, path, before, after, reason}`. Apply accepts either the expected `before` value or an already-applied `after` value. Revert requires every current value (and each created scar snapshot) to equal the previous committed value; otherwise it returns a conflict without overwriting later world changes. Replays inspect first, revert related critical transactions, recalculate against the restored documents, then apply the next revision. A failed replay restores the prior revision. Previous revisions remain in history.

The GM ChatMessage context menu can change TN, assign/change the currently targeted token, reopen Opportunity resolution and show the immutable resolution history. Replays update the message instead of deleting history.

## Data migration

Automation schema version 1 is independent of the release manifest version. It normalizes Prepared to boolean, adds stable rules keys, creates structured weapon grip/damage-type and technique activation fields, initializes or fills Combatant turn state/tie keys, and preserves old grip text for display. It covers world Actors and embedded Items, world Items, synthetic token actors, active Combats and world Actor/Item/Scene compendia. Bundled system packs are normalized deterministically at build time. The migration is run once by the authoritative active GM.

## Deliberate manual boundaries

Narrative or judgment-dependent Opportunity entries are recorded as spent manual effects. Unknown executor types also fall back safely to manual resolution. Tactical movement is disabled on gridless scenes. Walls and impassable Regions remain Foundry pathfinding concerns; if Region side effects make movement history non-reversible, undo stops with a GM-facing warning instead of trying to reverse those effects.
