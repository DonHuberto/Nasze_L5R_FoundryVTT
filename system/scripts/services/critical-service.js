import { deepClone, getActorKind, makeId, toFiniteNumber } from "./rule-utils.js";

export function criticalOutcome(severity, ring = "void", { razorEdged = false } = {}) {
    const finalSeverity = Math.max(0, Math.trunc(toFiniteNumber(severity, 0)));
    const conditions = [];
    let armorDamage = false;
    let scar = null;
    let dyingRounds = null;
    if (finalSeverity <= 2) armorDamage = true;
    else if (finalSeverity <= 4) conditions.push(`lightly_wounded_${ring}`);
    else if (finalSeverity <= 6) conditions.push(`severely_wounded_${ring}`);
    else if (finalSeverity <= 8) { conditions.push("bleeding"); scar = { tier: "minor", requiresGmSelection: true }; }
    else if (finalSeverity <= 11) { conditions.push("bleeding"); scar = { tier: "major", requiresGmSelection: true }; }
    else if (finalSeverity <= 13) { conditions.push(`severely_wounded_${ring}`, "bleeding", "dying"); dyingRounds = 3; }
    else if (finalSeverity <= 15) { conditions.push(`severely_wounded_${ring}`, "bleeding", "dying"); dyingRounds = 1; }
    else conditions.push("dead");
    if (razorEdged && finalSeverity >= 3 && finalSeverity <= 6) conditions.push("bleeding");
    return { severity: finalSeverity, armorDamage, conditions: [...new Set(conditions)], scar, dyingRounds };
}

export class CriticalService {
    constructor({ conditionService, itemQualityService } = {}) {
        this.conditions = conditionService;
        this.qualities = itemQualityService;
    }

    prepare(input = {}) {
        const target = input.target;
        const minion = getActorKind(target) === "minion";
        let sourceSeverity = Math.max(0, toFiniteNumber(input.severity ?? input.deadliness, 0));
        const enragedSource = this.conditions?.isActive?.(input.sourceActor, "enraged", input.lifecycle) ?? false;
        const enragedTarget = this.conditions?.isActive?.(target, "enraged", input.lifecycle) ?? false;
        const unconsciousTarget = this.conditions?.isActive?.(target, "unconscious", input.lifecycle) ?? false;
        if (enragedSource) sourceSeverity += 2;
        if (enragedTarget) sourceSeverity += 2;
        if (unconsciousTarget) sourceSeverity += 10;
        sourceSeverity += (input.modifiers ?? []).reduce((sum, modifier) => sum + toFiniteNumber(modifier?.amount ?? modifier, 0), 0);
        return {
            sourceSeverity: Math.max(0, sourceSeverity),
            targetUuid: target?.uuid ?? null,
            minion,
            mitigation: minion ? null : { tn: Math.max(1, toFiniteNumber(input.mitigationTn, 1)), skillId: "fitness", allowedRings: input.conflict ? [input.stance] : ["air", "earth", "fire", "water", "void"] },
            shatteringParryAvailable: !minion && Boolean(input.shatteringParryAvailable) && (input.readiedWeapons?.length ?? 0) > 0,
        };
    }

    resolve(input = {}, decision = {}) {
        const prepared = this.prepare(input);
        if (prepared.minion) return { ...prepared, finalSeverity: prepared.sourceSeverity, minionFatigue: prepared.sourceSeverity, outcome: null };
        if (decision.shatteringParry && !prepared.shatteringParryAvailable) throw new Error("Shattering Parry is not available");
        if (decision.shatteringParry && !decision.weapon) throw new Error("Shattering Parry requires a readied weapon");
        const mitigation = decision.shatteringParry ? decision.rerolledMitigation ?? decision.mitigation : decision.mitigation;
        const succeeded = Boolean(mitigation?.success);
        const reduction = succeeded ? 1 + Math.max(0, toFiniteNumber(mitigation?.bonusSuccesses, 0)) : 0;
        const finalSeverity = Math.max(0, prepared.sourceSeverity - reduction);
        const razorEdged = Boolean(input.razorEdged);
        const outcome = criticalOutcome(finalSeverity, decision.ring ?? input.stance ?? "void", { razorEdged });
        const incapacitated = this.conditions?.isActive?.(input.target, "incapacitated", input.lifecycle) ?? false;
        if (incapacitated && !outcome.conditions.includes("unconscious")) outcome.conditions.push("unconscious");
        const itemDamage = decision.shatteringParry ? this.qualities?.applyDamage(decision.weapon, { reason: "shatteringParry" }) : null;
        const armorDamage = outcome.armorDamage && input.wornArmor ? this.qualities?.applyDamage(input.wornArmor, { reason: "criticalSeverity0to2" }) : null;
        return { ...prepared, mitigation: { ...mitigation, succeeded, reduction }, finalSeverity, outcome, armorDamage, shatteringParry: decision.shatteringParry ? { weaponUuid: decision.weapon.uuid, itemDamage, beforeCommit: true } : null };
    }

    repeatedScar(existingScarUuids = [], scarUuid = null) {
        if (!scarUuid || !existingScarUuids.includes(scarUuid)) return { repeated: false, scarUuid };
        return { repeated: true, requiresGmDecision: true, alternativeCondition: "dying_5", scarUuid };
    }

    resolveScarUuid(outcome, selectedUuid, scarDocuments = []) {
        if (!outcome?.scar) return null;
        return scarDocuments.find((document) => document.uuid === selectedUuid && document.system?.automationTags?.includes("scar"))?.uuid ?? null;
    }

    sessionId() {
        return globalThis.game?.settings?.get?.("l5r5e", "automationSessionId") ?? "world-session";
    }

    createWorkflow(input = {}) {
        const target = input.target?.actor ?? input.target;
        const readiedWeapons = input.readiedWeapons ?? [...(target?.items ?? [])].filter((item) => item.type === "weapon" && item.system?.equipped && item.system?.readied);
        const wornArmor = input.wornArmor ?? [...(target?.items ?? [])].find((item) => item.type === "armor" && item.system?.equipped) ?? null;
        const sessionId = input.sessionId ?? this.sessionId();
        const pending = deepClone(target?.flags?.l5r5e?.pendingRuleEffects ?? []);
        const severityEffects = pending.filter((effect) => effect.type === "criticalModifier");
        const mitigationEffects = pending.filter((effect) => effect.type === "tnModifier" && effect.selector === "nextCriticalMitigation");
        const consumedPendingEffectIds = [...severityEffects, ...mitigationEffects].map((effect) => `${effect.transactionId ?? "legacy"}:${effect.rulesKey}`);
        return {
            workflowId: input.workflowId ?? makeId("critical"),
            parentTransactionId: input.parentTransactionId ?? null,
            parentRollMessageUuid: input.parentRollMessageUuid ?? null,
            sourceActorUuid: input.sourceActor?.uuid ?? input.sourceActorUuid ?? null,
            targetUuid: target?.uuid ?? input.targetUuid ?? null,
            sourceItemUuid: input.sourceItem?.uuid ?? input.sourceItemUuid ?? null,
            severity: Math.max(0, toFiniteNumber(input.severity ?? input.deadliness, 0)),
            modifiers: [...deepClone(input.modifiers ?? []), ...severityEffects.map((effect) => ({ amount: effect.amount, reason: effect.rulesKey }))],
            mitigationTn: Math.max(1, 1 + mitigationEffects.reduce((sum, effect) => sum + toFiniteNumber(effect.amount, 0), 0)),
            conflict: Boolean(input.conflict),
            stance: String(input.stance ?? target?.system?.stance ?? "void").toLowerCase(),
            razorEdged: Boolean(input.razorEdged),
            readiedWeaponUuids: readiedWeapons.map((item) => item.uuid),
            wornArmorUuid: wornArmor?.uuid ?? null,
            sessionId,
            shatteringParryAvailable: getActorKind(target) === "character" && readiedWeapons.length > 0 && target?.flags?.l5r5e?.shatteringParrySessionId !== sessionId,
            consumedPendingEffectIds,
        };
    }

    async startWorkflow(input = {}) {
        const target = input.target?.actor ?? input.target;
        if (!target) throw new Error("Critical strike target is required");
        const workflow = this.createWorkflow({ ...input, target });
        if (getActorKind(target) === "minion") {
            const result = this.resolve({ ...workflow, target, sourceActor: input.sourceActor }, {});
            const { mutations } = this.buildMutations(result, { target, workflow });
            const transaction = game.l5r5e.transactions.create({ transactionId: workflow.workflowId, inputs: workflow, mutations });
            const applied = workflow.parentRollMessageUuid
                ? await game.l5r5e.sockets.requestAuthority("applyTransaction", { transaction, parentMessageUuid: workflow.parentRollMessageUuid })
                : game.l5r5e.authority.isAuthority()
                ? await game.l5r5e.transactions.apply(transaction)
                : await game.l5r5e.sockets.requestAuthority("applyTransaction", { transaction });
            return { status: applied.ok ? "applied" : "conflict", workflow, result, transaction };
        }

        const prepared = this.prepare({ ...workflow, target, shatteringParryAvailable: workflow.shatteringParryAvailable, readiedWeapons: workflow.readiedWeaponUuids });
        const user = game.l5r5e.damage.decisionUser(target, game.users, game.l5r5e.authority.authorityUser());
        if (!user) throw new Error("No active owner or GM can resolve the critical strike");
        const dpOptions = {
            difficulty: prepared.mitigation.tn,
            difficultyHidden: false,
            ringId: prepared.mitigation.allowedRings[0],
            allowedRings: prepared.mitigation.allowedRings,
            skillId: "fitness",
            skillsList: "fitness",
            conflictType: workflow.conflict ? "conflict" : null,
            rollContext: { type: "critical-mitigation", critical: workflow },
        };
        if (user.id === game.user.id) new game.l5r5e.DicePickerDialog({ ...dpOptions, actor: target }).render(true);
        else game.l5r5e.sockets.openDicePicker({ users: [user], actors: [target], dpOptions });
        return { status: "mitigationRequested", workflow, decisionUserId: user.id };
    }

    async handleMitigationRoll({ roll, resolution } = {}) {
        const workflow = roll?.l5r5e?.rollContext?.critical;
        if (!workflow) return null;
        const target = await fromUuid(workflow.targetUuid);
        const sourceActor = workflow.sourceActorUuid ? await fromUuid(workflow.sourceActorUuid) : null;
        if (!target) throw new Error(`Critical target is unavailable: ${workflow.targetUuid}`);
        const ring = resolution.context?.ring ?? workflow.stance;
        const mitigation = { success: resolution.effective.success, bonusSuccesses: resolution.effective.bonusSuccesses };

        if (!workflow.reroll && workflow.shatteringParryAvailable) {
            const weapon = await this.#chooseShatteringWeapon(workflow);
            if (weapon) {
                await this.#openShatteringReroll(roll, { ...workflow, reroll: true, shatteringParryWeaponUuid: weapon.uuid });
                return { deferred: true, reason: "shatteringParry", weaponUuid: weapon.uuid };
            }
        }

        const weapon = workflow.shatteringParryWeaponUuid ? await fromUuid(workflow.shatteringParryWeaponUuid) : null;
        const wornArmor = workflow.wornArmorUuid ? await fromUuid(workflow.wornArmorUuid) : null;
        const input = { ...workflow, target, sourceActor, wornArmor, shatteringParryAvailable: workflow.shatteringParryAvailable, readiedWeapons: weapon ? [weapon] : [] };
        const decision = { ring, mitigation, shatteringParry: Boolean(workflow.reroll), weapon, ...(workflow.reroll ? { rerolledMitigation: mitigation } : {}) };
        const result = this.resolve(input, decision);
        let scarDecision = null;
        if (result.outcome?.scar) {
            scarDecision = game.l5r5e.authority.isAuthority()
                ? await this.promptScarDecision({ targetUuid: target.uuid, tier: result.outcome.scar.tier })
                : await game.l5r5e.sockets.requestAuthority("criticalScarDecision", { targetUuid: target.uuid, tier: result.outcome.scar.tier });
            result.scarDecision = scarDecision;
        }
        const built = this.buildMutations(result, { target, workflow, scarDecision, weapon, wornArmor });
        return { deferred: false, result, ...built };
    }

    async promptScarDecision({ targetUuid, tier } = {}) {
        const target = await fromUuid(targetUuid);
        if (!target) throw new Error(`Scar target is unavailable: ${targetUuid}`);
        const pack = game.packs.get("l5r5e.core-peculiarities-adversities");
        const documents = (await pack?.getDocuments?.({ type: "peculiarity" }) ?? [])
            .filter((document) => document.system?.automationTags?.includes("scar"));
        if (!documents.length) return { status: "manual", reason: "scarCompendiumUnavailable", tier };
        const options = documents.map((document) => `<option value="${document.uuid}">${foundry.utils.escapeHTML(document.name)}</option>`).join("");
        const selectedUuid = await foundry.applications.api.DialogV2.prompt({
            window: { title: game.i18n.localize("l5r5e.automation.critical.scarTitle") },
            content: `<p>${game.i18n.localize("l5r5e.automation.critical.scarPrompt")} (${tier})</p><select name="scarUuid">${options}</select>`,
            ok: { callback: (_event, button) => button.form.elements.scarUuid.value },
        });
        const selected = documents.find((document) => document.uuid === selectedUuid);
        if (!selected) return { status: "manual", reason: "scarNotSelected", tier };
        const repeated = [...(target.items ?? [])].some((item) => item.flags?.l5r5e?.sourceUuid === selected.uuid || item.system?.rulesKey === selected.system?.rulesKey);
        let useDying5 = false;
        if (repeated) {
            useDying5 = await foundry.applications.api.DialogV2.confirm({
                window: { title: game.i18n.localize("l5r5e.automation.critical.repeatedScarTitle") },
                content: `<p>${game.i18n.localize("l5r5e.automation.critical.repeatedScarPrompt")}</p>`,
                yes: { label: game.i18n.localize("l5r5e.automation.critical.applyDying5") },
                no: { label: game.i18n.localize("l5r5e.automation.critical.addScarAgain") },
            });
        }
        const scarData = selected.toObject();
        scarData._id = foundry.utils.randomID();
        scarData.flags ??= {};
        scarData.flags.l5r5e = { ...(scarData.flags.l5r5e ?? {}), sourceUuid: selected.uuid, scarTier: tier };
        return { status: "selected", scarUuid: selected.uuid, rulesKey: selected.system.rulesKey, tier, repeated, useDying5, scarData: useDying5 ? null : scarData };
    }

    buildMutations(result, { target, workflow = {}, scarDecision = null, weapon = null, wornArmor = null } = {}) {
        const mutations = [];
        const createdDocuments = [];
        if (result.minion) {
            const before = toFiniteNumber(target.system?.fatigue?.value, 0);
            mutations.push({ documentUuid: target.uuid, path: "system.fatigue.value", before, after: before + result.minionFatigue, reason: "criticalAgainstMinion", options: { l5r5eDefeatOutcome: result.minionFatigue >= 7 ? "lethal" : "nonLethal" } });
            return { mutations, createdDocuments, followUpCritical: null };
        }

        let followUpCritical = null;
        const statusChanges = new Map();
        const status = (condition, active) => {
            const before = target.statuses?.has?.(condition) ?? false;
            const existing = statusChanges.get(condition);
            statusChanges.set(condition, { before: existing?.before ?? before, after: active });
        };
        for (const condition of result.outcome?.conditions ?? []) {
            const light = condition.match(/^lightly_wounded_(.+)$/);
            const severe = condition.match(/^severely_wounded_(.+)$/);
            if (light) {
                const severeKey = `severely_wounded_${light[1]}`;
                if (target.statuses?.has?.(condition)) { status(condition, false); status(severeKey, true); }
                else if (target.statuses?.has?.(severeKey)) followUpCritical = { severity: 10, reason: "repeatedWound" };
                else status(condition, true);
            } else if (severe) {
                const lightKey = `lightly_wounded_${severe[1]}`;
                if (target.statuses?.has?.(condition)) followUpCritical = { severity: 10, reason: "repeatedWound" };
                else { if (target.statuses?.has?.(lightKey)) status(lightKey, false); status(condition, true); }
            } else {
                status(condition, true);
                if (condition === "dead" && target.statuses?.has?.("dying")) status("dying", false);
            }
        }
        if (scarDecision?.useDying5) status("dying", true);
        for (const [condition, values] of statusChanges) {
            if (values.before !== values.after) mutations.push({ documentUuid: target.uuid, path: `statuses.${condition}`, ...values, reason: "criticalOutcome" });
        }
        const dyingRounds = scarDecision?.useDying5 ? 5 : result.outcome?.dyingRounds;
        if (dyingRounds) {
            const before = toFiniteNumber(target.flags?.l5r5e?.dyingRounds, 0);
            const after = before > 0 ? Math.min(before, dyingRounds) : dyingRounds;
            if (before !== after) mutations.push({ documentUuid: target.uuid, path: "flags.l5r5e.dyingRounds", before, after, reason: "criticalDying" });
        }
        if (result.armorDamage?.changed && wornArmor) mutations.push(this.qualities.mutation(wornArmor, result.armorDamage));
        if (result.shatteringParry?.itemDamage?.changed && weapon) mutations.push(this.qualities.mutation(weapon, result.shatteringParry.itemDamage));
        if (result.shatteringParry) {
            mutations.push({ documentUuid: target.uuid, path: "flags.l5r5e.shatteringParrySessionId", before: target.flags?.l5r5e?.shatteringParrySessionId ?? null, after: workflow.sessionId ?? this.sessionId(), reason: "shatteringParry" });
        }
        if (workflow.consumedPendingEffectIds?.length) {
            const before = deepClone(target.flags?.l5r5e?.pendingRuleEffects ?? []);
            const consumed = new Set(workflow.consumedPendingEffectIds);
            const after = before.filter((effect) => !consumed.has(`${effect.transactionId ?? "legacy"}:${effect.rulesKey}`));
            mutations.push({ documentUuid: target.uuid, path: "flags.l5r5e.pendingRuleEffects", before, after, reason: "consumeCriticalModifiers" });
        }
        if (scarDecision?.scarData) createdDocuments.push({ parentUuid: target.uuid, embeddedName: "Item", data: scarDecision.scarData, reason: "criticalScar" });
        return { mutations, createdDocuments, followUpCritical };
    }

    async #chooseShatteringWeapon(workflow) {
        const useParry = await foundry.applications.api.DialogV2.confirm({
            window: { title: game.i18n.localize("l5r5e.automation.critical.shatteringTitle") },
            content: `<p>${game.i18n.localize("l5r5e.automation.critical.shatteringPrompt")}</p>`,
            yes: { label: game.i18n.localize("l5r5e.automation.critical.shatteringUse") },
            no: { label: game.i18n.localize("l5r5e.automation.critical.shatteringSkip") },
        });
        if (!useParry) return null;
        const weapons = (await Promise.all(workflow.readiedWeaponUuids.map((uuid) => fromUuid(uuid)))).filter(Boolean);
        if (!weapons.length) return null;
        if (weapons.length === 1) return weapons[0];
        const options = weapons.map((item) => `<option value="${item.uuid}">${foundry.utils.escapeHTML(item.name)}</option>`).join("");
        const uuid = await foundry.applications.api.DialogV2.prompt({
            window: { title: game.i18n.localize("l5r5e.automation.critical.shatteringWeapon") },
            content: `<select name="weaponUuid">${options}</select>`,
            ok: { callback: (_event, button) => button.form.elements.weaponUuid.value },
        });
        return weapons.find((item) => item.uuid === uuid) ?? null;
    }

    async #openShatteringReroll(originalRoll, workflow) {
        const roll = new game.l5r5e.RollL5r5e(originalRoll.l5r5e.initialFormula ?? originalRoll.formula);
        roll.actor = originalRoll.l5r5e.actor;
        roll.l5r5e = { ...originalRoll.l5r5e, summary: roll.l5r5e.summary, history: null, rnkEnded: false, resolution: null, rollContext: { type: "critical-mitigation", critical: deepClone(workflow) } };
        await roll.roll();
        const message = await roll.toMessage();
        new game.l5r5e.RollnKeepDialog(message.id).render(true);
        return message;
    }
}
