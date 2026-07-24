# HUD backend API

The HUD should be a frontend over `game.l5r5e`; it must not maintain a second action/movement truth or spend a resource when merely opening a dialog.

## Legacy mapping

| Old HUD field/action | Core source |
| --- | --- |
| `actionUsed` | `game.l5r5e.turns.getters(state).isActionUsed` / `primaryAction.used` |
| `movementUsed` | `isFreeMovementUsed` / `freeMovement.used` |
| `waterActionUsed` | `isWaterActionUsed` / `waterExtraAction.used` |
| strike/technique local resolution | `game.l5r5e.rollResolution.resolve(...)` |
| `maneuver` boolean | `game.l5r5e.movement.maneuverBudget(...)` plus Combatant movement state |
| local condition/TN guesses | `game.l5r5e.actions.assess(context)` |

## Public objects

- `game.l5r5e.actions`: `normalizeContext`, `assess`, `reserve`, `commit`, `cancel`.
- `game.l5r5e.turns`: `getState`, `getters`, state mutation helpers and `persist`.
- `game.l5r5e.opportunities`: `available`, `validatePlan`, `executeTiming`, `registerExecutor`.
- `game.l5r5e.damage`: damage and Bleeding resolution DTOs.
- `game.l5r5e.critical`: preparation, mitigation/outcome and repeated-scar DTOs.
- `game.l5r5e.equipment`: `heldItems`, `getAttackProfiles`, `prepare`, `changeGrip`, `changeLoadout`, `drop`, `throw`, `pickup`, `confirm`, `reserve`, `commit`, `cancel`, `completeThrow`.
- `game.l5r5e.movement`: `remaining`, `maneuverBudget`, `techniqueBudget`, `startFreeMovement`, `startManeuver`, `cancelManeuver`, `executeManeuver`, `startTechniqueMovement`, `plan`, `measure`, `execute`, `undoMovement`, `reachableFields`.
- `game.l5r5e.rangeBands`: `fieldsPerBand`, `toBudget`, `fromCost`.
- `game.l5r5e.initiative`: Prepared/base/score/ring/optimizer/tie/group helpers.
- `game.l5r5e.lateArrivals`: `getFlag`, `canCreate`, `ruleFor`, `resolveEligible`; hook handlers persist and resolve late-join state without replacing Foundry's native `Combatant#roundJoined`.
- `game.l5r5e.rollResolution`: `preview` and canonical `resolve`.
- `game.l5r5e.transactions`: create/apply/revert/replay/history.
- `game.l5r5e.authority` and `game.l5r5e.sockets.requestAuthority`: single-GM mutations.

HUD buttons may call `actions.reserveAndPersist` when the user confirms an action and before its roll begins. Merely previewing/opening a picker must not consume a slot. Cancel calls `actions.cancel`; a completed custom no-check action calls `actions.commit`. Core checked rolls prepare the action commit together with roll mutations. A Water slot is never consumed by a checked action and is rejected when its action type overlaps an earlier action.

For movement, call `movement.plan(token, {maxCost: movement.remaining(combatant)})`, then `movement.execute`. The service uses V14 `preventDrop`; public movement hooks cover ordinary dragging and keyboard movement. Use `reachableFields` only for visualization. Call `undoMovement` only when the getter reports availability.

For equipment, assess through one of the operation methods, collect any required hand-release decisions, then call `confirm`, `reserve` and `commit`. A weapon-set change must use one `changeLoadout` intent. A checked throw transfers its reserved intent ID in `rollContext.equipmentIntentId`; Roll & Keep calls `completeThrow` only after resolving a legal landing field.

Subscribe to `l5r5e.turnStateChanged`, `l5r5e.actionResolved`, `l5r5e.movementBudgetChanged` and `l5r5e.rollResolutionChanged`; polling and writes to the HUD module namespace are unnecessary.

The dock may call the public `Combat#rollInitiative` and inherited `Combat#rollNPC` entry points. Pass L5R-specific roll overrides through `messageOptions`, for example `{skillId: "tactics", difficulty: 2, difficultyHidden: true}`.
