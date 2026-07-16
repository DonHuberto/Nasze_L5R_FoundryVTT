# Opportunity Item schema

The native `opportunity` Item and `l5r5e.core-opportunities` pack are the structural source of truth. The legacy Opportunity Journal remains player reference only and is never parsed at runtime.

Every entry requires a stable, untranslated `system.rulesKey`, Ring, contexts, cost, timing, target, effect and automation level. The ApplicationV2 sheet validates JSON fields before update.

```json
{
  "rulesKey": "conflict-void-ignore-condition",
  "description": "Ignore one suffered condition until the end of the next turn.",
  "sourceReference": { "source": "Core Rulebook", "page": 328 },
  "ring": "void",
  "contexts": {
    "conflictTypes": ["conflict", "skirmish"],
    "checkKinds": [],
    "actionTypes": [],
    "skillGroups": [],
    "skillIds": [],
    "techniqueTypes": [],
    "itemTypes": [],
    "initiative": null
  },
  "cost": { "base": 2, "increment": 1, "scalable": false, "maxSpend": null },
  "requirements": { "conditionChoice": true },
  "timing": "preValidation",
  "target": { "mode": "none", "filters": {} },
  "effect": { "type": "ignore-condition", "params": {} },
  "duration": { "until": "endNextTurn" },
  "automation": "confirm"
}
```

Empty context arrays mean unrestricted. Non-empty arrays are ANDed between categories and ORed within a category. The roll Ring must match the entry Ring or `any`. Earth stance removes Attack/Scheme Opportunity effects that would inflict a critical strike or condition on that target.

Costs are integers of at least 1. A non-scalable effect may be selected once. A scalable effect is also one instance, but accepts spend from `base` in `increment` steps up to `maxSpend` or the roll budget. Duplicate keys and overspend block finalization.

Supported timings are `preValidation`, `strife`, `beforeSuccess`, `afterSuccess`, `beforeDamage`, `afterDamage`, `deferred` and `manual`.

Whitelisted executor types include:

- `resource`, `remove-check-strife`, `remove-strife`;
- `condition`, `ignore-condition`;
- `tn-modifier`, `resistance-modifier`, `critical-modifier`;
- `movement`, `range`, `ignore-terrain`, `target`, `reserve-die`, `critical`;
- `manual`.

Executors return structured effects; they never evaluate pack JavaScript. An unknown `effect.type` is displayed, spends its cost and is recorded as manual without failing the roll. Add a new executor with `game.l5r5e.opportunities.registerExecutor(type, function)` in trusted system code, add English/Polish labels, tests for filtering/budget/timing, and a manual Foundry scenario.

Stable pack IDs and `rulesKey` make the seed idempotent. Never use a translated document name to select a rule.
