import { getActorKind, RINGS, stableHash, toFiniteNumber } from "./rule-utils.js";

export class InitiativeService {
    constructor({ opportunityService } = {}) {
        this.opportunities = opportunityService;
    }

    isPrepared(actor, override = "actor") {
        if (typeof override === "boolean") return override;
        if (override === "true" || override === "false") return override === "true";
        return Boolean(actor?.system?.prepared);
    }

    base(actor, prepared = this.isPrepared(actor)) {
        const system = actor?.system ?? {};
        return prepared ? toFiniteNumber(system.focus, 0) : toFiniteNumber(system.is_afflicted_or_compromised ? 1 : system.vigilance, 0);
    }

    chooseRing(actor, { order = ["fire", "water", "earth", "air", "void"], poolEvaluator = null } = {}) {
        const rings = actor?.system?.rings ?? {};
        const highest = Math.max(...RINGS.map((ring) => toFiniteNumber(rings[ring], 0)));
        const candidates = RINGS.filter((ring) => toFiniteNumber(rings[ring], 0) === highest);
        if (poolEvaluator) candidates.sort((a, b) => poolEvaluator(actor, b) - poolEvaluator(actor, a));
        return candidates.sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] ?? "void";
    }

    score(actor, { prepared = this.isPrepared(actor), success = false, bonusSuccesses = 0 } = {}) {
        return this.base(actor, prepared) + (success ? 1 + Math.max(0, toFiniteNumber(bonusSuccesses, 0)) : 0);
    }

    minionScore(actor, options = {}) {
        return this.base(actor, this.isPrepared(actor, options.prepared));
    }

    typeWeight(actor) {
        return { character: 1, adversary: 2, minion: 3 }[getActorKind(actor)] ?? 4;
    }

    ensureTieKey(combatant) {
        return combatant?.flags?.l5r5e?.initiativeTieKey ?? stableHash(`${combatant?.uuid ?? combatant?.id}:${combatant?.actor?.uuid ?? ""}`);
    }

    compare(a, b) {
        if (a.initiative !== b.initiative) return toFiniteNumber(b.initiative, -Infinity) - toFiniteNumber(a.initiative, -Infinity);
        const honorA = toFiniteNumber(a.actor?.system?.social?.honor, 0);
        const honorB = toFiniteNumber(b.actor?.system?.social?.honor, 0);
        if (honorA !== honorB) return honorA - honorB;
        const type = this.typeWeight(a.actor) - this.typeWeight(b.actor);
        if (type) return type;
        return this.ensureTieKey(a).localeCompare(this.ensureTieKey(b));
    }

    groupUpdates(combatants, rolledCombatant) {
        const groupId = rolledCombatant?.flags?.l5r5e?.initiativeGroupId;
        if (!groupId) return [{ _id: rolledCombatant.id, initiative: rolledCombatant.initiative }];
        return combatants.filter((combatant) => combatant.flags?.l5r5e?.initiativeGroupId === groupId)
            .map((combatant) => ({ _id: combatant.id, initiative: rolledCombatant.initiative, "flags.l5r5e.groupStance": rolledCombatant.actor?.system?.stance }));
    }

    optimizeKeeps(candidates = [], { tn = 1, baseInitiative = 0, compromisedAt = Infinity, opportunityValue = () => 0, seed = "" } = {}) {
        return [...candidates].sort((a, b) => {
            const score = (candidate) => [
                candidate.successes >= tn ? 1 : 0,
                baseInitiative + (candidate.successes >= tn ? 1 + Math.max(0, candidate.bonusSuccesses) : 0),
                -(Math.max(0, candidate.strife - compromisedAt)),
                -candidate.strife,
                opportunityValue(candidate),
                stableHash(`${seed}:${JSON.stringify(candidate.dice)}`),
            ];
            const left = score(a); const right = score(b);
            for (let index = 0; index < left.length; index += 1) {
                if (left[index] === right[index]) continue;
                return typeof left[index] === "string" ? left[index].localeCompare(right[index]) : right[index] - left[index];
            }
            return 0;
        })[0] ?? null;
    }

    async rollAdversary(actor, { skillId, skillGroup, tn = 1, prepared = this.isPrepared(actor), ringOrder, messageMode = "blind" } = {}) {
        const ring = this.chooseRing(actor, { order: ringOrder });
        const ringDice = Math.max(0, toFiniteNumber(actor.system.rings?.[ring], 0));
        const skillDice = Math.max(0, toFiniteNumber(actor.system.skills?.[skillGroup], 0));
        const formula = [`${ringDice}dr`, skillDice ? `${skillDice}ds` : null].filter(Boolean).join("+");
        const roll = new game.l5r5e.RollL5r5e(formula);
        roll.actor = actor;
        roll.l5r5e.isInitiativeRoll = true;
        roll.l5r5e.stance = ring;
        roll.l5r5e.skillId = skillId;
        roll.l5r5e.skillCatId = skillGroup;
        roll.l5r5e.difficulty = Math.max(1, tn);
        await roll.evaluate();

        const dice = roll.terms.flatMap((term) => {
            const faces = game.l5r5e?.[term.constructor.name]?.FACES;
            if (!faces) return [];
            return term.results.map((result) => ({ type: term.constructor.name, face: result.result, symbols: { ...faces[result.result] } }));
        });
        const combinations = this.#combinations(dice, Math.max(1, ringDice)).map((kept) => this.#candidate(kept, ring, tn));
        const compromisedAt = toFiniteNumber(actor.system.composure, Infinity) - toFiniteNumber(actor.system.strife?.value, 0);
        let selected = this.optimizeKeeps(combinations, { tn, baseInitiative: this.base(actor, prepared), compromisedAt, opportunityValue: (candidate) => candidate.opportunity, seed: actor.uuid });

        const explosionQueue = selected.dice.filter((die) => die.symbols.explosive).map((die) => die.type);
        for (let index = 0; index < explosionQueue.length && index < 20; index += 1) {
            const type = explosionQueue[index];
            const extra = new game.l5r5e.RollL5r5e(type === "RingDie" ? "1dr" : "1ds");
            await extra.evaluate();
            const term = extra.terms.find((entry) => entry.constructor.name === type);
            const face = term.results[0].result;
            const die = { type, face, symbols: { ...game.l5r5e[type].FACES[face] } };
            const withExtra = this.#candidate([...selected.dice, die], ring, tn);
            selected = this.optimizeKeeps([selected, withExtra], { tn, baseInitiative: this.base(actor, prepared), compromisedAt, opportunityValue: (candidate) => candidate.opportunity, seed: `${actor.uuid}:${index}` });
            if (selected === withExtra && die.symbols.explosive) explosionQueue.push(type);
        }

        const opportunityPlan = [];
        const decisions = {};
        let remaining = selected.opportunity;
        if (!prepared && ring === "fire" && remaining > 0 && toFiniteNumber(actor.system.focus, 0) > toFiniteNumber(actor.system.vigilance, 0)) {
            opportunityPlan.push({ rulesKey: "initiative-fire-focus-when-unprepared", spend: 1 });
            remaining -= 1;
        }
        const strifeRisk = toFiniteNumber(actor.system.strife?.value, 0) + selected.strife > toFiniteNumber(actor.system.composure, Infinity);
        if (strifeRisk && remaining > 0) opportunityPlan.push({ rulesKey: "general-remove-check-strife", spend: Math.min(remaining, selected.strife) });

        const resolution = await game.l5r5e.rollResolution.resolve({
            context: { actor, ring, stance: ring, skillId, skillGroup, initiative: true, checkKind: "initiative", conflictType: "conflict", tn, baseTn: tn },
            keptDice: selected.dice,
            opportunityPlan,
            decisions,
        });
        const initiativeBase = opportunityPlan.some(({ rulesKey }) => rulesKey === "initiative-fire-focus-when-unprepared") ? toFiniteNumber(actor.system.focus, 0) : this.base(actor, prepared);
        const initiative = initiativeBase + (resolution.effective.success ? 1 + resolution.effective.bonusSuccesses : 0);
        roll.l5r5e.summary = { ...roll.l5r5e.summary, totalSuccess: selected.successes, totalBonus: resolution.effective.bonusSuccesses, opportunity: selected.opportunity, strife: selected.strife };
        const message = await roll.toMessage({ flavor: game.i18n.localize("l5r5e.dice.chat.initiative_roll") }, { messageMode });
        const mutations = await game.l5r5e.rollResolution.buildMutations(resolution, { actor });
        const transaction = game.l5r5e.transactions.create({ transactionId: resolution.transactionId, revision: resolution.revision, rollMessageUuid: message.uuid, inputs: { context: resolution.context, raw: resolution.raw }, decisions, mutations });
        const applied = await game.l5r5e.transactions.apply(transaction);
        if (!applied.ok) {
            await message.delete?.().catch?.(() => undefined);
            throw new Error(`Adversary initiative transaction failed: ${applied.code}`);
        }
        resolution.transaction = transaction;
        resolution.status = "applied";
        roll.l5r5e.resolution = resolution;
        try {
            await message.update({ "flags.l5r5e.resolution": resolution, rolls: [roll.toJSON()], content: await roll.render({}) });
        } catch (error) {
            const reverted = await game.l5r5e.transactions.revert(transaction);
            if (!reverted.ok) console.warn("L5R5E | Failed to roll back an adversary initiative transaction after a chat-message error.", reverted);
            await message.delete?.().catch?.(() => undefined);
            throw error;
        }
        globalThis.Hooks?.callAll?.("l5r5e.rollResolutionChanged", message, resolution);
        return { initiative, ring, selected, resolution, message };
    }

    #candidate(dice, ring, tn) {
        const totals = dice.reduce((result, die) => {
            result.successes += toFiniteNumber(die.symbols.success, 0) + toFiniteNumber(die.symbols.explosive, 0);
            result.opportunity += toFiniteNumber(die.symbols.opportunity, 0);
            result.strife += toFiniteNumber(die.symbols.strife, 0);
            return result;
        }, { successes: 0, opportunity: 0, strife: 0 });
        const success = totals.successes >= tn;
        return { ...totals, dice, bonusSuccesses: success ? Math.max(0, totals.successes - tn) + (ring === "fire" ? totals.strife : 0) : 0 };
    }

    #combinations(values, maximum) {
        const output = [];
        const visit = (index, selected) => {
            if (selected.length > 0) output.push([...selected]);
            if (selected.length >= maximum) return;
            for (let next = index; next < values.length; next += 1) {
                selected.push(values[next]);
                visit(next + 1, selected);
                selected.pop();
            }
        };
        visit(0, []);
        return output;
    }
}
