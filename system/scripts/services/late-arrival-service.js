const FLAG_SCOPE = "l5r5e";
const FLAG_KEY = "lateArrival";

const RULES = Object.freeze({
    intrigue: Object.freeze({ delay: 0, skillId: "sentiment", fixedTn: null }),
    duel: Object.freeze({ delay: 0, skillId: "meditation", fixedTn: null }),
    skirmish: Object.freeze({ delay: 1, skillId: "tactics", fixedTn: 2 }),
    mass_battle: Object.freeze({ delay: 1, skillId: "command", fixedTn: 2 }),
});

/**
 * Owns the small amount of persistent state required for combatants added after
 * a Combat has begun. Foundry remains responsible for turn order and its native
 * Combatant#roundJoined value.
 */
export class LateArrivalService {
    constructor({ authorityService, gameProvider = () => globalThis.game } = {}) {
        this.authority = authorityService;
        this.gameProvider = gameProvider;
    }

    get game() {
        return this.gameProvider();
    }

    getFlag(combatant) {
        return combatant?.flags?.[FLAG_SCOPE]?.[FLAG_KEY] ?? null;
    }

    conflictType() {
        return this.game?.settings?.get(FLAG_SCOPE, "initiative-encounter") ?? "skirmish";
    }

    isStarted(combat) {
        return Boolean(combat?.started ?? ((combat?.round ?? 0) > 0));
    }

    ruleFor(combat, conflictType = this.conflictType()) {
        const rule = RULES[conflictType] ?? RULES.skirmish;
        const joinedRound = Math.max(Number(combat?.round) || 1, 1);
        const configuredTn = Number(this.game?.settings?.get(FLAG_SCOPE, "initiative-difficulty-value"));
        return {
            schemaVersion: 1,
            joinedRound,
            eligibleRound: joinedRound + rule.delay,
            conflictType,
            skillId: rule.skillId,
            tn: rule.fixedTn ?? (Number.isFinite(configuredTn) ? configuredTn : 1),
            state: "pending",
        };
    }

    canCreate(combat) {
        if (!this.isStarted(combat) || this.conflictType() !== "duel") return { ok: true };
        const count = Number(combat?.combatants?.size ?? combat?.combatants?.length ?? 0);
        return count >= 2 ? { ok: false, code: "duelThirdParticipant" } : { ok: true };
    }

    preCreate(combatant, _data, _options, userId) {
        if (userId && userId !== this.game?.user?.id) return;
        const result = this.canCreate(combatant?.parent);
        if (result.ok) return;
        const key = `l5r5e.automation.lateArrival.${result.code}`;
        const message = this.game?.i18n?.localize(key) ?? "A third participant cannot join an active duel.";
        globalThis.ui?.notifications?.warn(message);
        return false;
    }

    async onCreate(combatant) {
        if (!this.authority?.isAuthority() || !this.isStarted(combatant?.parent)) return;
        const combat = combatant.parent;
        const count = Number(combat?.combatants?.size ?? combat?.combatants?.length ?? 0);
        if (this.conflictType() === "duel" && count > 2) {
            const key = "l5r5e.automation.lateArrival.duelThirdParticipant";
            globalThis.ui?.notifications?.warn(this.game?.i18n?.localize(key) ?? "A third participant cannot join an active duel.");
            await combatant.delete();
            return;
        }
        if (this.getFlag(combatant)) return;
        const rule = this.ruleFor(combat);
        await combatant.update({ [`flags.${FLAG_SCOPE}.${FLAG_KEY}`]: rule });
        if (rule.eligibleRound <= rule.joinedRound) await this.resolveOne(combatant, rule);
    }

    async onCombatUpdate(combat, changes) {
        if (!this.authority?.isAuthority() || changes?.round === undefined) return;
        await this.resolveEligible(combat, Number(changes.round));
    }

    async onCombatantUpdate(combatant, changes) {
        if (!this.authority?.isAuthority() || changes?.initiative === undefined || changes.initiative === null) return;
        const lateArrival = this.getFlag(combatant);
        if (!lateArrival || lateArrival.state === "resolved") return;
        await this.setState(combatant, "resolved");
    }

    async resolveEligible(combat, round = Number(combat?.round)) {
        if (!this.authority?.isAuthority() || !this.isStarted(combat)) return [];
        const resolved = [];
        for (const combatant of combat.combatants ?? []) {
            const lateArrival = this.getFlag(combatant);
            if (!lateArrival || lateArrival.state !== "pending" || lateArrival.eligibleRound > round) continue;
            resolved.push(await this.resolveOne(combatant, lateArrival));
        }
        return resolved;
    }

    async resolveOne(combatant, lateArrival = this.getFlag(combatant)) {
        const combat = combatant?.parent;
        if (!combat || !lateArrival || lateArrival.state !== "pending") return null;
        await this.setState(combatant, "rolling");
        try {
            await combat.rollInitiative([combatant.id], {
                updateTurn: true,
                messageOptions: {
                    skillId: lateArrival.skillId,
                    difficulty: lateArrival.tn,
                    difficultyHidden: true,
                },
            });
            const refreshed = combat.combatants?.get?.(combatant.id) ?? combatant;
            const state = refreshed.initiative === null || refreshed.initiative === undefined ? "awaitingRoll" : "resolved";
            await this.setState(refreshed, state);
            return { combatantId: combatant.id, state };
        } catch (error) {
            await this.setState(combatant, "pending");
            throw error;
        }
    }

    async setState(combatant, state) {
        const current = this.getFlag(combatant);
        if (!current || current.state === state) return combatant;
        await combatant.update({ [`flags.${FLAG_SCOPE}.${FLAG_KEY}`]: { ...current, state } });
        return combatant;
    }
}

export const LATE_ARRIVAL_RULES = RULES;
