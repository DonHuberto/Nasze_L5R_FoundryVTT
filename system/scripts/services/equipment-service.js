import { deepClone, makeId, stableHash, toFiniteNumber } from "./rule-utils.js";

export const GROUND_ITEM_SCHEMA_VERSION = 1;

export const UNARMED_PROFILES = Object.freeze({
    punch: Object.freeze({ id: "unarmed-punch", rulesKey: "unarmed-punch", labelKey: "l5r5e.automation.equipment.unarmed.punch", virtual: true, grip: "unarmed", skillId: "unarmed", hands: 1, damage: 1, deadliness: 2, damageType: "physical", range: Object.freeze({ minimum: 0, maximum: 0 }) }),
    kick: Object.freeze({ id: "unarmed-kick", rulesKey: "unarmed-kick", labelKey: "l5r5e.automation.equipment.unarmed.kick", virtual: true, grip: "unarmed", skillId: "unarmed", hands: 0, damage: 2, deadliness: 1, damageType: "physical", range: Object.freeze({ minimum: 0, maximum: 0 }) }),
    bite: Object.freeze({ id: "unarmed-bite", rulesKey: "unarmed-bite", labelKey: "l5r5e.automation.equipment.unarmed.bite", virtual: true, grip: "unarmed", skillId: "unarmed", hands: 0, damage: 0, deadliness: 3, damageType: "physical", range: Object.freeze({ minimum: 0, maximum: 0 }) }),
});

function readPath(object, path) {
    return String(path).split(".").reduce((value, key) => value?.[key], object);
}

function plain(value, key = "") {
    if (["command", "script", "macro"].includes(String(key).toLowerCase())) return undefined;
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
    if (Array.isArray(value)) return value.map((entry) => plain(entry)).filter((entry) => entry !== undefined);
    if (!value || typeof value !== "object") return undefined;
    const output = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
        const sanitized = plain(entryValue, entryKey);
        if (sanitized !== undefined) output[entryKey] = sanitized;
    }
    return output;
}

export function sanitizeItemSnapshot(item) {
    const source = item?.toObject?.() ?? item ?? {};
    const snapshot = plain({
        _id: source._id ?? item?.id,
        name: source.name ?? item?.name ?? "Item",
        type: source.type ?? item?.type ?? "item",
        img: source.img ?? item?.img ?? "icons/svg/item-bag.svg",
        system: source.system ?? source.data ?? item?.system ?? {},
    });
    snapshot.system ??= {};
    snapshot.system.equipped = false;
    if (snapshot.type === "weapon") snapshot.system.readied = false;
    snapshot.system.quantity = 1;
    return snapshot;
}

export function handsRequired(profile = {}) {
    if (Number.isFinite(Number(profile.hands))) return Math.max(0, Number(profile.hands));
    return profile.grip === "two-handed" ? 2 : 1;
}

function fieldKey(field) {
    return `${field?.x ?? field?.i}:${field?.y ?? field?.j}:${field?.elevation ?? 0}`;
}

export function deterministicLandingField({ hit = false, targetField = null, pathFields = [], legalFields = [], originField = null, transactionId = "throw" } = {}) {
    if (hit && targetField) return { field: deepClone(targetField), fallback: false };
    const originKey = fieldKey(originField);
    const legal = new Set(legalFields.map(fieldKey));
    const candidates = pathFields.filter((field) => fieldKey(field) !== originKey && (!legal.size || legal.has(fieldKey(field))));
    const fallbackPool = legalFields.filter((field) => fieldKey(field) !== originKey);
    const target = targetField ?? originField ?? { x: 0, y: 0 };
    const distance = (field) => ((Number(field.x) || 0) - (Number(target.x) || 0)) ** 2 + ((Number(field.y) || 0) - (Number(target.y) || 0)) ** 2;
    const nearestDistance = fallbackPool.length ? Math.min(...fallbackPool.map(distance)) : Infinity;
    const nearestFallbacks = fallbackPool.filter((field) => distance(field) === nearestDistance);
    const pool = candidates.length ? candidates : nearestFallbacks;
    if (!pool.length) return { field: targetField ? deepClone(targetField) : null, fallback: true };
    const index = Number.parseInt(stableHash(`${transactionId}:${pool.map(fieldKey).join("|")}`), 36) % pool.length;
    return { field: deepClone(pool[index]), fallback: !candidates.length };
}

export class EquipmentService {
    constructor({ qualityService = null, transactionService = null, actionService = null, settings = null, resolver = null, sceneProvider = null } = {}) {
        this.qualities = qualityService;
        this.transactions = transactionService;
        this.actions = actionService;
        this.settings = settings ?? ((key, fallback) => {
            try { return globalThis.game?.settings?.get?.("l5r5e", key) ?? fallback; } catch (_error) { return fallback; }
        });
        this.resolver = resolver ?? ((uuid) => globalThis.fromUuid?.(uuid));
        this.sceneProvider = sceneProvider ?? (() => globalThis.canvas?.scene ?? globalThis.game?.scenes?.current ?? null);
        this.reservations = new Map();
        this.results = new Map();
    }

    bodyState(actor) {
        const body = actor?.flags?.l5r5e?.body ?? {};
        const statuses = new Set([...(actor?.statuses ?? [])].map((status) => String(status).toLowerCase()));
        const lostHands = Math.max(0, toFiniteNumber(body.lostHands, 0) + toFiniteNumber(body.lostArms, 0));
        const boundHands = Math.max(0, toFiniteNumber(body.boundHands, statuses.has("bound-arms") ? 2 : 0));
        return {
            availableHands: Math.max(0, 2 - lostHands - boundHands),
            canPunch: Math.max(0, 2 - lostHands - boundHands) > 0,
            canKick: !body.boundLegs && !statuses.has("bound-legs"),
            canBite: !body.unableToBite,
        };
    }

    isHeld(item) {
        if (!item || item.type === "armor") return false;
        if (item.type === "weapon") return Boolean(item.system?.equipped && item.system?.readied);
        return Boolean(item.flags?.l5r5e?.held ?? item.system?.readied ?? item.system?.equipped);
    }

    heldItems(actor, { excludeUuid = null } = {}) {
        return [...(actor?.items ?? [])].filter((item) => item.uuid !== excludeUuid && this.isHeld(item));
    }

    getUnarmedProfiles(actor) {
        const body = this.bodyState(actor);
        return Object.entries(UNARMED_PROFILES).map(([key, profile]) => ({
            ...deepClone(profile),
            actorUuid: actor?.uuid ?? null,
            available: key === "punch" ? body.canPunch : key === "kick" ? body.canKick : body.canBite,
        }));
    }

    getAttackProfiles(actor) {
        const weapons = [...(actor?.items ?? [])]
            .filter((item) => item.type === "weapon" && item.system?.equipped && item.system?.readied)
            .map((item) => ({ ...deepClone(item.attackProfile), source: "weapon", itemUuid: item.uuid, available: item.attackProfile?.usable !== false }));
        return [...weapons, ...this.getUnarmedProfiles(actor)];
    }

    assessHands(actor, intent = {}) {
        const profile = intent.profile ?? intent.item?.attackProfile ?? null;
        const required = intent.ready === false ? 0 : handsRequired(profile ?? { grip: intent.grip });
        const held = this.heldItems(actor, { excludeUuid: intent.item?.uuid ?? intent.itemUuid });
        const used = held.reduce((sum, item) => sum + handsRequired(item.attackProfile ?? { grip: item.system?.active_grip }), 0);
        const available = this.bodyState(actor).availableHands;
        const free = Math.max(0, available - used);
        return {
            ok: required <= free,
            required,
            used,
            available,
            free,
            deficit: Math.max(0, required - free),
            heldItems: held.map((item) => ({ itemUuid: item.uuid, name: item.name, hands: handsRequired(item.attackProfile ?? { grip: item.system?.active_grip }), canStow: true, canDrop: true })),
        };
    }

    prepare(actor, item, options = {}) {
        const ready = options.ready ?? (item?.type === "armor" ? !item?.system?.equipped : !item?.system?.readied);
        const profile = item?.attackProfile;
        const handAssessment = ready && item?.type === "weapon" ? this.assessHands(actor, { item, profile, ready }) : { ok: true, required: 0, deficit: 0, heldItems: [] };
        const armorBlocked = item?.type === "armor" && Boolean(globalThis.game?.combat?.started) && !this.settings("allowArmorSwapInConflict", false) && !options.gmOverride;
        const concealableAttack = Boolean(options.withinAttack && this.qualities?.has?.(item, "concealable"));
        return this.#intent("prepare", actor, item, {
            options: { ready, withinAttack: Boolean(options.withinAttack), gmOverride: Boolean(options.gmOverride) },
            assessment: { ok: handAssessment.ok && !armorBlocked, hands: handAssessment, armorBlocked, code: armorBlocked ? "armorSwapBlocked" : handAssessment.ok ? null : "occupiedHands" },
            requiresAction: Boolean(globalThis.game?.combat?.started && !concealableAttack),
        });
    }

    changeGrip(actor, weapon, grip, options = {}) {
        const profile = weapon?.system?.grip_profiles?.[grip];
        const hands = this.assessHands(actor, { item: weapon, profile: { ...profile, grip, hands: profile?.hands }, ready: weapon?.system?.readied });
        return this.#intent("changeGrip", actor, weapon, {
            options: { grip, gmOverride: Boolean(options.gmOverride) },
            assessment: { ok: Boolean(profile) && hands.ok, hands, code: !profile ? "gripMissing" : hands.ok ? null : "occupiedHands" },
            requiresAction: Boolean(globalThis.game?.combat?.started && weapon?.system?.readied && !options.freeGripChange),
        });
    }

    changeLoadout(actor, weapons = [], options = {}) {
        const actorWeapons = [...(actor?.items ?? [])].filter((item) => item.type === "weapon");
        const actorWeaponUuids = new Set(actorWeapons.map((item) => item.uuid));
        const itemUuids = [...new Set(weapons.map((item) => typeof item === "string" ? item : item?.uuid).filter((uuid) => actorWeaponUuids.has(uuid)))];
        const selected = actorWeapons.filter((item) => itemUuids.includes(item.uuid));
        const required = selected.reduce((sum, item) => sum + handsRequired(item.attackProfile ?? { grip: item.system?.active_grip }), 0);
        const available = this.bodyState(actor).availableHands;
        const hands = {
            ok: required <= available,
            required,
            used: required,
            available,
            free: Math.max(0, available - required),
            deficit: Math.max(0, required - available),
            heldItems: [],
        };
        return this.#intent("changeLoadout", actor, null, {
            options: { itemUuids, gmOverride: Boolean(options.gmOverride) },
            assessment: {
                ok: hands.ok,
                hands,
                code: hands.ok ? null : "loadoutHandsExceeded",
            },
            requiresAction: Boolean(globalThis.game?.combat?.started && !options.freeLoadoutChange),
        });
    }

    drop(actor, item, options = {}) {
        return this.#intent("drop", actor, item, {
            options: { placement: deepClone(options.placement ?? this.#actorPlacement(actor)), quantity: 1, state: options.state ?? "ground" },
            assessment: { ok: this.isHeld(item) || Boolean(options.gmOverride), code: this.isHeld(item) || options.gmOverride ? null : "itemNotHeld" },
            requiresAction: false,
        });
    }

    throw(actor, item, options = {}) {
        const activeProfile = item?.attackProfile;
        const requestedMode = options.mode;
        const mode = requestedMode ?? (activeProfile?.grip === "thrown" ? "thrown-profile" : options.actionId === "soaring-slice" ? "soaring-slice" : "improvised");
        const improvisedEnabled = Boolean(this.settings("enableImprovisedThrowAction", true));
        const profile = mode === "improvised" ? this.improvisedThrowProfile() : mode === "soaring-slice"
            ? { ...deepClone(activeProfile), skillId: activeProfile?.skillId ?? item?.system?.skill, range: { minimum: 2, maximum: 3 } }
            : deepClone(activeProfile);
        const actionId = mode === "thrown-profile" ? "strike" : mode === "soaring-slice" ? "soaring-slice" : "improvised-throw";
        const validMode = mode === "thrown-profile" ? activeProfile?.grip === "thrown" : mode === "soaring-slice" ? activeProfile?.grip === "one-handed" : improvisedEnabled;
        const tracked = mode !== "thrown-profile" || Boolean(options.trackIndividual);
        const intent = this.#intent("throw", actor, item, {
            options: { mode, actionId, tracked, placement: deepClone(options.placement), state: options.state ?? "ground" },
            assessment: {
                ok: this.isHeld(item) && Boolean(validMode && profile),
                code: !this.isHeld(item) ? "itemNotHeld" : !validMode ? mode === "improvised" ? "houseRuleDisabled" : "invalidThrowMode" : !profile ? "profileMissing" : null,
                profile,
                roll: { actionId, actionTypes: ["attack"], skillId: profile?.skillId, difficulty: mode === "improvised" ? this.settings("improvisedThrowTn", 2) : 2, range: profile?.range, houseRule: mode === "improvised", tracked },
            },
            requiresAction: false,
        });
        intent.assessment.roll.rollContext = {
            actionId,
            actionTypes: ["attack"],
            attackProfileSnapshot: deepClone(profile),
            equipmentIntentId: intent.intentId,
            throwMode: mode,
        };
        return intent;
    }

    pickup(actor, groundDocument, options = {}) {
        const data = this.groundItemData(groundDocument);
        return this.#intent("pickup", actor, null, {
            groundDocument,
            options: { groundDocumentUuid: groundDocument?.uuid, gmOverride: Boolean(options.gmOverride) },
            assessment: { ok: Boolean(data && data.state === "ground"), code: data ? data.state === "ground" ? null : "groundItemUnavailable" : "groundItemInvalid", groundItem: data },
            requiresAction: false,
        });
    }

    improvisedThrowProfile() {
        return {
            id: "improvised-throw",
            rulesKey: "improvised-throw",
            skillId: this.settings("improvisedThrowSkill", "ranged"),
            damage: Math.max(0, toFiniteNumber(this.settings("improvisedThrowDamage", 1), 1)),
            deadliness: Math.max(0, toFiniteNumber(this.settings("improvisedThrowDeadliness", 1), 1)),
            damageType: this.settings("improvisedThrowDamageType", "physical") === "supernatural" ? "supernatural" : "physical",
            range: { minimum: Math.max(0, toFiniteNumber(this.settings("improvisedThrowMinimumRange", 1), 1)), maximum: Math.max(0, toFiniteNumber(this.settings("improvisedThrowMaximumRange", 2), 2)) },
            grip: "held",
            hands: 0,
            houseRule: true,
        };
    }

    resolveThrowPlacement(intent, outcome = {}) {
        const mode = intent?.options?.mode;
        const legal = new Set((outcome.legalFields ?? []).map(fieldKey));
        const isLegal = (field) => Boolean(field) && (!legal.size || legal.has(fieldKey(field)));
        if (mode === "soaring-slice") {
            if (outcome.critical && isLegal(outcome.targetField)) {
                return { ok: true, placement: deepClone(outcome.targetField), state: "embedded", targetUuid: outcome.targetUuid ?? null, audit: { rule: "soaring-slice-critical", fallback: false } };
            }
            if (outcome.success && outcome.defended) {
                if (!isLegal(outcome.chosenField) || outcome.chosenFieldRangeFromTarget !== 1) return { ok: false, code: "directionFieldRequired" };
                return { ok: true, placement: deepClone(outcome.chosenField), state: "ground", targetUuid: null, audit: { rule: "soaring-slice-defended", fallback: false } };
            }
            if (!outcome.success) {
                const originKey = fieldKey(outcome.originField);
                const path = (outcome.pathFields ?? []).filter((field) => fieldKey(field) !== originKey && isLegal(field));
                const fallback = (outcome.legalFields ?? []).filter((field) => fieldKey(field) !== originKey);
                const placement = path.at(-1) ?? fallback.at(-1) ?? null;
                return placement
                    ? { ok: true, placement: deepClone(placement), state: "ground", targetUuid: null, audit: { rule: "soaring-slice-failure", fallback: !path.length } }
                    : { ok: false, code: "landingFieldMissing" };
            }
            return { ok: false, code: "soaringSliceOutcomeMissing" };
        }
        const landing = deterministicLandingField({
            hit: Boolean(outcome.success),
            targetField: outcome.targetField,
            pathFields: outcome.pathFields,
            legalFields: outcome.legalFields,
            originField: outcome.originField,
            transactionId: intent?.intentId,
        });
        return landing.field
            ? { ok: true, placement: landing.field, state: "ground", targetUuid: null, audit: { rule: mode === "improvised" ? "improvised-throw" : "tracked-thrown-profile", fallback: landing.fallback } }
            : { ok: false, code: "landingFieldMissing" };
    }

    withThrowOutcome(intent, outcome = {}) {
        const landing = this.resolveThrowPlacement(intent, outcome);
        if (!landing.ok) return { ...deepClone(intent), ok: false, status: "blocked", code: landing.code };
        return {
            ...deepClone(intent),
            options: { ...deepClone(intent.options), placement: landing.placement, state: landing.state, embeddedTargetUuid: landing.targetUuid, landingAudit: landing.audit },
        };
    }

    async completeThrow(intentId, outcome = {}) {
        const reserved = this.reservations.get(intentId);
        if (!reserved || reserved.operation !== "throw" || reserved.status !== "reserved") {
            return { ok: false, status: "blocked", code: "intentState", intentId };
        }
        const completed = this.withThrowOutcome(reserved, outcome);
        if (!completed.ok) return completed;
        this.reservations.set(intentId, deepClone(completed));
        return this.commit(completed);
    }

    groundItemData(document) {
        const data = document?.flags?.l5r5e?.groundItem;
        if (!data || toFiniteNumber(data.schemaVersion, 0) < 1 || !data.itemSnapshot) return null;
        return { ...deepClone(data), schemaVersion: GROUND_ITEM_SCHEMA_VERSION, itemSnapshot: sanitizeItemSnapshot(data.itemSnapshot) };
    }

    confirm(intent, decisions = {}) {
        if (!intent?.intentId || intent.status !== "assess") return { ...intent, ok: false, status: "blocked", code: "intentState" };
        if (!intent.assessment?.ok && intent.assessment?.code !== "occupiedHands") return { ...intent, ok: false, status: "blocked", code: intent.assessment?.code };
        const heldByUuid = new Map((intent.assessment?.hands?.heldItems ?? []).map((entry) => [entry.itemUuid, entry]));
        const releases = [...(decisions.releases ?? [])].map((decision) => ({ itemUuid: decision.itemUuid, mode: decision.mode === "drop" ? "drop" : "stow" }));
        if (intent.assessment?.code === "occupiedHands") {
            if (new Set(releases.map(({ itemUuid }) => itemUuid)).size !== releases.length || releases.some(({ itemUuid }) => !heldByUuid.has(itemUuid))) {
                return { ...intent, ok: false, status: "blocked", code: "occupiedHandsDecision" };
            }
            const releasedHands = releases.reduce((sum, decision) => sum + toFiniteNumber(heldByUuid.get(decision.itemUuid)?.hands, 0), 0);
            if (releasedHands < intent.assessment.hands.deficit) return { ...intent, ok: false, status: "blocked", code: "occupiedHandsDecision" };
        }
        return { ...deepClone(intent), ok: true, status: "confirmed", decisions: { ...deepClone(decisions), releases } };
    }

    async reserve(intent) {
        if (!intent?.ok || intent.status !== "confirmed") return { ...intent, ok: false, status: "blocked", code: "intentState" };
        const reserved = { ...deepClone(intent), status: "reserved" };
        if (intent.requiresAction && this.actions && globalThis.game?.combat?.started) {
            const combatant = globalThis.game.combat.combatants?.find?.((entry) => entry.actor?.uuid === intent.actorUuid);
            if (!combatant) return { ...reserved, ok: false, status: "blocked", code: "combatantMissing" };
            const lifecycle = { combatId: globalThis.game.combat.id, round: globalThis.game.combat.round, turn: globalThis.game.combat.turn };
            const action = await this.actions.reserveAndPersist(combatant, { actionId: "prepare_item", actionTypes: ["support"], requiresCheck: false, lifecycle });
            if (!action.ok) return { ...reserved, ok: false, status: "blocked", code: action.code };
            reserved.actionReservation = { combatantUuid: combatant.uuid, reservationId: action.reservationId, lifecycle };
        }
        this.reservations.set(reserved.intentId, deepClone(reserved));
        return reserved;
    }

    async cancel(intent) {
        const reserved = this.reservations.get(intent?.intentId) ?? intent;
        if (reserved?.actionReservation && this.actions) {
            const combatant = await this.resolver(reserved.actionReservation.combatantUuid);
            if (combatant) await this.actions.cancel(combatant, reserved.actionReservation.reservationId, reserved.actionReservation.lifecycle);
        }
        this.reservations.delete(intent?.intentId);
        return { ...deepClone(intent), ok: true, status: "cancelled" };
    }

    async commit(intent) {
        const reserved = this.reservations.get(intent?.intentId) ?? intent;
        if (!reserved?.intentId || reserved.status !== "reserved") return { ...deepClone(reserved), ok: false, status: "blocked", code: "intentState" };
        if (this.results.has(reserved.intentId)) return { ...deepClone(this.results.get(reserved.intentId)), idempotent: true };
        const useAuthority = !globalThis.game?.l5r5e?.authority?.isAuthority?.() && Boolean(globalThis.game?.l5r5e?.authority?.authorityUser?.());
        const result = useAuthority
            ? await globalThis.game.l5r5e.sockets.requestAuthority("equipmentCommit", { intent: reserved })
            : await this.execute(reserved);
        if (result?.ok) {
            this.results.set(reserved.intentId, deepClone(result));
            this.reservations.delete(reserved.intentId);
        }
        return result;
    }

    async execute(intent) {
        if (!intent?.intentId || intent.status !== "reserved" || !intent.ok) return { ok: false, status: "blocked", code: "intentState", intentId: intent?.intentId };
        if (this.results.has(intent.intentId)) return { ...deepClone(this.results.get(intent.intentId)), idempotent: true };
        const actor = await this.resolver(intent.actorUuid);
        if (!actor) return { ok: false, status: "blocked", code: "actorMissing", intentId: intent.intentId };
        const item = intent.itemUuid ? await this.resolver(intent.itemUuid) : null;
        if (item && item.parent?.uuid && item.parent.uuid !== actor.uuid) return { ok: false, status: "blocked", code: "itemOwnershipMismatch", intentId: intent.intentId };
        if (["drop", "throw"].includes(intent.operation) && item && !this.isHeld(item)) return { ok: false, status: "blocked", code: "itemNotHeld", intentId: intent.intentId };
        let result;
        if (intent.operation === "drop" || (intent.operation === "throw" && intent.options.tracked)) result = await this.#placeGroundItem(actor, item, intent);
        else if (intent.operation === "throw") result = { ok: true, status: "committed", intentId: intent.intentId, tracked: false };
        else if (intent.operation === "pickup") result = await this.#pickupGroundItem(actor, await this.resolver(intent.options.groundDocumentUuid), intent);
        else result = await this.#commitSimple(actor, item, intent);
        if (result.ok) this.results.set(intent.intentId, deepClone(result));
        return result;
    }

    #intent(operation, actor, item, { options = {}, assessment = {}, requiresAction = false, groundDocument = null } = {}) {
        const intentId = options.transactionId ?? makeId(`equipment-${operation}`);
        return {
            schemaVersion: 1,
            intentId,
            operation,
            status: "assess",
            ok: Boolean(assessment.ok),
            actorUuid: actor?.uuid ?? null,
            itemUuid: item?.uuid ?? null,
            groundDocumentUuid: groundDocument?.uuid ?? null,
            assessment: deepClone(assessment),
            options: { ...deepClone(options), transactionId: intentId },
            requiresAction,
        };
    }

    async #commitSimple(actor, item, intent) {
        if (!item && intent.operation !== "changeLoadout") {
            return { ok: false, status: "blocked", code: "itemMissing", intentId: intent.intentId };
        }
        const mutations = [];
        const releaseItems = [];
        for (const [index, release] of (intent.decisions?.releases ?? []).entries()) {
            const held = await this.resolver(release.itemUuid);
            if (!held) return { ok: false, status: "blocked", code: "releaseItemMissing", intentId: intent.intentId };
            if (held.parent?.uuid && held.parent.uuid !== actor.uuid) return { ok: false, status: "blocked", code: "itemOwnershipMismatch", intentId: intent.intentId };
            if (release.mode === "drop") releaseItems.push({ item: held, transactionId: `${intent.intentId}-release-${index}` });
            else mutations.push({ documentUuid: held.uuid, path: "system.readied", before: Boolean(held.system?.readied), after: false, reason: "equipmentRelease" });
        }
        if (intent.operation === "prepare") {
            const ready = Boolean(intent.options.ready);
            const equipped = item.type === "armor" ? ready : ready ? true : Boolean(item.system?.equipped);
            mutations.push({ documentUuid: item.uuid, path: "system.equipped", before: Boolean(item.system?.equipped), after: equipped, reason: "prepareItem" });
            if (item.type === "weapon") mutations.push({ documentUuid: item.uuid, path: "system.readied", before: Boolean(item.system?.readied), after: ready, reason: "prepareItem" });
        } else if (intent.operation === "changeGrip") {
            mutations.push({ documentUuid: item.uuid, path: "system.active_grip", before: item.system?.active_grip ?? "one-handed", after: intent.options.grip, reason: "changeGrip" });
        } else if (intent.operation === "changeLoadout") {
            const selected = new Set(intent.options.itemUuids ?? []);
            for (const weapon of [...(actor.items ?? [])].filter((entry) => entry.type === "weapon")) {
                const ready = selected.has(weapon.uuid);
                if (ready && !weapon.system?.equipped) {
                    mutations.push({ documentUuid: weapon.uuid, path: "system.equipped", before: false, after: true, reason: "changeLoadout" });
                }
                if (Boolean(weapon.system?.readied) !== ready) {
                    mutations.push({ documentUuid: weapon.uuid, path: "system.readied", before: Boolean(weapon.system?.readied), after: ready, reason: "changeLoadout" });
                }
            }
        }
        let preparedAction = null;
        if (intent.actionReservation && this.actions) {
            const combatant = await this.resolver(intent.actionReservation.combatantUuid);
            preparedAction = combatant ? this.actions.prepareCommit(combatant, intent.actionReservation.reservationId, { context: { lifecycle: intent.actionReservation.lifecycle } }) : { ok: false, code: "combatantMissing" };
            if (!preparedAction.ok) return { ok: false, status: "blocked", code: preparedAction.code, intentId: intent.intentId };
            mutations.push(...preparedAction.mutations);
        }
        const transaction = this.transactions?.create?.({ transactionId: intent.intentId, inputs: { equipmentIntent: intent }, mutations });
        const placed = [];
        for (const release of releaseItems) {
            const releaseIntent = {
                schemaVersion: 1,
                intentId: release.transactionId,
                operation: "drop",
                status: "reserved",
                ok: true,
                actorUuid: actor.uuid,
                itemUuid: release.item.uuid,
                assessment: { ok: true },
                options: { transactionId: release.transactionId, placement: this.#actorPlacement(actor), quantity: 1, state: "ground" },
                requiresAction: false,
            };
            const result = await this.#placeGroundItem(actor, release.item, releaseIntent);
            if (!result.ok) {
                await this.#rollbackPlaced(actor, placed);
                return { ...result, intentId: intent.intentId };
            }
            placed.push(result);
        }
        const applied = transaction ? await this.transactions.apply(transaction) : await this.#applyDirect(mutations);
        if (!applied.ok) {
            await this.#rollbackPlaced(actor, placed);
            return { ok: false, status: "conflict", code: applied.code, intentId: intent.intentId };
        }
        if (preparedAction && this.actions) {
            const combatant = await this.resolver(intent.actionReservation.combatantUuid);
            await this.actions.finalizeCommit(combatant, preparedAction, { context: { actionId: "prepare_item" } });
        }
        return { ok: true, status: "committed", intentId: intent.intentId, transaction, releasedGroundDocuments: placed.map(({ groundDocumentUuid }) => groundDocumentUuid) };
    }

    async #applyDirect(mutations) {
        const applied = [];
        try {
            for (const mutation of mutations) {
                const document = await this.resolver(mutation.documentUuid);
                if (!document?.update) throw new Error("documentMissing");
                await document.update({ [mutation.path]: deepClone(mutation.after) });
                applied.push({ document, mutation });
            }
            return { ok: true };
        } catch (error) {
            for (const { document, mutation } of applied.reverse()) await document.update({ [mutation.path]: deepClone(mutation.before) });
            return { ok: false, code: error.message };
        }
    }

    async #placeGroundItem(actor, item, intent) {
        const scene = this.sceneProvider();
        if (!scene?.createEmbeddedDocuments) return { ok: false, status: "blocked", code: "sceneMissing", intentId: intent.intentId };
        const existing = [...(scene.tiles ?? [])].find((tile) => tile.flags?.l5r5e?.groundItem?.transactionId === intent.intentId);
        if (existing) return { ok: true, status: "committed", idempotent: true, intentId: intent.intentId, groundDocumentUuid: existing.uuid };
        if (!item) return { ok: false, status: "blocked", code: "itemMissing", intentId: intent.intentId };
        const snapshot = sanitizeItemSnapshot(item);
        const placement = intent.options.placement ?? this.#actorPlacement(actor);
        const size = toFiniteNumber(scene.grid?.size, 100);
        const flags = { l5r5e: { groundItem: { schemaVersion: GROUND_ITEM_SCHEMA_VERSION, sourceActorUuid: actor.uuid, sourceItemUuid: item.uuid, itemSnapshot: snapshot, quantity: 1, transactionId: intent.intentId, state: intent.options.state ?? "ground", targetUuid: intent.options.embeddedTargetUuid ?? null, landingAudit: deepClone(intent.options.landingAudit ?? null) } } };
        const data = { name: item.name, x: toFiniteNumber(placement?.x, 0), y: toFiniteNumber(placement?.y, 0), width: size, height: size, texture: { src: item.img ?? snapshot.img }, flags };
        let tile;
        try {
            [tile] = await scene.createEmbeddedDocuments("Tile", [data]);
            const quantity = Math.max(1, toFiniteNumber(item.system?.quantity, 1));
            if (quantity > 1) await item.update({ "system.quantity": quantity - 1, "system.equipped": false, ...(item.type === "weapon" ? { "system.readied": false } : {}) });
            else await actor.deleteEmbeddedDocuments("Item", [item.id]);
        } catch (error) {
            if (tile) await scene.deleteEmbeddedDocuments?.("Tile", [tile.id]).catch?.(() => undefined);
            return { ok: false, status: "conflict", code: "groundPlacementFailed", error: error.message, intentId: intent.intentId };
        }
        return { ok: true, status: "committed", intentId: intent.intentId, groundDocumentUuid: tile.uuid, groundItem: flags.l5r5e.groundItem };
    }

    async #pickupGroundItem(actor, groundDocument, intent) {
        const ground = this.groundItemData(groundDocument);
        if (!ground || ground.state !== "ground") return { ok: false, status: "blocked", code: "groundItemUnavailable", intentId: intent.intentId };
        const snapshot = sanitizeItemSnapshot(ground.itemSnapshot);
        const existing = [...(actor.items ?? [])].find((item) => item.id === snapshot._id || (item.system?.rulesKey && item.system.rulesKey === snapshot.system?.rulesKey && item.type === snapshot.type));
        const beforeQuantity = existing ? Math.max(1, toFiniteNumber(existing.system?.quantity, 1)) : 0;
        let created = null;
        try {
            if (existing) await existing.update({ "system.quantity": beforeQuantity + Math.max(1, toFiniteNumber(ground.quantity, 1)) });
            else {
                const data = { ...snapshot, system: { ...snapshot.system, quantity: Math.max(1, toFiniteNumber(ground.quantity, 1)), equipped: false, ...(snapshot.type === "weapon" ? { readied: false } : {}) } };
                [created] = await actor.createEmbeddedDocuments("Item", [data], { keepId: true });
            }
            await groundDocument.parent.deleteEmbeddedDocuments("Tile", [groundDocument.id]);
        } catch (error) {
            if (created) await actor.deleteEmbeddedDocuments?.("Item", [created.id]).catch?.(() => undefined);
            else if (existing) await existing.update({ "system.quantity": beforeQuantity }).catch?.(() => undefined);
            return { ok: false, status: "conflict", code: "pickupFailed", error: error.message, intentId: intent.intentId };
        }
        return { ok: true, status: "committed", intentId: intent.intentId, itemUuid: created?.uuid ?? existing?.uuid };
    }

    async #rollbackPlaced(actor, placements) {
        for (const placement of [...placements].reverse()) {
            const groundDocument = await this.resolver(placement.groundDocumentUuid);
            if (!groundDocument) continue;
            await this.#pickupGroundItem(actor, groundDocument, { intentId: `${placement.intentId}-rollback` });
        }
    }

    #actorPlacement(actor) {
        const token = actor?.getActiveTokens?.(true, true)?.[0]?.document ?? actor?.token ?? null;
        return token ? { x: token.x, y: token.y, elevation: token.elevation ?? 0 } : { x: 0, y: 0, elevation: 0 };
    }
}
