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
    message = null;

    /**
     * The current Roll
     * @param {Roll} roll
     */
    roll = null;

    /**
     * Payload Object
     */
    object = {
        currentStep: 0,
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
        return mergeObject(super.defaultOptions, {
            id: "l5r5e-roll-n-keep-dialog",
            classes: ["l5r5e", "roll-n-keep-dialog"],
            template: CONFIG.l5r5e.paths.templates + "dice/roll-n-keep-dialog.html",
            title: game.i18n.localize("l5r5e.roll_n_keep.title"),
            closeOnSubmit: false,
        });
    }

    /**
     * Define a unique and dynamic element ID for the rendered ActorSheet application
     */
    get id() {
        return `l5r5e-roll-n-keep-dialog-${this.message._id}`;
    }

    set message(msg) {
        this.message = msg instanceof ChatMessage ? duplicate(msg) : null;
    }

    /**
     * Create the Roll n Keep dialog
     * @param {number} messageId
     * @param {FormApplicationOptions} options
     */
    constructor(messageId, options = {}) {
        super({}, options);
        this.message = game.messages.get(messageId);
        this.options.editable =
            this.message?.isAuthor || this.message?._roll.l5r5e.actor?.owner || this.message?.owner || false;

        this._initializeDiceFaces();
        this._initializeHistory();
    }

    /**
     * Refresh data (used from socket)
     */
    async refresh() {
        if (!this.message) {
            return;
        }
        this._initializeHistory();
        this.render(false);
    }

    /**
     * Render
     * @param {boolean} force
     * @param  {RenderOptions} options
     * @returns {Application}
     * @override
     */
    render(force = null, options = {}) {
        if (!this.message) {
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
        if (!this.message) {
            return;
        }

        // Get the roll
        this.roll = game.l5r5e.RollL5r5e.fromData(this.message._roll);

        // Already history
        if (Array.isArray(this.roll.l5r5e.history)) {
            this.object.dicesList = this.roll.l5r5e.history;

            let currentStep = this.roll.l5r5e.history.length - 1;
            if (!this._haveChoice(currentStep)) {
                currentStep += 1;
            }
            this.object.currentStep = currentStep;
            return;
        }

        // New
        this.object.dicesList = [[]];
        this.roll.terms.forEach((term) => {
            if (typeof term !== "object") {
                return;
            }
            term.results.forEach((res) => {
                this.object.dicesList[0].push({
                    type: term.constructor.name,
                    face: res.result,
                    choice: RollnKeepDialog.CHOICES.nothing,
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
            new DragDrop({
                dragSelector: ".dice.draggable",
                dropSelector: ".dropbox",
                permissions: { dragstart: this._canDragStart.bind(this), drop: this._canDragDrop.bind(this) },
                callbacks: { dragstart: this._onDragStart.bind(this), drop: this._onDropItem.bind(this) },
            }),
        ];
    }

    /**
     * Define whether a user is able to begin a dragstart workflow for a given drag selector
     * @param selector	The candidate HTML selector for dragging
     * @return			Can the current user drag this selector?
     */
    _canDragStart(selector) {
        return this.options.editable;
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
    getData(options = null) {
        // Check only on 1st step
        if (this.object.currentStep === 0) {
            const kept = this._getKeepCount();
            this.object.submitDisabled = kept < 1 || kept > this.roll.l5r5e.ringsUsed;
        } else if (!this.object.dicesList[this.object.currentStep]) {
            this.options.editable = false;
        }

        return {
            ...super.getData(options),
            data: this.object,
            l5r5e: this.message._roll.l5r5e,
        };
    }

    /**
     * Listen to html elements
     * @override
     */
    activateListeners(html) {
        super.activateListeners(html);

        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.options.editable) {
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
    }

    /**
     * Handle dropped items
     */
    async _onDropItem(event) {
        // *** Everything below here is only needed if the sheet is editable ***
        if (!this.options.editable) {
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

        // FaceSwap
        if (type === RollnKeepDialog.CHOICES.swap) {
            // Dice Type Ring/Skill
            const diceType = $(event.currentTarget).data("die");
            const diceNewFace = $(event.currentTarget).data("face");

            if (current.type !== diceType || current.face === diceNewFace) {
                current.choice = RollnKeepDialog.CHOICES.nothing;
                this.render(false);
                return false;
            }

            current.newFace = diceNewFace;
        }

        current.choice = type;

        // Little time saving : on 1st step, if we reach the max kept dices, discard all dices without a choice
        if (this.object.currentStep === 0 && this._getKeepCount() === this.roll.l5r5e.ringsUsed) {
            this._discardDiceWithoutChoice();
        }

        this.render(false);
        return false;
    }

    /**
     * Return the current number of dices kept
     * @private
     */
    _getKeepCount() {
        return this.object.dicesList.reduce((acc, step) => {
            return (
                acc +
                step.reduce((acc2, die) => {
                    if (
                        !!die &&
                        [
                            RollnKeepDialog.CHOICES.keep,
                            RollnKeepDialog.CHOICES.reroll,
                            RollnKeepDialog.CHOICES.swap,
                        ].includes(die.choice)
                    ) {
                        acc2 = acc2 + 1;
                    }
                    return acc2;
                }, 0)
            );
        }, 0);
    }

    /**
     * Return true if the player can make a choice for the current step
     * @private
     */
    _haveChoice(currentStep) {
        return (
            this.object.dicesList[currentStep] &&
            this.object.dicesList[currentStep].some((e) => !!e && e.choice === RollnKeepDialog.CHOICES.nothing)
        );
    }

    /**
     * Discard all dices without a choice for the current step
     * @private
     */
    _discardDiceWithoutChoice() {
        this.object.dicesList[this.object.currentStep]
            .filter((e) => !!e)
            .map((e) => {
                if (e.choice === RollnKeepDialog.CHOICES.nothing) {
                    e.choice = RollnKeepDialog.CHOICES.discard;
                }
                return e;
            });
    }

    /**
     * Apply all choices to build the next step
     * @returns {Promise<void>}
     * @private
     */
    async _applyChoices() {
        const nextStep = this.object.currentStep + 1;

        // Foreach kept dices, apply choices
        const newRolls = {};
        this.object.dicesList[this.object.currentStep].forEach((die, idx) => {
            if (!die) {
                return;
            }
            switch (die.choice) {
                case RollnKeepDialog.CHOICES.keep:
                    // Exploding dice : add a new dice in the next step
                    if (game.l5r5e[die.type].FACES[die.face].explosive) {
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
                    if (!this.object.dicesList[nextStep]) {
                        this.object.dicesList[nextStep] = Array(this.object.dicesList[0].length).fill(null);
                    }
                    this.object.dicesList[nextStep][idx] = {
                        type: this.object.dicesList[this.object.currentStep][idx].type,
                        face: this.object.dicesList[this.object.currentStep][idx].newFace,
                        choice: RollnKeepDialog.CHOICES.keep,
                    };
                    delete this.object.dicesList[this.object.currentStep][idx].newFace;
                    break;
            }
        });

        // If new rolls, roll and add them
        if (Object.keys(newRolls).length > 0) {
            const newRollsResults = await this._newRoll(newRolls);

            if (!this.object.dicesList[nextStep]) {
                this.object.dicesList[nextStep] = Array(this.object.dicesList[0].length).fill(null);
            }

            this.object.dicesList[this.object.currentStep].forEach((die, idx) => {
                if (!die) {
                    return;
                }
                if (
                    die.choice === RollnKeepDialog.CHOICES.reroll ||
                    (die.choice === RollnKeepDialog.CHOICES.keep && game.l5r5e[die.type].FACES[die.face].explosive)
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
            game.dice3d.showForRoll(roll, game.user, true);
        }

        roll.terms.forEach((term) => {
            if (typeof term !== "object") {
                return;
            }
            term.results.forEach((res) => {
                out[term.constructor.name].push({
                    type: term.constructor.name,
                    face: res.result,
                    choice: RollnKeepDialog.CHOICES.nothing,
                });
            });
        });

        return out;
    }

    /**
     * Rebuild the message roll
     * @private
     */
    async _rebuildRoll() {
        // Get all kept dices + new (choice null)
        const diceList = this.object.dicesList.reduce((acc, step) => {
            step.forEach((die) => {
                if (!!die && [RollnKeepDialog.CHOICES.keep, RollnKeepDialog.CHOICES.nothing].includes(die.choice)) {
                    if (!acc[die.type]) {
                        acc[die.type] = [];
                    }
                    acc[die.type].push(die);
                }
            });
            return acc;
        }, {});

        // Re create a new roll
        const roll = await new game.l5r5e.RollL5r5e(this._arrayToFormula(diceList));
        roll.l5r5e = {
            ...this.message._roll.l5r5e,
            summary: roll.l5r5e.summary,
        };

        // Fill the data
        roll.evaluate();

        // Modify results
        roll.terms.map((term) => {
            if (term instanceof game.l5r5e.L5rBaseDie) {
                term.results.map((res) => {
                    const die = diceList[term.constructor.name].shift();
                    res.result = die.face;
                    return res;
                });
                term.l5rSummary();
            }
            return term;
        });

        // Recompute summary
        roll.l5rSummary();

        // Add roll & history to message
        this.message._roll = roll;
        this.message._roll.l5r5e.history = this.object.dicesList;
    }

    /**
     * Send the new roll in chat and delete the old message
     * @returns {Promise<void>}
     * @private
     */
    async _toChatMessage() {
        // Keep old Ids
        const appId = this.id;
        const msgId = this.message._id;

        if (this.message._roll.l5r5e.isInitiativeRoll) {
            await this.message._roll.l5r5e.actor.rollInitiative({
                rerollInitiative: true,
                initiativeOptions: {
                    messageOptions: {
                        rnkRoll: this.message._roll,
                    },
                },
            });
            // Adhesive tape to get the messageId :/
            this.message = this.message._roll.l5r5e.actor.rnkMessage;
            delete this.message._roll.l5r5e.actor.rnkMessage;
        } else {
            // Send it to chat, switch to new message
            this.message = await this.message._roll.toMessage();
        }

        // Refresh viewers
        game.l5r5e.sockets.updateMessageIdAndRefresh(appId, this.message._id);

        // Delete old chat message related to this series
        if (game.settings.get("l5r5e", "rnk.deleteOldMessage")) {
            if (game.user.isGM) {
                const message = game.messages.get(msgId);
                if (message) {
                    message.delete();
                }
            } else {
                game.l5r5e.sockets.deleteChatMessage(msgId);
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
        if (!this.options.editable) {
            return;
        }

        // Discard all dices without a choice for the current step
        this._discardDiceWithoutChoice();

        // Apply all choices to build the next step
        await this._applyChoices();

        // *** Below this the current step become the next step ***
        this.object.currentStep += 1;

        // Rebuild the roll
        await this._rebuildRoll();

        // Send the new roll in chat and delete the old message
        await this._toChatMessage();

        // If a next step exist, rerender, else close
        if (this.object.dicesList[this.object.currentStep]) {
            return this.render();
        }
        return this.close();
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

        new RollnKeepDialog(messageId).render(true);

        // Re-enable the button
        button.attr("disabled", false);
    }
}
