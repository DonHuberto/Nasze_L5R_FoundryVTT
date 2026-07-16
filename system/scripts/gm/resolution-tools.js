export class ResolutionToolsL5r5e {
    static resolution(message) {
        return message?.flags?.l5r5e?.resolution ?? message?.rolls?.[0]?.l5r5e?.resolution ?? null;
    }

    static messageFromEntry(entry) {
        const id = entry?.dataset?.messageId ?? entry?.data?.("messageId") ?? entry?.attr?.("data-message-id");
        return game.messages.get(id);
    }

    static contextOptions() {
        const condition = (entry) => game.user.isGM && Boolean(this.resolution(this.messageFromEntry(entry)));
        return [
            { name: "l5r5e.automation.gm.changeTn", icon: "<i class='fas fa-bullseye'></i>", condition, callback: (entry) => this.changeTn(this.messageFromEntry(entry)) },
            { name: "l5r5e.automation.gm.assignTarget", icon: "<i class='fas fa-crosshairs'></i>", condition, callback: (entry) => this.changeTarget(this.messageFromEntry(entry)) },
            { name: "l5r5e.automation.gm.reopenOpportunity", icon: "<i class='fas fa-redo'></i>", condition, callback: (entry) => this.reopenOpportunity(this.messageFromEntry(entry)) },
            { name: "l5r5e.automation.gm.history", icon: "<i class='fas fa-history'></i>", condition, callback: (entry) => this.showHistory(this.messageFromEntry(entry)) },
        ];
    }

    static async changeTn(message) {
        const resolution = this.resolution(message);
        const value = await foundry.applications.api.DialogV2.prompt({
            window: { title: game.i18n.localize("l5r5e.automation.gm.changeTn") },
            content: `<label>TN <input type="number" name="tn" min="1" value="${resolution.tn.value}"></label>`,
            ok: { callback: (_event, button) => Number(button.form.elements.tn.value) },
        });
        if (value === null || value === undefined) return;
        return this.replay(message, { tn: Math.max(1, Math.round(value)) });
    }

    static async changeTarget(message) {
        const target = [...game.user.targets][0]?.document;
        if (!target) return ui.notifications.warn(game.i18n.localize("l5r5e.automation.gm.selectTarget"));
        return this.replay(message, { target });
    }

    static async replay(message, changes = {}) {
        const previous = this.resolution(message);
        if (!previous) return;
        const actor = previous.context.actorUuid ? await fromUuid(previous.context.actorUuid) : null;
        const target = changes.target ?? (previous.context.targetUuid ? await fromUuid(previous.context.targetUuid) : null);
        const item = previous.context.itemUuid ? await fromUuid(previous.context.itemUuid) : null;
        const selections = previous.opportunities?.selections ?? [];
        const opportunityPlan = selections.map(({ rulesKey, cost }) => ({ rulesKey, spend: cost }));
        const decisions = Object.fromEntries(selections.map(({ rulesKey, decision }) => {
            const updated = { ...(decision ?? {}) };
            if (changes.target && updated.targetUuid === previous.context.targetUuid) updated.targetUuid = changes.target.uuid;
            return [rulesKey, updated];
        }));
        const context = {
            ...previous.context,
            actor,
            target,
            targetActor: target?.actor ?? target,
            item,
            tn: previous.context.tn ?? previous.context.baseTn ?? previous.tn.base,
            baseTn: previous.context.baseTn ?? previous.tn.base,
            finalTnOverride: changes.tn ?? previous.context.finalTnOverride,
            revision: previous.revision + 1,
            transactionId: previous.transactionId,
        };
        const related = [...(message.flags?.l5r5e?.relatedTransactions ?? [])];
        for (const transaction of [previous.transaction, ...related].filter(Boolean)) {
            const inspection = await game.l5r5e.transactions.inspectRevert(transaction);
            if (!inspection.ok) {
                ui.notifications.error(game.i18n.localize("l5r5e.automation.transaction.conflict"));
                await this.showConflict(inspection);
                return inspection;
            }
        }
        const actionMutation = previous.transaction?.mutations?.find((mutation) => mutation.path === "flags.l5r5e.turnState" && String(mutation.reason).includes("actionCommit"));
        const afterActionEffects = actionMutation ? [...(previous.conditionEffects ?? [])] : [];
        const sourceRoll = message.rolls?.[0];
        const criticalContext = sourceRoll?.l5r5e?.rollContext?.type === "critical-mitigation" ? sourceRoll.l5r5e.rollContext.critical : null;
        let previousReverted = false;
        const restorePrevious = async () => {
            if (previousReverted && previous.transaction) await game.l5r5e.transactions.apply(previous.transaction);
            for (const transaction of related) await game.l5r5e.transactions.apply(transaction);
        };
        for (const transaction of [...related].reverse()) await game.l5r5e.transactions.revert(transaction);
        if (previous.transaction) {
            const reverted = await game.l5r5e.transactions.revert(previous.transaction);
            if (!reverted.ok) return reverted;
            previousReverted = true;
        }

        let resolution;
        let bleedingResolution = null;
        let replayCritical = null;
        let replayFollowUpCritical = null;
        let replayedTransaction;
        try {
            let criticalTarget = null;
            let replayCriticalWorkflow = null;
            if (criticalContext) {
                criticalTarget = context.targetActor ?? await fromUuid(criticalContext.targetUuid);
                const sourceActor = criticalContext.sourceActorUuid ? await fromUuid(criticalContext.sourceActorUuid) : actor;
                const consumedKeys = new Set((criticalContext.consumedPendingEffectIds ?? []).map((entry) => String(entry).split(":").at(-1)));
                replayCriticalWorkflow = game.l5r5e.critical.createWorkflow({
                    ...criticalContext,
                    target: criticalTarget,
                    sourceActor,
                    stance: criticalTarget?.system?.stance ?? criticalContext.stance,
                    modifiers: (criticalContext.modifiers ?? []).filter((modifier) => !consumedKeys.has(modifier.reason)),
                });
                if (changes.tn === undefined) {
                    context.tn = replayCriticalWorkflow.mitigationTn;
                    context.baseTn = replayCriticalWorkflow.mitigationTn;
                }
            }
            resolution = await game.l5r5e.rollResolution.resolve({ context, rawSymbols: previous.raw, opportunityPlan, decisions });
            if (resolution.status === "blocked") {
                await restorePrevious();
                ui.notifications.error(game.i18n.localize("l5r5e.automation.roll.blocked"));
                return resolution;
            }
            if (resolution.effects?.action?.damage?.requiresDefenseDecision && context.targetActor) {
                decisions.defense = { choice: await game.l5r5e.damage.requestDefense({ target: context.targetActor, damage: resolution.effects.action.damage }) };
                resolution = await game.l5r5e.rollResolution.resolve({ context, rawSymbols: previous.raw, opportunityPlan, decisions });
            }
            const mutations = await game.l5r5e.rollResolution.buildMutations(resolution, { actor, targetActor: context.targetActor, item });
            let createdDocuments = previous.transaction?.createdDocuments ?? [];
            if (replayCriticalWorkflow && criticalTarget) {
                const previousCritical = previous.effects?.action?.critical;
                const usedShatteringParry = Boolean(previousCritical?.shatteringParry);
                const weapon = usedShatteringParry ? await fromUuid(previousCritical.shatteringParry.weaponUuid) : null;
                const wornArmor = replayCriticalWorkflow.wornArmorUuid ? await fromUuid(replayCriticalWorkflow.wornArmorUuid) : null;
                const mitigation = { success: resolution.effective.success, bonusSuccesses: resolution.effective.bonusSuccesses };
                const sourceActor = replayCriticalWorkflow.sourceActorUuid ? await fromUuid(replayCriticalWorkflow.sourceActorUuid) : actor;
                const criticalInput = { ...replayCriticalWorkflow, target: criticalTarget, sourceActor, wornArmor, shatteringParryAvailable: usedShatteringParry, readiedWeapons: weapon ? [weapon] : [] };
                const criticalDecision = { ring: resolution.context.ring ?? replayCriticalWorkflow.stance, mitigation, ...(usedShatteringParry ? { shatteringParry: true, rerolledMitigation: mitigation, weapon } : {}) };
                replayCritical = game.l5r5e.critical.resolve(criticalInput, criticalDecision);
                let scarDecision = null;
                if (replayCritical.outcome?.scar) scarDecision = await game.l5r5e.critical.promptScarDecision({ targetUuid: criticalTarget.uuid, tier: replayCritical.outcome.scar.tier });
                const built = game.l5r5e.critical.buildMutations(replayCritical, { target: criticalTarget, workflow: replayCriticalWorkflow, scarDecision, weapon, wornArmor });
                mutations.push(...built.mutations);
                createdDocuments = built.createdDocuments;
                replayFollowUpCritical = built.followUpCritical;
                resolution.effects.action.critical = replayCritical;
                resolution.audit.push({ phase: "criticalWorkflowReplay", result: foundry.utils.deepClone(replayCritical) });
            }
            if (actor?.statuses?.has("bleeding") && resolution.strife?.gained > 0) {
                const canDefend = !game.l5r5e.conditions.isActive(actor, "incapacitated", context.lifecycle);
                bleedingResolution = game.l5r5e.damage.resolveBleeding({ actor, strifeReceived: resolution.strife.gained, canDefend });
                const choice = bleedingResolution.requiresDefenseDecision
                    ? await game.l5r5e.damage.requestDefense({ target: actor, damage: bleedingResolution })
                    : bleedingResolution.defenseChoice;
                bleedingResolution = game.l5r5e.damage.resolveBleeding({ actor, strifeReceived: resolution.strife.gained, canDefend, defenseChoice: choice });
                decisions.bleedingDefense = { choice };
                if (bleedingResolution.fatigue > 0) {
                    const before = Number(actor.system.fatigue.value) || 0;
                    mutations.push({ documentUuid: actor.uuid, path: "system.fatigue.value", before, after: Math.max(0, before + bleedingResolution.fatigue), reason: "bleeding" });
                }
                if (bleedingResolution.voidSpent > 0) {
                    const before = Number(actor.system.void_points.value) || 0;
                    mutations.push({ documentUuid: actor.uuid, path: "system.void_points.value", before, after: Math.max(0, before - bleedingResolution.voidSpent), reason: "declineDefense" });
                }
            }
            if (actionMutation) mutations.push(foundry.utils.deepClone(actionMutation));
            for (const effect of afterActionEffects) {
                if (effect.type !== "resource" || !actor?.uuid) continue;
                const before = Number(actor.system?.[effect.resource]?.value) || 0;
                mutations.push({ documentUuid: actor.uuid, path: `system.${effect.resource}.value`, before, after: Math.max(0, before + Number(effect.amount || 0)), reason: effect.reason ?? "afterAction" });
            }
            resolution.conditionEffects = afterActionEffects;
            if (previous.transaction) {
                const transactionReplay = await game.l5r5e.transactions.replay(previous.transaction, { inputs: { context: resolution.context, raw: previous.raw }, decisions, mutations, createdDocuments });
                if (!transactionReplay.ok) throw transactionReplay;
                replayedTransaction = transactionReplay.transaction;
            } else {
                replayedTransaction = game.l5r5e.transactions.create({ transactionId: resolution.transactionId, revision: resolution.revision, rollMessageUuid: message.uuid, inputs: { context: resolution.context, raw: previous.raw }, decisions, mutations, createdDocuments });
                const applied = await game.l5r5e.transactions.apply(replayedTransaction);
                if (!applied.ok) throw applied;
            }
        } catch (error) {
            await restorePrevious();
            ui.notifications.error(game.i18n.localize("l5r5e.automation.transaction.conflict"));
            if (error?.conflicts || error?.code) await this.showConflict(error);
            else console.error(error);
            return error;
        }
        resolution.transaction = replayedTransaction;
        resolution.status = "applied";
        const history = [...(message.flags?.l5r5e?.resolutionHistory ?? []), previous];
        const roll = message.rolls?.[0];
        if (roll?.l5r5e) roll.l5r5e.resolution = resolution;
        await message.update({
            "flags.l5r5e.resolution": resolution,
            "flags.l5r5e.resolutionHistory": history,
            "flags.l5r5e.relatedTransactions": [],
            "flags.l5r5e.relatedTransactionHistory": [...(message.flags?.l5r5e?.relatedTransactionHistory ?? []), ...related],
            ...(roll ? { rolls: [roll.toJSON()], content: await roll.render({}) } : {}),
        });
        if (actionMutation) {
            const combatant = await fromUuid(actionMutation.documentUuid);
            if (combatant) Hooks.callAll("l5r5e.turnStateChanged", combatant, actionMutation.after, { replayed: true, transactionId: resolution.transactionId });
            Hooks.callAll("l5r5e.actionResolved", resolution);
        }
        if (criticalContext?.parentRollMessageUuid) {
            const parent = await fromUuid(criticalContext.parentRollMessageUuid);
            if (parent) {
                const relatedTransactions = [...(parent.flags?.l5r5e?.relatedTransactions ?? [])];
                const index = relatedTransactions.findIndex((transaction) => transaction.transactionId === replayedTransaction.transactionId);
                if (index >= 0) relatedTransactions[index] = replayedTransaction;
                else relatedTransactions.push(replayedTransaction);
                await parent.update({ "flags.l5r5e.relatedTransactions": relatedTransactions });
            }
        }
        Hooks.callAll("l5r5e.rollResolutionChanged", message, resolution);
        const criticalWorkflows = [];
        const attackCritical = resolution.effects?.action?.damage?.critical;
        if (attackCritical?.required && context.targetActor) criticalWorkflows.push({ sourceActor: actor, target: context.targetActor, severity: attackCritical.severity, stance: context.targetActor.system?.stance, conflict: Boolean(game.combat?.started), razorEdged: game.l5r5e.qualities.has(item, "razor-edged"), sourceItem: item, parentTransactionId: resolution.transactionId });
        if (bleedingResolution?.critical?.required && actor) criticalWorkflows.push({ sourceActor: actor, target: actor, severity: bleedingResolution.critical.severity, stance: actor.system?.stance, conflict: Boolean(game.combat?.started), parentTransactionId: resolution.transactionId });
        for (const directCritical of resolution.effects?.action?.directCriticals ?? []) {
            const targetDocument = directCritical.targetUuid ? await fromUuid(directCritical.targetUuid) : context.targetActor;
            const directTarget = targetDocument?.actor ?? targetDocument;
            if (directTarget) criticalWorkflows.push({ sourceActor: actor, target: directTarget, severity: directCritical.severity, stance: directTarget.system?.stance, conflict: Boolean(game.combat?.started), razorEdged: game.l5r5e.qualities.has(item, "razor-edged"), sourceItem: item, parentTransactionId: resolution.transactionId });
        }
        if (replayFollowUpCritical && actor) criticalWorkflows.push({ sourceActor: actor, target: actor, severity: replayFollowUpCritical.severity, stance: actor.system?.stance, conflict: Boolean(game.combat?.started), parentTransactionId: resolution.transactionId });
        for (const workflow of criticalWorkflows) await game.l5r5e.critical.startWorkflow({ ...workflow, parentRollMessageUuid: message.uuid });
        return resolution;
    }

    static reopenOpportunity(message) {
        const dialog = new game.l5r5e.RollnKeepDialog(message.id);
        const resolution = this.resolution(message);
        for (const selection of resolution?.opportunities?.selections ?? []) {
            dialog.object.opportunitySpend[selection.rulesKey] = selection.cost;
            dialog.object.opportunityDecisions[selection.rulesKey] = selection.decision ?? {};
        }
        dialog.object.opportunityPanelOpen = true;
        return dialog.render(true);
    }

    static async showHistory(message) {
        const history = { resolutions: [...(message.flags?.l5r5e?.resolutionHistory ?? []), this.resolution(message)].filter(Boolean), relatedTransactions: [...(message.flags?.l5r5e?.relatedTransactionHistory ?? []), ...(message.flags?.l5r5e?.relatedTransactions ?? [])] };
        const escaped = foundry.utils.escapeHTML(JSON.stringify(history, null, 2));
        return foundry.applications.api.DialogV2.prompt({
            window: { title: game.i18n.localize("l5r5e.automation.gm.history") },
            content: `<pre class="l5r5e-resolution-history">${escaped}</pre>`,
            ok: { label: "Close", callback: () => true },
        });
    }

    static async showConflict(conflict) {
        const escaped = foundry.utils.escapeHTML(JSON.stringify(conflict, null, 2));
        return foundry.applications.api.DialogV2.prompt({
            window: { title: game.i18n.localize("l5r5e.automation.transaction.conflictTitle") },
            content: `<p>${game.i18n.localize("l5r5e.automation.transaction.conflictDiff")}</p><pre class="l5r5e-resolution-history">${escaped}</pre>`,
            ok: { label: "Close", callback: () => true },
        });
    }
}
