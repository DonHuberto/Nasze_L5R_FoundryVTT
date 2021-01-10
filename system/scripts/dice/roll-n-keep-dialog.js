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
        face_change: "face-change",
        keep: "keep",
        nothing: null,
        reroll: "reroll",
        reserve: "reserve",
    };

    /**
     * The current ChatMessage where we come from
     * @param {ChatMessage} message
     */
    message = null;

    /**
     * Payload Object
     */
    object = {
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
            width: 660,
            height: 660,
        });
    }

    /**
     * Define a unique and dynamic element ID for the rendered ActorSheet application
     */
    get id() {
        return `l5r5e-roll-n-keep-dialog-${this.message._id}`;
    }

    /**
     * Create the Roll n Keep dialog
     * @param {ChatMessage} message
     * @param {FormApplicationOptions} options
     */
    constructor(message, options = {}) {
        super({}, options);
        this.message = message;
        this._initialize();
    }

    /**
     * Refresh data (used from socket)
     */
    async refresh() {
        if (!this.message) {
            return;
        }
        this._initialize();
        this.render(false);
    }

    /**
     * Initialize the dialog with the message
     * @private
     */
    _initialize() {
        // Get the roll
        const roll = game.l5r5e.RollL5r5e.fromData(this.message.roll);

        console.clear();
        console.log(roll); // TODO TMP

        // Already history
        if (Array.isArray(roll.l5r5e.history)) {
            this.object.dicesList = roll.l5r5e.history;
            return;
        }

        // New
        roll.terms.forEach((term) => {
            if (typeof term !== "object") {
                return;
            }
            term.results.forEach((res) => {
                this.object.dicesList[0].push({
                    type: term.constructor.name,
                    face: res.result,
                    explosive: term.constructor.FACES[res.result].explosive,
                    img: term.constructor.getResultSrc(res.result),
                    choice: RollnKeepDialog.CHOICES.nothing,
                });
            });
        });
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
        const draggableList = [];
        this.object.dicesList.forEach((step, idx) => {
            step.forEach((die, dieNum) => {
                if (die) {
                    draggableList[dieNum] = idx;
                }
            });
        });

        return {
            ...super.getData(options),
            data: this.object,
            draggableList: draggableList,
            l5r5e: this.message._roll.l5r5e,
        };
    }

    /**
     * Listen to html elements
     * @override
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Finalize Button
        html.find("#finalize").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (this._getKeepCount() > 0) {
                this.submit();
            }
        });
    }

    /**
     * Handle dropped items
     */
    async _onDropItem(event) {
        const type = $(event.currentTarget).data("type");
        const json = event.dataTransfer.getData("text/plain");
        if (!json || !Object.values(RollnKeepDialog.CHOICES).some((e) => !!e && e === type)) {
            return;
        }

        const data = JSON.parse(json);
        if (!data) {
            return;
        }

        let addNewRoll = false;
        const current = this.object.dicesList[data.step][data.die];
        current.choice = type;

        // Actions p 26 : change, ignore/discard, reroll, reserve, change face
        switch (type) {
            case RollnKeepDialog.CHOICES.keep:
                if (current.explosive) {
                    addNewRoll = true;
                }
                break;

            case RollnKeepDialog.CHOICES.reroll:
                addNewRoll = true;
                break;
        }

        // New roll
        if (addNewRoll) {
            if (!this.object.dicesList[data.step + 1]) {
                this.object.dicesList[data.step + 1] = Array(this.object.dicesList[0].length).fill(null);
            }
            this.object.dicesList[data.step + 1][data.die] = await this._newRoll(current.type, type);
        }

        this.render(false);
        return false;
    }

    /**
     * Roll a new die avec return the result
     * @private
     */
    async _newRoll(dieType, actionType) {
        const roll = await new game.l5r5e.RollL5r5e(dieType === "RingDie" ? "1dr" : "1ds");
        roll.actor = this.message.roll.l5r5e.actor;
        roll.l5r5e.stance = this.message.roll.l5r5e.stance;
        // roll.l5r5e.skillId = this.message.roll.l5r5e.skillId;
        // roll.l5r5e.skillCatId = this.message.roll.l5r5e.skillCatId;

        await roll.roll();
        await roll.toMessage({
            flavor: game.i18n.localize(`l5r5e.roll_n_keep.${actionType}_chat`),
        });

        const dice = roll.terms[0];
        const result = dice.results[0].result;

        return {
            type: dieType,
            face: result,
            explosive: dice.constructor.FACES[result].explosive,
            img: dice.constructor.getResultSrc(result),
            choice: RollnKeepDialog.CHOICES.nothing,
        };
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
                    if (!!die && die.choice === RollnKeepDialog.CHOICES.keep) {
                        acc2 = acc2 + 1;
                    }
                    return acc2;
                }, 0)
            );
        }, 0);
    }

    /**
     * This method is called upon form submission after form data is validated
     * @param event    The initial triggering submission event
     * @param formData The object of validated form data with which to update the object
     * @returns        A Promise which resolves once the update operation has completed
     * @override
     */
    async _updateObject(event, formData) {
        console.log("**** _updateObject");

        // Notify the change to other players
        // game.l5r5e.sockets.refreshAppId(this.id);

        // this.message._roll.l5r5e.history = {test: "yahooo"};

        // await message.update({
        //     data: {
        //         roll: roll
        //     }
        // });
        // message.render(false);

        // console.log(roll.toJSON(), this.message);

        // ui.chat.updateMessage(message);
        // ui.chat.postOne(message, false);

        // if (game.user.isGM) {
        //     message.delete();
        // } else {
        //     game.l5r5e.sockets.deleteChatMessage(messageId);
        // }

        // return this.close();
    }

    /**
     * Handle execution of a chat card action via a click event on the RnK button
     * @param {Event} event The originating click event
     * @returns {Promise}   A promise which resolves once the handler workflow is complete
     */
    static async onChatAction(event) {
        event.preventDefault();

        // Extract card data
        const button = $(event.currentTarget);
        button.attr("disabled", true);
        const card = button.parents(".l5r5e.item-display.dices-l5r");
        const messageId = card.parents(".chat-message").data("message-id");
        const message = game.messages.get(messageId);

        // Validate permission to proceed with the roll n keep
        if (!message || !message._roll.l5r5e.actor.owner) {
            return;
        }

        new RollnKeepDialog(message).render(true);

        // Re-enable the button
        button.attr("disabled", false);
    }
}
