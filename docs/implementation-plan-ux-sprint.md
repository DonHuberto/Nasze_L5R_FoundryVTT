# L5R5e UX integration sprint

This document is the cross-repository implementation checklist for the Foundry VTT 14 UX integration sprint. It is updated as each stage is implemented and verified. Release `1.14.104` was prepared only after the explicit follow-up publishing request.

## Baseline audit

| Repository | Branch / commit | Manifest baseline | License | Initial status |
|---|---|---|---|---|
| `Nasze_L5R_FoundryVTT` | `master` / `3203944f2b77c71e8110b38f34e3cd86245834f6` | system `1.14.103`, Foundry 14 | mixed CC BY-NC-SA 4.0 / MIT notices in `LICENSE.md` | clean; 46 tests passing |
| `enhancedcombathud-l5r5e` | `main` / `b6ab1f7400cf9022679bab7ac76c84fad45d6060` | module `2.0.0`, Foundry 14 | repository has no standalone license file; do not import third-party source/assets | clean; 14 tests passing |
| `l5r5e-combat-tracker-dock` | `main` / `9cde743a5a40178dde0bbcec7d51f57686c1f8aa` | module `0.1.1`, Foundry 14 | MIT | clean; 26 tests passing |
| Argon reference | tag `5.0.1` / `65f6d65ef7e410223307f65c65db686f9be565a6` | release tag `5.0.1`; source manifest incorrectly says `3.1.0` | GPL-3.0; API reference only | detached, clean |
| Aedif's Tactical Grid reference | tag `2.6.3` / `b085b5565de09ba7a3ce98fddc6be021f9c82a73` | module `2.6.3`, Foundry 14.363 verified | GPL-3.0; public API only | detached, clean |

No installed Argon/Tactical Grid manifests were found under the local user profile. Compatibility therefore targets the verified release tags and is enforced again at runtime by method checks.

## Integration invariants

- Core is the only rules and mutable-state authority.
- HUD and dock call documented core APIs and fail closed when required APIs are absent.
- Tactical Grid remains optional and is accessed only through `globalThis.TacticalGrid` public methods.
- Document mutations use the active-GM authority path and idempotent transactions.
- RAW thrown profiles and Soaring Slice remain distinct from the opt-in improvised Throw Item house rule.
- Range-band classification is independent from movement cost.
- Cancelling UI never commits an action, equipment mutation, or roll result.

## Stage checklist

- [x] 1. Core initiative message-mode normalization and atomic adversary initiative.
- [x] 2. Core stable `actionId`, Strike critical opportunity, and separate Opportunity windows.
- [x] 3. Core equipment/hands/unarmed/ground-item transaction API.
- [x] 4. Core thrown profile, Soaring Slice metadata/workflow, and opt-in improvised throw.
- [x] 5. Core movement path costs and public Range Band API.
- [x] 6. Core tests and `docs/hud-api.md`.
- [x] 7. HUD core-state integration, action registry, NPC support, equipment/throw/Tactical Grid.
- [x] 8. HUD responsive L5R theme and interaction layout.
- [x] 9. Dock visibility controller and Scene Controls toggle.
- [x] 10. Cross-repository CI, diff checks, and manual Foundry 14 smoke-test instructions.

## Public integration points

| Producer | API / hook | Consumers |
|---|---|---|
| core | message-mode normalizer; roll context `actionId`; attack-profile snapshots | native rolls, HUD |
| core | `game.l5r5e.actions`, `turns`, `movement`, `equipment`, `rangeBands`, `rollResolution`, `conditions`, `authority` | HUD, dock where applicable |
| core | `l5r5e.turnStateChanged`, `l5r5e.actionResolved`, `l5r5e.movementBudgetChanged`, `l5r5e.rollResolutionChanged` | HUD and dock re-rendering |
| HUD | explicit Tactical Grid ranges and overlay cleanup | optional `globalThis.TacticalGrid` |
| dock | `ui.l5r5eCombatDock` visibility controller | Scene Controls, lifecycle hooks, keybinding |

## Verification log

- Baseline: core `npm test` passed (46/46).
- Baseline: HUD `npm test` passed (14/14).
- Baseline: dock `npm test` passed (26/26).
- Stage 1: core `npm test` passed (50/50); `npm run syntax` and `npm run lint` passed.
- Stages 2–4: core `npm run ci` passed (61/61 tests plus data build, syntax, lint and SCSS compilation).
- Final release audit: core `npm run ci` passed (83/83), HUD (21/21), dock (33/33) and Tactical Grid (4/4).
- Browser-backed Foundry smoke testing remained unavailable because no browser window was exposed; `docs/manual-foundry-v14-tests.md` and the HUD smoke checklist retain the required live checks.
