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

    /**
     * Payload Object
     */
    object = {
        currentStep: 0,
        strifeApplied: 0,
        submitDisabled: false,
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
        const rollData = this.roll.l5r5e;

        // Disable submit / edition
        this.options.classes = this.options.classes.filter((e) => e !== "finalized");
        this.object.submitDisabled = false;

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
        const actorHasBleeding = typeof actor?.statuses?.has === "function" ? actor.statuses.has("bleeding") : false;
        const canApplyStrifeToCharacter = applyFlags.strifeToCharacter && rollData.actor?.isCharacterType;
        const bleedingCanApplyFatigue = actorHasBleeding && !!actor;
        if (bleedingCanApplyFatigue && !applyFlags.fatigueToCharacter) {
            applyFlags.fatigueToCharacter = true;
        }
        const canApplyFatigueToCharacter = (applyFlags.fatigueToCharacter && !!actor) || bleedingCanApplyFatigue;
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
            const stance = String(rollData?.stance ?? "").toLowerCase();
            if (stance !== "void" && this.roll.l5r5e.strifeApplied === undefined) {
                this.roll.l5r5e.strifeApplied = rollData.summary.strife;
                if (typeof rollData.actor?.statuses?.has === "function" && rollData.actor.statuses.has("intoxicated")) {
                    this.roll.l5r5e.strifeApplied += rollData.summary.strife;
                }
            }

            if (bleedingCanApplyFatigue) {
                const bleedingDefault = this.roll.l5r5e._bleedingFatigueDefault;
                const currentFatigue = this.roll.l5r5e.fatigueApplied;
                const summaryStrife = rollData.summary.strife;
                if (
                    currentFatigue === undefined ||
                    bleedingDefault === undefined ||
                    currentFatigue === bleedingDefault
                ) {
                    this.roll.l5r5e.fatigueApplied = summaryStrife;
                }
                this.roll.l5r5e._bleedingFatigueDefault = summaryStrife;
            } else {
                delete this.roll.l5r5e._bleedingFatigueDefault;
            }

            const canEditResults =
                (rollData.summary.strife > 0 && rollData.actor?.isCharacterType) || hasApplyOptions;
            this.options.editable = this.isOwner && canEditResults;
            this.options.classes.push("finalized");
        }

        const isEditable = options?.editable ?? this.options.editable;

        return {
            ...(await super.getData(options)),
            isGM: game.user.isGM,
            showChoices: isEditable && !rollData.rnkEnded,
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
        };
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

            const display = group.find(".apply-value-display");
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
                if (display.length) {
                    display.text(sanitized);
                }
            };

            input.on("change", (event) => {
                const target = event.currentTarget ?? event.target ?? input[0];
                applyValue(Number(target?.value));
            });

            input.on("input", (event) => {
                const current = Number(event.currentTarget.value);
                if (display.length) {
                    display.text(Number.isNaN(current) ? "" : current);
                }
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
    _getDefaultChoiceForDie(dieType, dieFace) {
        if (!this._isActorCompromised()) {
            return RollnKeepDialog.CHOICES.nothing;
        }

        const dieFaces = game.l5r5e?.[dieType]?.FACES;
        if (!dieFaces) {
            return RollnKeepDialog.CHOICES.nothing;
        }

        const hasStrife = Boolean(dieFaces?.[dieFace]?.strife);
        return hasStrife ? RollnKeepDialog.CHOICES.discard : RollnKeepDialog.CHOICES.nothing;
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
                rollMode: game.l5r5e.HelpersL5r5e.getRollMode(this._message),
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
                { rollMode: game.l5r5e.HelpersL5r5e.getRollMode(this._message) }
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
            const summary = rollData.summary;
            const actor = rollData.actor;
            const targetActor = rollData.target?.actor || null;
            let updated = false;

            if (formData.strifeApplied !== undefined && rollData.applyFlags?.strifeToCharacter && actor?.isCharacterType) {
                const parsed = Number(formData.strifeApplied);
                const strifeApplied = Math.max(0, Number.isNaN(parsed) ? 0 : Math.round(parsed));
                const previousApplied = Number.isNaN(Number(rollData._strifeAppliedToActor))
                    ? 0
                    : Number(rollData._strifeAppliedToActor);
                const actorMod = strifeApplied - previousApplied;
                if (actorMod !== 0) {
                    await actor.update({
                        system: {
                            strife: {
                                value: Math.max(0, actor.system.strife.value + actorMod),
                            },
                        },
                    });
                    rollData.strifeApplied = strifeApplied;
                    rollData._strifeAppliedToActor = strifeApplied;
                    updated = true;
                } else {
                    rollData.strifeApplied = strifeApplied;
                }
            }

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
                (rollData.strifeApplied || 0) > 0 ||
                (rollData.fatigueApplied || 0) > 0 ||
                (rollData.targetStrifeApplied || 0) > 0 ||
                (rollData.targetFatigueApplied || 0) > 0;

            if (updated) {
                await this._toChatMessage();
            }
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
        if (this.object.dicesList[this.object.currentStep] || this.roll.l5r5e.summary.strife > 0) {
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
}
