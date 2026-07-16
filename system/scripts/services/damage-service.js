import { getActorKind, toFiniteNumber } from "./rule-utils.js";

export class DamageService {
    constructor({ conditionService, itemQualityService } = {}) {
        this.conditions = conditionService;
        this.qualities = itemQualityService;
    }

    resolve(input = {}) {
        const base = Math.max(0, toFiniteNumber(input.baseDamage, 0));
        const bonusSuccesses = Math.max(0, toFiniteNumber(input.bonusSuccesses, 0));
        const increases = (input.increases ?? []).map((value) => toFiniteNumber(value?.amount ?? value, 0));
        const reductions = (input.reductions ?? []).map((value) => toFiniteNumber(value?.amount ?? value, 0));
        const afterIncreases = Math.max(0, base + bonusSuccesses + increases.reduce((sum, value) => sum + value, 0));
        const afterReductions = Math.max(0, afterIncreases - reductions.reduce((sum, value) => sum + value, 0));
        const damageType = input.damageType === "supernatural" ? "supernatural" : "physical";
        const resistance = input.ignoreResistance ? 0 : Math.max(0, toFiniteNumber(input.resistance?.[damageType] ?? input.resistance, 0));
        const afterResistance = Math.max(0, afterReductions - resistance);
        const target = input.target;
        const targetKind = getActorKind(target);
        const incapacitated = this.conditions?.isActive?.(target, "incapacitated", input.lifecycle, input.ignoredConditions ?? []) ?? false;
        const cannotDefend = input.canDefend === false || incapacitated;
        const defenseChoice = afterResistance > 0 && !cannotDefend ? input.defenseChoice ?? "pending" : "cannotDefend";
        const defended = afterResistance > 0 && defenseChoice === "defend";
        const voluntaryCritical = afterResistance > 0 && defenseChoice === "voidCritical" && !incapacitated && toFiniteNumber(target?.system?.void_points?.value, 0) > 0;
        const critical = afterResistance > 0 && (cannotDefend || voluntaryCritical);
        const fatigue = afterResistance > 0 && (defended || targetKind === "minion") ? afterResistance : 0;
        const currentFatigue = toFiniteNumber(target?.system?.fatigue?.value, 0);
        const endurance = toFiniteNumber(target?.system?.endurance, 0);
        const defeated = targetKind === "minion" && currentFatigue + fatigue > endurance;
        const lethal = defeated && toFiniteNumber(input.sourceDamage ?? afterIncreases, 0) >= 7;
        return {
            source: input.source ?? null,
            targetUuid: target?.uuid ?? null,
            damageType,
            ledger: { base, bonusSuccesses, increases, afterIncreases, reductions, afterReductions, resistance, final: afterResistance },
            requiresDefenseDecision: defenseChoice === "pending",
            defenseChoice,
            defended,
            fatigue,
            critical: critical ? { required: true, severity: Math.max(0, toFiniteNumber(input.deadliness ?? input.criticalSeverity, 0)), source: voluntaryCritical ? "voidDefense" : "unableToDefend" } : null,
            voidSpent: voluntaryCritical ? 1 : 0,
            minion: targetKind === "minion" ? { defeated, outcome: defeated ? (lethal ? "lethal" : "nonLethal") : null } : null,
            zeroDamage: afterResistance === 0,
        };
    }

    decisionUser(target, users = globalThis.game?.users ?? [], authorityUser = null) {
        const active = [...users].filter((user) => user?.active);
        const owns = (user) => {
            if (typeof target?.testUserPermission === "function") return target.testUserPermission(user, "OWNER");
            const ownership = target?.ownership ?? target?.permission ?? {};
            return Number(ownership[user.id] ?? ownership.default ?? 0) >= 3;
        };
        return active.filter((user) => !user.isGM && owns(user)).sort((left, right) => String(left.id).localeCompare(String(right.id)))[0]
            ?? authorityUser
            ?? active.filter((user) => user.isGM).sort((left, right) => String(left.id).localeCompare(String(right.id)))[0]
            ?? null;
    }

    async promptDefense({ target, damage } = {}) {
        if (!damage?.requiresDefenseDecision) return damage?.defenseChoice ?? "cannotDefend";
        const hasVoid = toFiniteNumber(target?.system?.void_points?.value, 0) > 0;
        if (!hasVoid) return "defend";
        const defend = await foundry.applications.api.DialogV2.confirm({
            window: { title: game.i18n.localize("l5r5e.automation.damage.defenseTitle") },
            content: `<p>${game.i18n.localize("l5r5e.automation.damage.defensePrompt")}</p>`,
            yes: { label: game.i18n.localize("l5r5e.automation.damage.defend") },
            no: { label: game.i18n.localize("l5r5e.automation.damage.voidCritical") },
        });
        return defend ? "defend" : "voidCritical";
    }

    async requestDefense({ target, damage } = {}) {
        if (!damage?.requiresDefenseDecision) return damage?.defenseChoice ?? "cannotDefend";
        const authority = game.l5r5e.authority.authorityUser();
        const user = this.decisionUser(target, game.users, authority);
        if (!user) throw new Error("No active owner or GM can decide defense");
        if (user.id === game.user.id) return this.promptDefense({ target, damage });
        return game.l5r5e.sockets.requestDecision("defense", { targetUuid: target.uuid, damage }, { userId: user.id });
    }

    resolveBleeding({ actor, strifeReceived = 0, currentFatigue = null, canDefend = true, defenseChoice = undefined } = {}) {
        const fatigueBefore = currentFatigue ?? toFiniteNumber(actor?.system?.fatigue?.value, 0);
        const damage = this.resolve({ baseDamage: strifeReceived, target: actor, source: "bleeding", damageType: "physical", resistance: 0, canDefend, defenseChoice });
        if (damage.critical?.required) damage.critical = { required: true, severity: fatigueBefore, source: "bleeding" };
        return damage;
    }

    razorEdgedDamage(input, result) {
        if (!input.item || !this.qualities?.has(input.item, "razor-edged")) return null;
        if (result.ledger.afterIncreases <= 0 || result.ledger.final !== 0 || input.success === false) return null;
        return this.qualities.applyDamage(input.item, { reason: "razorEdgedReducedToZero" });
    }
}
