import { HelpersL5r5e } from "../helpers.js";
import { OpportunityWindow } from "./opportunity-window.js";

/**
 * L5R Dice Roll n Keep dialog
 * @extends {FormApplication}
 */
export class RollnKeepDialog extends FormApplication {
    /**
     * Player choice list
     */
    static CHOICES = {
        discard: "discard",
        keep: "keep",
        nothing: null,
        reroll: "reroll",
        // reserve: "reserve",
        swap: "swap",
    };

    /**
     * The current ChatMessage where we come from
     * @param {ChatMessage} message
     */
    _message = null;

    /**
     * The current Roll
     * @param {RollL5r5e} roll
     */
    roll = null;
    _reservationFinalized = false;
    _opportunityWindows = new Map();

    /**
     * Payload Object
     */
    object = {
        currentStep: 0,
        submitDisabled: false,
        opportunitySpend: {},
        opportunityDecisions: {},
        availableOpportunities: [],
        swapDiceFaces: {
            rings: [],
            skills: [],
        },
        dicesList: [[]],
    };

    /**
     * Assign the default options
     * @override
     */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "l5r5e-roll-n-keep-dialog",
            classes: ["l5r5e", "roll-n-keep-dialog"],
            template: CONFIG.l5r5e.paths.templates + "dice/roll-n-keep-dialog.html",
            title: game.i18n.localize("l5r5e.dice.roll_n_keep.title"),
            closeOnSubmit: false,
        });
    }

    /**
     * Define a unique and dynamic element ID for the rendered application
     */
    get id() {
        return `l5r5e-roll-n-keep-dialog-${this._message.id}`;
    }

    /**
     * ChatMessage
     * @param {ChatMessage} msg
     */
    set message(msg) {
        this._message = msg instanceof ChatMessage ? msg : null;
    }

    /**
     * ChatMessage
     * @returns {ChatMessage}
     */
    get message() {
        return this._message;
    }

    /**
     * Current (first) Roll in ChatMessage
     * @returns {RollL5r5e}
     */
    get messageRoll() {
        return this._message?.rolls?.[0] || null;
    }

    /**
     * Return true if this actor has right on this roll
     * @return {boolean}
     */
    get isOwner() {
        return this._message?.isAuthor || this.messageRoll?.l5r5e.actor?.isOwner || this._message?.isOwner || false;
    }

    /**
     * Create the Roll n Keep dialog
     * @param {number} messageId
     * @param {FormApplicationOptions} options
     */
    constructor(messageId, options = {}) {
        super({}, options);
        this.message = game.messages.get(messageId);
        this.options.editable = this.isOwner;

        this._initializeDiceFaces();
        this._initializeHistory();
    }

    /**
     * Refresh data (used from socket)
     */
    async refresh() {
        if (!this._message) {
            return;
        }
        this._initializeHistory();
        this.render(false);
    }

    /**
     * Render
     * @param {boolean} force
     * @param  {{left?: number, top?: number, width?: number, height?: number, scale?: number, focus?: boolean, renderContext?: string, renderData?: Object}} options
     * @returns {Application}
     * @override
     */
    render(force = false, options = {}) {
        if (!this._message) {
            return;
        }
        this.position.width = "auto";
        this.position.height = "auto";
        return super.render(force, options);
    }

    /**
     * Initialize the dice history list
     * @private
     */
    _initializeHistory() {
        if (!this._message) {
            return;
        }

        // Get the roll
        this.roll = this.messageRoll;

        // Already history
        if (Array.isArray(this.roll.l5r5e.history)) {
            this.object.dicesList = this.roll.l5r5e.history;

            let currentStep = this.roll.l5r5e.history.length - 1;
            if (!this._haveChoice(currentStep, RollnKeepDialog.CHOICES.nothing)) {
                currentStep += 1;
            }
            this.object.currentStep = currentStep;
            this._updateSummaryFromChoices();
            return;
        }

        // New
        this.object.dicesList = [[]];
        this.roll.terms.forEach((term) => {
            if (!(term instanceof game.l5r5e.L5rBaseDie)) {
                return;
            }
            term.results.forEach((res) => {
                this.object.dicesList[0].push({
                    type: term.constructor.name,
                    face: res.result,
                    choice: this._getDefaultChoiceForDie(term.constructor.name, res.result),
                });
            });
        });

        this._updateSummaryFromChoices();
    }

    /**
     * Fill the dices faces
     * @private
     */
    _initializeDiceFaces() {
        // All faces are unique for rings
        this.object.swapDiceFaces.rings = Object.keys(game.l5r5e.RingDie.FACES);

        // Only unique for Skills
        this.object.swapDiceFaces.skills = [1, 3, 6, 8, 10, 11, 12];
    }

    /**
     * Create drag-and-drop workflow handlers for this Application
     * @return An array of DragDrop handlers
     */
    _createDragDropHandlers() {
        return [
            new foundry.applications.ux.DragDrop.implementation({
                dragSelector: ".dice.draggable",
                dropSelector: ".dropbox",
                permissions: { dragstart: this.isEditable, drop: this.isEditable },
                callbacks: { dragstart: this._onDragStart.bind(this), drop: this._onDropItem.bind(this) },
            }),
        ];
    }

    /**
     * Callback actions which occur at the beginning of a drag start workflow.
     * @param {DragEvent} event	The originating DragEvent
     */
    _onDragStart(event) {
        const target = $(event.currentTarget);
        event.dataTransfer.setData(
            "text/plain",
            JSON.stringify({
                step: target.data("step"),
                die: target.data("die"),
            })
        );
    }

    /**
     * Construct and return the data object used to render the HTML template for this form application.
     * @param options
     * @return {Object}
     */
    async getData(options = null) {
        this._updateSummaryFromChoices();
        const rollData = this.roll.l5r5e;

        // Disable submit / edition
        this.options.classes = this.options.classes.filter((e) => e !== "finalized");
        this.object.submitDisabled = false;
        await this._prepareOpportunityData();

        const applyFlags = foundry.utils.mergeObject(
            {
                strifeToCharacter: false,
                fatigueToCharacter: false,
                strifeToTarget: false,
                fatigueToTarget: false,
            },
            rollData.applyFlags || {},
            { inplace: false }
        );
        rollData.applyFlags = applyFlags;

        const actor = rollData.actor || null;
        const targetActor = rollData.target?.actor || null;
        const canApplyStrifeToCharacter = false;
        const canApplyFatigueToCharacter = applyFlags.fatigueToCharacter && !!actor;
        const canApplyStrifeToTarget = applyFlags.strifeToTarget && !!targetActor;
        const canApplyFatigueToTarget = applyFlags.fatigueToTarget && !!targetActor;
        const hasApplyOptions =
            canApplyStrifeToCharacter || canApplyFatigueToCharacter || canApplyStrifeToTarget || canApplyFatigueToTarget;

        rollData.hasAppliedResults =
            (rollData.strifeApplied || 0) > 0 ||
            (rollData.fatigueApplied || 0) > 0 ||
            (rollData.targetStrifeApplied || 0) > 0 ||
            (rollData.targetFatigueApplied || 0) > 0;

        if (this._checkKeepCount(this.object.currentStep)) {
            const kept = this._getKeepCount(this.object.currentStep);
            this.object.submitDisabled = kept < 1 || kept > rollData.keepLimit;
        } else if (!this.object.dicesList[this.object.currentStep]) {
            delete this.roll.l5r5e._bleedingFatigueDefault;

            const canEditResults = true;
            this.options.editable = this.isOwner && canEditResults;
            this.options.classes.push("finalized");
        }

        const isEditable = options?.editable ?? this.options.editable;

        return {
            ...(await super.getData(options)),
            isGM: game.user.isGM,
            showChoices: isEditable && !rollData.rnkEnded,
            showFinalSubmit: isEditable && rollData.rnkEnded,
            showApplyResults: isEditable && hasApplyOptions,
            applyOptions: {
                strifeToCharacter: canApplyStrifeToCharacter,
                fatigueToCharacter: canApplyFatigueToCharacter,
                strifeToTarget: canApplyStrifeToTarget,
                fatigueToTarget: canApplyFatigueToTarget,
            },
            cssClass: this.options.classes.join(" "),
            data: this.object,
            l5r5e: rollData,
            resolutionPreview: rollData.resolutionPreview,
        };
    }

    async close(options = {}) {
        const windows = [...this._opportunityWindows.values()];
        this._opportunityWindows.clear();
        await Promise.all(windows.map((window) => window.close({ parentClosing: true })));
        const reservation = this.roll?.l5r5e?.actionReservation;
        if (reservation && !this._reservationFinalized && this.isOwner) {
            const combatant = await fromUuid(reservation.combatantUuid);
            if (combatant) await game.l5r5e.actions.cancel(combatant, reservation.reservationId, reservation.lifecycle);
            this._reservationFinalized = true;
        }
        return super.close(options);
    }

    openOpportunityWindow(mode) {
        if (!this.isOwner && mode === "spend") return null;
        const existing = this._opportunityWindows.get(mode);
        if (existing) {
            existing.bringToFront?.();
            existing.render(false);
            return existing;
        }
        const window = new OpportunityWindow(this, mode);
        this._opportunityWindows.set(mode, window);
        window.render(true);
        return window;
    }

    _forgetOpportunityWindow(mode, window) {
        if (this._opportunityWindows.get(mode) === window) this._opportunityWindows.delete(mode);
    }

    _refreshOpportunityWindows() {
        for (const window of this._opportunityWindows.values()) window.render(false);
    }

    getOpportunityWindowContext(mode) {
        const preview = this.roll?.l5r5e?.resolutionPreview ?? {};
        const errors = (preview.validationErrors ?? []).map((error) => {
            const key = `l5r5e.automation.opportunity.error.${error.code ?? error.key ?? "blocked"}`;
            return game.i18n.has?.(key) ? game.i18n.format(key, error) : `${error.code ?? error.key ?? "blocked"}`;
        });
        return {
            mode,
            referenceMode: mode === "reference",
            spendMode: mode === "spend",
            opportunities: this.object.availableOpportunities,
            budget: { generated: preview.generatedOpportunity ?? 0, spent: preview.spentOpportunity ?? 0, remaining: preview.remainingOpportunity ?? 0 },
            errors,
            valid: errors.length === 0,
        };
    }

    setOpportunitySelected(key, selected) {
        const definition = this.object.availableOpportunities.find((entry) => entry.rulesKey === key);
        if (!definition) return;
        this.object.opportunitySpend[key] = selected ? Number(definition.cost.base) || 1 : 0;
        this.render(false);
    }

    adjustOpportunitySpend(key, direction) {
        const definition = this.object.availableOpportunities.find((entry) => entry.rulesKey === key);
        if (!definition?.cost?.scalable) return;
        const base = Number(definition.cost.base) || 1;
        const increment = Math.max(1, Number(definition.cost.increment) || 1);
        const maximum = definition.cost.maxSpend ?? this.roll?.l5r5e?.summary?.opportunity ?? base;
        const current = Number(this.object.opportunitySpend[key]) || 0;
        const next = current === 0 && direction > 0 ? base : current + Math.sign(direction) * increment;
        this.object.opportunitySpend[key] = Math.max(0, Math.min(maximum, next));
        this.render(false);
    }

    setOpportunityDecision(key, field, value) {
        const decision = { ...(this.object.opportunityDecisions[key] ?? {}) };
        if (field === "targetUuids") {
            decision.targetUuids = value;
            delete decision.targetUuid;
        } else {
            decision[field] = value || undefined;
            if (field === "targetUuid") delete decision.targetUuids;
        }
        this.object.opportunityDecisions[key] = decision;
        this.render(false);
    }

    _resolutionContext() {
        const rollData = this.roll?.l5r5e ?? {};
        const actionTypes = rollData.actionTypes ?? Object.entries(rollData.actions ?? {}).filter(([, active]) => active).map(([type]) => type);
        const combat = game.combat;
        const combatant = combat?.combatants?.find((entry) => entry.actor?.uuid === rollData.actor?.uuid);
        return {
            actor: rollData.actor,
            target: rollData.target,
            targetActor: rollData.target?.actor,
            item: rollData.item,
            ring: rollData.stance,
            stance: rollData.stance,
            skillId: rollData.skillId,
            skillGroup: rollData.skillCatId,
            conflictType: rollData.conflictType,
            techniqueType: rollData.item?.system?.technique_type,
            directOpportunityKeys: rollData.item?.system?.activation?.opportunity_rules_keys ?? [],
            unarmedProfile: rollData.rollContext?.unarmedProfile ?? rollData.unarmedProfile,
            actionId: rollData.actionId ?? rollData.rollContext?.actionId ?? null,
            attackProfileSnapshot: rollData.rollContext?.attackProfileSnapshot ?? null,
            actionTypes,
            initiative: Boolean(rollData.isInitiativeRoll),
            checkKind: rollData.isInitiativeRoll ? "initiative" : "skill",
            baseTn: rollData.baseDifficulty ?? rollData.difficulty,
            tn: rollData.difficulty,
            requiresCheck: true,
            isCheck: true,
            lifecycle: combat ? { combatId: combat.id, round: combat.round, turn: combat.turn } : {},
            conditionSuspensionExpiry: combat ? { round: Number(combat.round ?? 0) + 1, turn: Number(combat.turn ?? 0) } : { sceneEnd: true },
            turnState: combatant ? game.l5r5e.turns.getState(combatant) : null,
        };
    }

    async _prepareOpportunityData() {
        const rollData = this.roll?.l5r5e;
        if (!rollData?.summary) return;
        const raw = {
            success: Number(rollData.summary.success) || 0,
            explosive: Number(rollData.summary.explosive) || 0,
            opportunity: Number(rollData.summary.opportunity) || 0,
            strife: Number(rollData.summary.strife) || 0,
        };
        const preview = game.l5r5e.rollResolution.preview(this._resolutionContext(), raw);
        const available = await game.l5r5e.opportunities.available({ ...preview.context, provisionalSuccess: preview.provisionalSuccess });
        const targetDocuments = [rollData.target, ...game.user.targets].map((target) => target?.document ?? target).filter(Boolean);
        const targetChoices = [...new Map(targetDocuments.map((target) => [target.uuid, { value: target.uuid, label: target.name ?? target.actor?.name ?? target.uuid }])).values()];
        this.object.availableOpportunities = available.map((definition) => {
            const selectedSpend = Number(this.object.opportunitySpend[definition.rulesKey]) || 0;
            const decision = this.object.opportunityDecisions[definition.rulesKey] ?? {};
            return {
                ...definition,
                selectedSpend,
                selected: selectedSpend > 0,
                selectedCondition: decision.condition ?? "",
                selectedRing: decision.ring ?? "",
                ringChoice: Boolean(definition.requirements?.ringChoice),
                rings: ["air", "earth", "fire", "water"].map((ring) => ({ value: ring, label: game.i18n.localize(`l5r5e.rings.${ring}`) })),
                selectedTargetUuid: decision.targetUuid ?? rollData.target?.uuid ?? "",
                targetChoice: ["single", "multiple", "gm"].includes(definition.target?.mode),
                multipleTargets: definition.target?.mode === "multiple",
                targetChoices,
                reachable: definition.cost.base <= raw.opportunity,
                conditionChoice: Boolean(definition.requirements?.conditionChoice),
                conditions: [...(rollData.actor?.statuses ?? [])].map((condition) => ({ value: condition, label: condition })),
            };
        });
        const currentPlan = Object.entries(this.object.opportunitySpend).filter(([, value]) => Number(value) > 0).map(([rulesKey, value]) => ({ rulesKey, spend: Number(value) }));
        const currentDecisions = Object.fromEntries(currentPlan.map(({ rulesKey }) => [rulesKey, { ...(this.object.opportunityDecisions[rulesKey] ?? {}), targetUuid: this.object.opportunityDecisions[rulesKey]?.targetUuid ?? rollData.target?.uuid ?? undefined }]));
        const validation = game.l5r5e.opportunities.validatePlan(available, currentPlan, raw.opportunity, currentDecisions);
        this.object.opportunityValidation = validation;
        const currentResolution = await game.l5r5e.rollResolution.resolve({ context: this._resolutionContext(), rawSymbols: raw, opportunityPlan: currentPlan, decisions: currentDecisions });
        rollData.resolutionPreview = {
            rawSuccesses: preview.totalSuccess,
            success: preview.provisionalSuccess,
            rawBonusSuccesses: preview.rawBonusSuccesses,
            fireBonusSuccesses: preview.fireBonusSuccesses,
            bonusSuccesses: preview.bonusSuccesses,
            rawStrife: raw.strife,
            generatedOpportunity: raw.opportunity,
            spentOpportunity: validation.spent,
            remainingOpportunity: validation.remaining,
            validationErrors: currentResolution.status === "blocked" ? currentResolution.errors ?? [{ code: currentResolution.reason ?? "blocked" }] : [],
        };
        rollData.resolutionPreview.strifeLedger = currentResolution.strife ?? game.l5r5e.conditions.calculateStrife({ actor: rollData.actor, stance: rollData.stance, rawKeptStrife: raw.strife });
        this.object.submitDisabled ||= Boolean(rollData.rnkEnded) && currentResolution.status === "blocked";
        queueMicrotask(() => this._refreshOpportunityWindows());
    }

    /**
     * Recompute the current summary based on the selected dice.
     * @private
     */
    _updateSummaryFromChoices() {
        const rollData = this.roll?.l5r5e;
        if (!rollData || !Array.isArray(this.object?.dicesList)) {
            return;
        }

        const summary = rollData.summary ?? {};
        summary.success = 0;
        summary.explosive = 0;
        summary.opportunity = 0;
        summary.strife = 0;
        summary.totalSuccess = 0;

        this.object.dicesList.forEach((step, stepIdx) => {
            if (!Array.isArray(step)) {
                return;
            }

            const haveReroll =
                stepIdx > 0 &&
                this._haveChoice(stepIdx - 1, [RollnKeepDialog.CHOICES.reroll, RollnKeepDialog.CHOICES.swap]);

            step.forEach((die) => {
                if (!die) {
                    return;
                }

                const includeDie =
                    die.choice === RollnKeepDialog.CHOICES.keep ||
                    (haveReroll && die.choice === RollnKeepDialog.CHOICES.nothing);
                if (!includeDie) {
                    return;
                }

                const faceValue = die.newFace ?? die.face;
                const dieFaces = game.l5r5e?.[die.type]?.FACES;
                const faceData = dieFaces?.[faceValue];
                if (!faceData) {
                    return;
                }

                summary.success += Number(faceData.success) || 0;
                summary.explosive += Number(faceData.explosive) || 0;
                summary.opportunity += Number(faceData.opportunity) || 0;
                summary.strife += Number(faceData.strife) || 0;
            });
        });

        summary.totalSuccess = summary.success + summary.explosive;
        summary.baseTotalSuccess = summary.totalSuccess;

        const difficulty = Number(rollData.difficulty ?? 0);
        let totalBonus = Math.max(0, summary.totalSuccess - difficulty);
        if (rollData.stance === "fire" && summary.baseTotalSuccess >= difficulty) {
            totalBonus += summary.strife;
        }
        summary.totalBonus = totalBonus;
    }

    /**
     * Listen to html elements
     * @param {jQuery} html HTML content of the sheet.
     * @override
     */
    activateListeners(html) {
        super.activateListeners(html);

        // GM Only, need to be before the editable check
        if (game.user.isGM && this.object.currentStep > 0) {
            // Add Context menu to rollback choices
            new foundry.applications.ux.ContextMenu.implementation(html[0], ".l5r5e.profil", [
                {
                    name: game.i18n.localize("l5r5e.dice.roll_n_keep.undo"),
                    icon: '<i class="fas fa-undo"></i>',
                    callback: () => this._undoLastStepChoices(),
                },
            ], { jQuery: false });
        }

        // Open journal on effect name
        html.find(".effect-name").on("click", this._openEffectJournal.bind(this));
        html.find(".toggle-opportunities").on("click", (event) => {
            event.preventDefault();
            this.openOpportunityWindow(event.currentTarget.dataset.mode ?? (this.roll?.l5r5e?.rnkEnded ? "spend" : "reference"));
        });
        html.find(".back-to-dice").on("click", (event) => {
            event.preventDefault();
            this._undoLastStepChoices();
        });

        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.isEditable) {
            return;
        }

        // Finalize Button
        html.find("#finalize").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!this.object.submitDisabled) {
                this.submit();
            }
        });

        const registerValuePicker = (field) => {
            const group = html.find(`.apply-value[data-field="${field}"]`);
            if (!group.length) {
                return;
            }

            const input = group.find(`input[name="${field}"]`);
            if (!input.length) {
                return;
            }

            const minAttr = group.data("min");
            const maxAttr = group.data("max");
            const min = Number.isNaN(Number(minAttr)) ? 0 : Number(minAttr);
            const max = maxAttr !== undefined && !Number.isNaN(Number(maxAttr)) ? Number(maxAttr) : undefined;

            const clamp = (value) => {
                let sanitized = Number.isNaN(value) ? min : Math.round(value);
                sanitized = Math.max(min, sanitized);
                if (max !== undefined) {
                    sanitized = Math.min(max, sanitized);
                }
                return sanitized;
            };

            const applyValue = (value) => {
                const sanitized = clamp(value);
                input.val(sanitized);
            };

            input.on("change", (event) => {
                const target = event.currentTarget ?? event.target ?? input[0];
                applyValue(Number(target?.value));
            });

            html.find(`.apply-adjust[data-field="${field}"]`).on("click", (event) => {
                event.preventDefault();
                const delta = Number(event.currentTarget.dataset.delta) || 0;
                const current = Number(input.val()) || 0;
                applyValue(current + delta);
                input.trigger("change");
            });

            applyValue(Number(input.val()));
        };

        ["strifeApplied", "fatigueApplied", "targetStrifeApplied", "targetFatigueApplied"].forEach((field) =>
            registerValuePicker(field)
        );

        const diceSelector = ".dice.draggable";
        html.find(diceSelector).on("click", this._onDiceKeep.bind(this));
        html.find(diceSelector).on("contextmenu", this._onDiceDiscard.bind(this));
    }

    /**
     * Handle dropped items
     */
    async _onDropItem(event) {
        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.isEditable) {
            return;
        }

        const type = $(event.currentTarget).data("type");
        const json = event.dataTransfer.getData("text/plain");
        if (!json || !Object.values(RollnKeepDialog.CHOICES).some((e) => !!e && e === type)) {
            return;
        }

        const data = JSON.parse(json);
        if (!data) {
            return;
        }

        const current = this.object.dicesList[data.step][data.die];
        delete current.newFace;

        switch (type) {
            case RollnKeepDialog.CHOICES.swap: {
                // Dice Type Ring/Skill
                const diceType = $(event.currentTarget).data("die");
                const diceNewFace = $(event.currentTarget).data("face");

                if (current.type !== diceType || current.face === diceNewFace) {
                    current.choice = RollnKeepDialog.CHOICES.nothing;
                    this.render(false);
                    return false;
                }

                current.newFace = diceNewFace;
                this._forceChoiceForDiceWithoutOne(RollnKeepDialog.CHOICES.keep);
                break;
            }

            case RollnKeepDialog.CHOICES.reroll:
                // If reroll, we need to keep all the line by default
                this._forceChoiceForDiceWithoutOne(RollnKeepDialog.CHOICES.keep);
                break;
        }

        current.choice = type;

        // Little time saving : if we reach the max kept dices, discard all dices without a choice
        if (
            this._checkKeepCount(this.object.currentStep) &&
            this._getKeepCount(this.object.currentStep) === this.roll.l5r5e.keepLimit
        ) {
            this._forceChoiceForDiceWithoutOne(RollnKeepDialog.CHOICES.discard);
        }

        this.render(false);
        return false;
    }

    /**
     * Handle a direct dice selection to keep it
     * @param {MouseEvent} event
     * @returns {boolean}
     * @private
     */
    _onDiceKeep(event) {
        return this._onDiceDirectSelection(event, RollnKeepDialog.CHOICES.keep);
    }

    /**
     * Handle a direct dice selection to discard it
     * @param {MouseEvent} event
     * @returns {boolean}
     * @private
     */
    _onDiceDiscard(event) {
        return this._onDiceDirectSelection(event, RollnKeepDialog.CHOICES.discard);
    }

    /**
     * Apply a direct dice selection choice
     * @param {MouseEvent} event
     * @param {string} choice
     * @returns {boolean}
     * @private
     */
    _onDiceDirectSelection(event, choice) {
        event.preventDefault();
        event.stopPropagation();

        const target = event.currentTarget;
        const step = Number(target.dataset.step);
        const dieIndex = Number(target.dataset.die);

        if (!Number.isInteger(step) || !Number.isInteger(dieIndex)) {
            return false;
        }

        if (step !== this.object.currentStep) {
            return false;
        }

        const die = this.object.dicesList?.[step]?.[dieIndex];
        if (!die) {
            return false;
        }

        delete die.newFace;
        die.choice = choice;

        if (
            choice === RollnKeepDialog.CHOICES.keep &&
            this._checkKeepCount(step) &&
            this._getKeepCount(step) === this.roll.l5r5e.keepLimit
        ) {
            this._forceChoiceForDiceWithoutOne(RollnKeepDialog.CHOICES.discard);
        }

        this.render(false);
        return false;
    }

    /**
     * Return the current number of dices kept
     * @private
     */
    _getKeepCount(step) {
        return this.object.dicesList[step].reduce((acc, die) => {
            if (
                !!die &&
                [RollnKeepDialog.CHOICES.keep, RollnKeepDialog.CHOICES.reroll, RollnKeepDialog.CHOICES.swap].includes(
                    die.choice
                )
            ) {
                acc = acc + 1;
            }
            return acc;
        }, 0);
    }

    /**
     * Return true if a "_getKeepCount" is needed
     * @param {number} step
     * @returns {boolean}
     * @private
     */
    _checkKeepCount(step) {
        return (
            !this._haveChoice(step, [RollnKeepDialog.CHOICES.reroll, RollnKeepDialog.CHOICES.swap]) &&
            (step === 0 || this._haveChoice(step - 1, [RollnKeepDialog.CHOICES.reroll, RollnKeepDialog.CHOICES.swap]))
        );
    }

    /**
     * Return true if this choice exist in the current step
     * @param {number}          currentStep
     * @param {string|string[]} choices
     * @return {boolean}
     * @private
     */
    _haveChoice(currentStep, choices) {
        if (!Array.isArray(choices)) {
            choices = [choices];
        }
        return (
            this.object.dicesList[currentStep] &&
            this.object.dicesList[currentStep].some((e) => !!e && choices.includes(e.choice))
        );
    }

    /**
     * Discard all dices without a choice for the current step
     * @param {string} newChoice
     * @private
     */
    _forceChoiceForDiceWithoutOne(newChoice) {
        this.object.dicesList[this.object.currentStep]
            .filter((e) => !!e)
            .map((e) => {
                if (e.choice === RollnKeepDialog.CHOICES.nothing) {
                    e.choice = newChoice;
                }
                return e;
            });
    }

    /**
     * Initialize dice array for "step" if needed
     * @param {number} step
     * @private
     */
    _initializeDicesListStep(step) {
        if (!this.object.dicesList[step]) {
            this.object.dicesList[step] = Array(this.object.dicesList[0].length).fill(null);
        }
    }

    /**
     * Apply all choices to build the next step
     * @returns {Promise<void>}
     * @private
     */
    async _applyChoices() {
        let nextStep = this.object.currentStep + 1;
        const haveReroll = this._haveChoice(this.object.currentStep, [
            RollnKeepDialog.CHOICES.reroll,
            RollnKeepDialog.CHOICES.swap,
        ]);

        // Foreach kept dices, apply choices
        const newRolls = {};
        this.object.dicesList[this.object.currentStep].forEach((die, idx) => {
            if (!die) {
                return;
            }

            const currentRow = this.object.dicesList[this.object.currentStep][idx];

            switch (die.choice) {
                case RollnKeepDialog.CHOICES.keep:
                    if (haveReroll) {
                        // Reroll line add all kept into a new line
                        this._initializeDicesListStep(nextStep);
                        this.object.dicesList[nextStep][idx] = foundry.utils.duplicate(currentRow);
                        this.object.dicesList[nextStep][idx].choice = RollnKeepDialog.CHOICES.nothing;
                        currentRow.choice = RollnKeepDialog.CHOICES.discard;
                    } else if (game.l5r5e[die.type].FACES[die.face].explosive) {
                        // Exploding dice : add a new dice in the next step
                        if (!newRolls[die.type]) {
                            newRolls[die.type] = 0;
                        }
                        newRolls[die.type] += 1;
                    }
                    break;

                case RollnKeepDialog.CHOICES.reroll:
                    // Reroll : add a new dice in the next step
                    if (!newRolls[die.type]) {
                        newRolls[die.type] = 0;
                    }
                    newRolls[die.type] += 1;
                    break;

                case RollnKeepDialog.CHOICES.swap:
                    // FaceSwap : add a new dice with selected face in next step
                    this._initializeDicesListStep(nextStep);
                    this.object.dicesList[nextStep][idx] = {
                        type: currentRow.type,
                        face: currentRow.newFace,
                        choice: RollnKeepDialog.CHOICES.nothing,
                    };
                    delete currentRow.newFace;
                    break;
            }
        });

        // If new rolls, roll and add them
        if (Object.keys(newRolls).length > 0) {
            const newRollsResults = await this._newRoll(newRolls);
            this._initializeDicesListStep(nextStep);

            this.object.dicesList[this.object.currentStep].forEach((die, idx) => {
                if (!die) {
                    return;
                }
                if (
                    die.choice === RollnKeepDialog.CHOICES.reroll ||
                    (!haveReroll &&
                        die.choice === RollnKeepDialog.CHOICES.keep &&
                        game.l5r5e[die.type].FACES[die.face].explosive)
                ) {
                    this.object.dicesList[nextStep][idx] = newRollsResults[die.type].shift();
                }
            });
        }
    }

    /**
     * Transform a array (of int or object) into a formula ring/skill
     * @param rolls
     * @returns {string}
     * @private
     */
    _arrayToFormula(rolls) {
        const formula = [];
        if (rolls["RingDie"]) {
            const rings = Array.isArray(rolls["RingDie"]) ? rolls["RingDie"].length : rolls["RingDie"];
            formula.push(rings + "dr");
        }
        if (rolls["AbilityDie"]) {
            const skills = Array.isArray(rolls["AbilityDie"]) ? rolls["AbilityDie"].length : rolls["AbilityDie"];
            formula.push(skills + "ds");
        }
        if (formula.length < 1) {
            return "";
        }
        return formula.join("+");
    }

    /**
     * Roll all new dice at once (better performance) and return the result
     * @private
     */
    async _newRoll(newRolls) {
        const out = {
            RingDie: [],
            AbilityDie: [],
        };

        const roll = await new game.l5r5e.RollL5r5e(this._arrayToFormula(newRolls));
        await roll.roll();

        // Show DsN dice for the new roll
        if (game.dice3d !== undefined) {
            await game.dice3d.showForRoll(
                roll,
                game.user,
                true,
                this._message.whisper.length === 0 ? null : this._message.whisper,
                this._message.blind
            );
        }

        roll.terms.forEach((term) => {
            if (!(term instanceof game.l5r5e.L5rBaseDie)) {
                return;
            }
            term.results.forEach((res) => {
                out[term.constructor.name].push({
                    type: term.constructor.name,
                    face: res.result,
                    choice: this._getDefaultChoiceForDie(term.constructor.name, res.result),
                });
            });
        });

        return out;
    }

    /**
     * Return the default choice for a die face based on the actor state.
     * @param {string} dieType
     * @param {number} dieFace
     * @returns {string|null}
     * @private
     */
    _getDefaultChoiceForDie() {
        return RollnKeepDialog.CHOICES.nothing;
    }

    /**
     * Check if the actor linked to the roll is compromised.
     * @returns {boolean}
     * @private
     */
    _isActorCompromised() {
        const actor = this.roll?.l5r5e?.actor;
        if (!actor) {
            return false;
        }

        const statuses = actor.statuses;
        return typeof statuses?.has === "function" ? statuses.has("compromised") : false;
    }

    /**
     * Rebuild the message roll
     * @param {boolean} forceKeep If true keep all dice regardless their choice
     * @returns {Promise<void>}
     * @private
     */
    async _rebuildRoll(forceKeep = false) {
        // Get all kept dices + new (choice null)
        const diceList = this.object.dicesList.reduce((acc, step, stepIdx) => {
            const haveReroll =
                stepIdx > 0 &&
                this._haveChoice(stepIdx - 1, [RollnKeepDialog.CHOICES.reroll, RollnKeepDialog.CHOICES.swap]);
            step.forEach((die, idx) => {
                if (
                    !!die &&
                    (forceKeep ||
                        die.choice === RollnKeepDialog.CHOICES.keep ||
                        (haveReroll && die.choice === RollnKeepDialog.CHOICES.nothing))
                ) {
                    if (!acc[die.type]) {
                        acc[die.type] = [];
                    }
                    // Check previous dice, to add html classes in chat
                    if (stepIdx > 0 && this.object.dicesList[stepIdx - 1][idx]) {
                        switch (this.object.dicesList[stepIdx - 1][idx].choice) {
                            case RollnKeepDialog.CHOICES.reroll:
                                die.class = "rerolled";
                                break;
                            case RollnKeepDialog.CHOICES.swap:
                                die.class = "swapped";
                                break;
                        }
                    }
                    acc[die.type].push(die);
                }
            });
            return acc;
        }, {});

        // Re create a new roll
        const roll = await new game.l5r5e.RollL5r5e(this._arrayToFormula(diceList));
        roll.l5r5e = {
            ...this.roll.l5r5e,
            summary: roll.l5r5e.summary,
            history: this.object.dicesList,
        };

        // Fill the data
        await roll.evaluate();

        // Modify results
        roll.terms.map((term) => {
            if (term instanceof game.l5r5e.L5rBaseDie) {
                term.results.map((res) => {
                    const die = diceList[term.constructor.name].shift();
                    res.result = die.face;

                    // add class to term result
                    if (die.class) {
                        res[die.class] = true;
                    }
                    return res;
                });
                term.l5rSummary();
            }
            return term;
        });

        // Recompute summary
        roll.l5rSummary();

        // Add roll & history to message
        this.roll = roll;
    }

    /**
     * Send the new roll in chat and delete the old message
     * @returns {Promise<void>}
     * @private
     */
    async _toChatMessage() {
        // Keep old Ids
        const appOldId = this.id;
        const msgOldId = this._message.id;

        if (this.roll.l5r5e.isInitiativeRoll) {
            let msgOptions = {
                rnkRoll: this.roll,
                messageMode: HelpersL5r5e.getMessageMode(this._message),
            };

            await this.roll.l5r5e.actor.rollInitiative({
                rerollInitiative: true,
                initiativeOptions: {
                    messageOptions: msgOptions,
                },
            });
            // Adhesive tape to get the message :/
            this.message = msgOptions.rnkMessage;
            delete msgOptions.rnkMessage;
        } else {
            // Send it to chat, switch to new message
            this.message = await this.roll.toMessage(
                {},
                { messageMode: HelpersL5r5e.getMessageMode(this._message) }
            );
        }

        // Refresh viewers
        if (this._message) {
            game.l5r5e.sockets.updateMessageIdAndRefresh(appOldId, this._message.id);
        }

        // Delete old chat message related to this series
        if (game.settings.get(CONFIG.l5r5e.namespace, "rnk-deleteOldMessage")) {
            if (game.user.isFirstGM) {
                const message = game.messages.get(msgOldId);
                if (message) {
                    message.delete();
                }
            } else {
                game.l5r5e.sockets.deleteChatMessage(msgOldId);
            }
        }
    }

    /**
     * This method is called upon form submission after form data is validated
     * @param event    The initial triggering submission event
     * @param formData The object of validated form data with which to update the object
     * @returns        A Promise which resolves once the update operation has completed
     * @override
     */
    async _updateObject(event, formData) {
        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.isEditable) {
            return;
        }

        // Last step strife choice
        if (this.roll?.l5r5e?.rnkEnded) {
            const rollData = this.roll.l5r5e;
            const actor = rollData.actor;
            const targetActor = rollData.target?.actor || null;
            let updated = false;

            const opportunityPlan = Object.entries(this.object.opportunitySpend)
                .filter(([, spend]) => Number(spend) > 0)
                .map(([rulesKey, spend]) => ({ rulesKey, spend: Number(spend) }));
            const opportunityDecisions = Object.fromEntries(opportunityPlan.map(({ rulesKey }) => [
                rulesKey,
                {
                    ...(this.object.opportunityDecisions[rulesKey] ?? {}),
                    targetUuid: this.object.opportunityDecisions[rulesKey]?.targetUuid ?? rollData.target?.uuid ?? undefined,
                },
            ]));
            const resolutionDecisions = { ...opportunityDecisions };
            let resolution = await game.l5r5e.rollResolution.resolve({
                context: this._resolutionContext(),
                rawSymbols: {
                    success: Number(rollData.summary.success) || 0,
                    explosive: Number(rollData.summary.explosive) || 0,
                    opportunity: Number(rollData.summary.opportunity) || 0,
                    strife: Number(rollData.summary.strife) || 0,
                },
                opportunityPlan,
                decisions: resolutionDecisions,
            });
            const pendingDamage = resolution.effects?.action?.damage;
            if (pendingDamage?.requiresDefenseDecision && targetActor) {
                resolutionDecisions.defense = { choice: await game.l5r5e.damage.requestDefense({ target: targetActor, damage: pendingDamage }) };
                resolution = await game.l5r5e.rollResolution.resolve({
                    context: this._resolutionContext(),
                    rawSymbols: {
                        success: Number(rollData.summary.success) || 0,
                        explosive: Number(rollData.summary.explosive) || 0,
                        opportunity: Number(rollData.summary.opportunity) || 0,
                        strife: Number(rollData.summary.strife) || 0,
                    },
                    opportunityPlan,
                    decisions: resolutionDecisions,
                });
            }
            rollData.resolution = resolution;
            if (resolution.status === "blocked") {
                rollData.resolutionErrors = resolution.errors;
                ui.notifications.error(game.i18n.localize("l5r5e.automation.roll.blocked"));
                await this._toChatMessage();
                return this.render(false);
            }
            delete rollData.resolutionErrors;

            let criticalWorkflow = null;
            if (rollData.rollContext?.type === "critical-mitigation") {
                criticalWorkflow = await game.l5r5e.critical.handleMitigationRoll({ roll: this.roll, resolution });
                rollData.criticalWorkflow = criticalWorkflow;
                if (criticalWorkflow?.deferred) {
                    resolution.status = "superseded";
                    await this._toChatMessage();
                    return this.close();
                }
                if (criticalWorkflow?.result) {
                    resolution.effects.action.critical = criticalWorkflow.result;
                    resolution.audit.push({ phase: "criticalWorkflow", result: foundry.utils.deepClone(criticalWorkflow.result) });
                }
            }

            const mutations = await game.l5r5e.rollResolution.buildMutations(resolution, { actor, targetActor, item: rollData.item });
            mutations.push(...(criticalWorkflow?.mutations ?? []));
            if (actor) {
                const strifeMutation = mutations.find((entry) => entry.documentUuid === actor.uuid && entry.path === "system.strife.value");
                rollData.strifeApplied = strifeMutation ? strifeMutation.after - strifeMutation.before : 0;
                rollData.strifeLedger = resolution.strife;
                if (actor.statuses?.has("bleeding") && resolution.strife.gained > 0) {
                    const canDefend = !game.l5r5e.conditions.isActive(actor, "incapacitated", this._resolutionContext().lifecycle);
                    let bleeding = game.l5r5e.damage.resolveBleeding({ actor, strifeReceived: resolution.strife.gained, canDefend });
                    const defenseChoice = bleeding.requiresDefenseDecision ? await game.l5r5e.damage.requestDefense({ target: actor, damage: bleeding }) : bleeding.defenseChoice;
                    bleeding = game.l5r5e.damage.resolveBleeding({ actor, strifeReceived: resolution.strife.gained, canDefend, defenseChoice });
                    resolutionDecisions.bleedingDefense = { choice: defenseChoice };
                    rollData.bleedingResolution = bleeding;
                    if (bleeding.fatigue > 0) {
                        const before = Number(actor.system.fatigue.value) || 0;
                        mutations.push({ documentUuid: actor.uuid, path: "system.fatigue.value", before, after: Math.max(0, before + bleeding.fatigue), reason: "bleeding" });
                    }
                    if (bleeding.voidSpent > 0) {
                        const before = Number(actor.system.void_points.value) || 0;
                        mutations.push({ documentUuid: actor.uuid, path: "system.void_points.value", before, after: Math.max(0, before - bleeding.voidSpent), reason: "declineDefense" });
                    }
                }
            }
            const reservation = rollData.actionReservation;
            const reservedCombatant = reservation ? await fromUuid(reservation.combatantUuid) : null;
            const preparedAction = reservation && reservedCombatant
                ? game.l5r5e.actions.prepareCommit(reservedCombatant, reservation.reservationId, resolution)
                : reservation
                    ? { ok: false, code: "combatantMissing" }
                    : null;
            if (preparedAction && !preparedAction.ok) {
                ui.notifications.warn(game.i18n.localize("l5r5e.automation.action.commitFailed"));
                return this.render(false);
            }
            mutations.push(...(preparedAction?.mutations ?? []));
            const transaction = game.l5r5e.transactions.create({ transactionId: resolution.transactionId, revision: resolution.revision, rollMessageUuid: this.message.uuid, inputs: { context: resolution.context, raw: resolution.raw }, decisions: resolutionDecisions, mutations, createdDocuments: criticalWorkflow?.createdDocuments ?? [] });
            const locallyOwned = game.user.isGM || mutations.every((mutation) => fromUuidSync(mutation.documentUuid)?.isOwner);
            const parentMessageUuid = rollData.rollContext?.critical?.parentRollMessageUuid ?? null;
            const applied = parentMessageUuid
                ? await game.l5r5e.sockets.requestAuthority("applyTransaction", { transaction, parentMessageUuid })
                : locallyOwned
                    ? await game.l5r5e.transactions.apply(transaction)
                    : await game.l5r5e.sockets.requestAuthority("applyTransaction", { transaction });
            if (applied.ok === false) {
                resolution.status = "conflict";
                ui.notifications.error(game.i18n.localize("l5r5e.automation.transaction.conflict"));
                return this.render(false);
            }
            resolution.transaction = transaction;
            resolution.status = "applied";
            updated ||= mutations.length > 0 || (criticalWorkflow?.createdDocuments?.length ?? 0) > 0;

            if (preparedAction) {
                game.l5r5e.actions.finalizeCommit(reservedCombatant, preparedAction, resolution);
                this._reservationFinalized = true;
            }

            const pendingCriticalWorkflows = [];
            const attackCritical = resolution.effects?.action?.damage?.critical;
            if (attackCritical?.required && targetActor) pendingCriticalWorkflows.push({
                sourceActor: actor,
                target: targetActor,
                severity: attackCritical.severity,
                stance: targetActor.system?.stance,
                conflict: Boolean(game.combat?.started),
                razorEdged: game.l5r5e.qualities.has(rollData.item, "razor-edged"),
                sourceItem: rollData.item,
                parentTransactionId: resolution.transactionId,
            });
            const bleedingCritical = rollData.bleedingResolution?.critical;
            if (bleedingCritical?.required && actor) pendingCriticalWorkflows.push({
                sourceActor: actor,
                target: actor,
                severity: bleedingCritical.severity,
                stance: actor.system?.stance,
                conflict: Boolean(game.combat?.started),
                parentTransactionId: resolution.transactionId,
            });
            for (const directCritical of resolution.effects?.action?.directCriticals ?? []) {
                const targetDocument = directCritical.targetUuid ? await fromUuid(directCritical.targetUuid) : targetActor;
                const directTarget = targetDocument?.actor ?? targetDocument;
                if (!directTarget) continue;
                pendingCriticalWorkflows.push({
                    sourceActor: actor,
                    target: directTarget,
                    severity: directCritical.severity,
                    stance: directTarget.system?.stance,
                    conflict: Boolean(game.combat?.started),
                    razorEdged: game.l5r5e.qualities.has(rollData.item, "razor-edged"),
                    sourceItem: rollData.item,
                    parentTransactionId: resolution.transactionId,
                });
            }
            if (criticalWorkflow?.followUpCritical && actor) pendingCriticalWorkflows.push({
                sourceActor: actor,
                target: actor,
                severity: criticalWorkflow.followUpCritical.severity,
                stance: actor.system?.stance,
                conflict: Boolean(game.combat?.started),
                parentTransactionId: resolution.transactionId,
            });

            if (formData.fatigueApplied !== undefined && rollData.applyFlags?.fatigueToCharacter && actor) {
                const parsed = Number(formData.fatigueApplied);
                const fatigueApplied = Math.max(0, Number.isNaN(parsed) ? 0 : Math.round(parsed));
                const previousApplied = Number.isNaN(Number(rollData._fatigueAppliedToActor))
                    ? 0
                    : Number(rollData._fatigueAppliedToActor);
                const actorMod = fatigueApplied - previousApplied;
                if (actorMod !== 0) {
                    await actor.update({
                        system: {
                            fatigue: {
                                value: Math.max(0, actor.system.fatigue.value + actorMod),
                            },
                        },
                    });
                    rollData.fatigueApplied = fatigueApplied;
                    rollData._fatigueAppliedToActor = fatigueApplied;
                    updated = true;
                } else {
                    rollData.fatigueApplied = fatigueApplied;
                }
            }

            const canModifyTarget = targetActor && (targetActor.isOwner || game.user.isGM);

            if (
                formData.targetStrifeApplied !== undefined &&
                rollData.applyFlags?.strifeToTarget &&
                canModifyTarget
            ) {
                const parsed = Number(formData.targetStrifeApplied);
                const targetStrifeApplied = Math.max(0, Number.isNaN(parsed) ? 0 : Math.round(parsed));
                const previous = rollData.targetStrifeApplied || 0;
                const targetMod = targetStrifeApplied - previous;
                if (targetMod !== 0) {
                    await targetActor.update({
                        system: {
                            strife: {
                                value: Math.max(0, targetActor.system.strife.value + targetMod),
                            },
                        },
                    });
                    rollData.targetStrifeApplied = targetStrifeApplied;
                    updated = true;
                }
            }

            if (
                formData.targetFatigueApplied !== undefined &&
                rollData.applyFlags?.fatigueToTarget &&
                canModifyTarget
            ) {
                const parsed = Number(formData.targetFatigueApplied);
                const targetFatigueApplied = Math.max(0, Number.isNaN(parsed) ? 0 : Math.round(parsed));
                const previous = rollData.targetFatigueApplied || 0;
                const targetMod = targetFatigueApplied - previous;
                if (targetMod !== 0) {
                    await targetActor.update({
                        system: {
                            fatigue: {
                                value: Math.max(0, targetActor.system.fatigue.value + targetMod),
                            },
                        },
                    });
                    rollData.targetFatigueApplied = targetFatigueApplied;
                    updated = true;
                }
            }

            rollData.hasAppliedResults =
                updated ||
                (rollData.strifeApplied || 0) > 0 ||
                (rollData.fatigueApplied || 0) > 0 ||
                (rollData.targetStrifeApplied || 0) > 0 ||
                (rollData.targetFatigueApplied || 0) > 0;

            await this._toChatMessage();
            Hooks.callAll("l5r5e.rollResolutionChanged", this.message, resolution);
            for (const workflow of pendingCriticalWorkflows) await game.l5r5e.critical.startWorkflow({ ...workflow, parentRollMessageUuid: this.message.uuid });
            return this.close();
        }

        // Discard all dices without a choice for the current step
        this._forceChoiceForDiceWithoutOne(RollnKeepDialog.CHOICES.discard);

        // Apply all choices to build the next step
        await this._applyChoices();

        // *** Below this the current step become the next step ***
        this.object.currentStep++;

        // Rebuild the roll
        await this._rebuildRoll(false);

        // Send the new roll in chat and delete the old message
        await this._toChatMessage();

        // If a next step exist or strife, rerender, else close
        if (this.object.dicesList[this.object.currentStep] || this.roll.l5r5e.rnkEnded) {
            return this.render(false);
        }
        return this.close();
    }

    /**
     * Undo the last step choice
     * @returns {Promise<Application|any>}
     * @private
     */
    async _undoLastStepChoices() {
        // Find the step to work to
        this.object.currentStep = this.object.dicesList[this.object.currentStep]
            ? this.object.currentStep
            : Math.max(0, this.object.currentStep - 1);

        // If all clear, delete this step
        if (this._haveChoice(this.object.currentStep, RollnKeepDialog.CHOICES.nothing)) {
            if (this.object.currentStep === 0) {
                return;
            }
            this.object.dicesList.pop();
            this.object.dicesList = this.object.dicesList.filter((e) => !!e);
            this.object.currentStep--;
        }

        // Clear choices
        this.object.dicesList[this.object.currentStep]
            .filter((e) => !!e)
            .map((e) => {
                e.choice = RollnKeepDialog.CHOICES.nothing;
                return e;
            });

        this.options.editable = this.isOwner;
        await this._rebuildRoll(true);
        await this._toChatMessage();
        return this.render(false);
    }

    /**
     * Handle execution of a chat card action via a click event on the RnK button
     * @param {Event} event The originating click event
     * @returns {Promise}   A promise which resolves once the handler workflow is complete
     */
    static async onChatAction(event) {
        event.preventDefault();
        event.stopPropagation();

        // Extract card data
        const button = $(event.currentTarget);
        button.attr("disabled", true);
        const card = button.parents(".l5r5e.item-display.dices-l5r");
        const messageId = card.parents(".chat-message").data("message-id");

        // Already open ? close it
        const app = game.l5r5e.HelpersL5r5e.getApplication(`l5r5e-roll-n-keep-dialog-${messageId}`);
        if (app) {
            app.close();
        } else {
            new RollnKeepDialog(messageId).render(true);
        }

        // Re-enable the button
        button.attr("disabled", false);
    }

    /**
     * Open the core linked journal effect if exist
     * @param {Event} event
     * @private
     */
    async _openEffectJournal(event) {
        event.preventDefault();
        event.stopPropagation();

        const effectId = $(event.currentTarget).data("effect-id");
        if (!effectId) {
            return;
        }

        const effect = this.roll.l5r5e?.actor?.effects?.get(effectId);
        if (!effect?.system?.id && !effect?.system?.uuid) {
            return;
        }

        const journal = await game.l5r5e.HelpersL5r5e.getObjectGameOrPack({
            id: effect.system.id,
            uuid: effect.system.uuid,
            type: "JournalEntry",
        });
        if (journal) {
            // Open on the "rules" section. If non exists then it will open the first page
            journal.sheet.render(true, {pageIndex: 2});
        }
    }
}
