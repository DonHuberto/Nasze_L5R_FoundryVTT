import { L5rBaseDie } from "./dietype/l5r-base-die.js";

/**
 * Roll for L5R5e
 */
export class RollL5r5e extends Roll {
    static CHAT_TEMPLATE = "systems/l5r5e/templates/dice/chat-roll.html";
    static TOOLTIP_TEMPLATE = "systems/l5r5e/templates/dice/tooltip.html";

    // static CHAT_TEMPLATE = `${CONFIG.L5r5e.pathTemplates}dice/chat-roll.html`;
    // static TOOLTIP_TEMPLATE = `${CONFIG.L5r5e.pathTemplates}dice/tooltip.html`;

    constructor(...args) {
        console.log("RollL5r5e.in.args", args); // TODO tmp

        super(...args);

        this.l5r5e = {
            stance: "",
            skillId: "",
            actor: null,
            dicesTypes: {
                std: false,
                l5r: false,
            },
            summary: {
                difficulty: 0,
                success: 0,
                explosive: 0,
                opportunity: 0,
                strife: 0,
            },
        };

        // TODO parse difficulty stance skillId from cmd line ?

        console.log("RollL5r5e.out.args", args, this); // TODO tmp
    }

    /**
     * Execute the Roll, replacing dice and evaluating the total result
     * @override
     **/
    evaluate({ minimize = false, maximize = false } = {}) {
        if (this._rolled) {
            throw new Error("This Roll object has already been rolled.");
        }

        console.log("RollL5r5e.evaluate.in", this); // TODO tmp

        // Split L5R dices / regulars for non inners
        let l5rDices = this.terms.filter((term) => term instanceof L5rBaseDie);
        this.terms = this.terms.filter((t) => !(t instanceof L5rBaseDie));
        this.terms = this._identifyTerms(this.constructor.cleanFormula(this.terms));

        // Roll regular dices / inner dices
        this._total = 0;
        if (this.terms.length > 0) {
            // clean terms (trim symbols)
            this.terms = this._identifyTerms(this.constructor.cleanFormula(this.terms));

            // Roll
            super.evaluate({ minimize, maximize });
        }

        // Check inner L5R rolls
        this._dice.forEach((term) => {
            if (term instanceof L5rBaseDie) {
                // Add results to total
                ["success", "explosive", "opportunity", "strife"].forEach((props) => {
                    this.l5r5e.summary[props] += parseInt(term.l5r5e[props]);
                });
            }
        });

        // Roll non inner L5R dices
        if (l5rDices.length > 0) {
            l5rDices.forEach((term) => {
                // Roll
                term.evaluate({ minimize, maximize });

                // Total
                ["success", "explosive", "opportunity", "strife"].forEach((props) => {
                    this.l5r5e.summary[props] += parseInt(term.l5r5e[props]);
                });

                // re-inject L5R dices
                this.terms.push("+");
                this.terms.push(term);
            });

            // Clean
            if (this.terms[0] === "+") {
                this.terms.shift();
            }

            // TODO Others advantage/disadvantage
        }

        // Store final outputs
        this._rolled = true;
        this.l5r5e.dicesTypes.std = this.dice.some((term) => term instanceof DiceTerm && !(term instanceof L5rBaseDie));
        this.l5r5e.dicesTypes.l5r = this.dice.some((term) => term instanceof L5rBaseDie);

        console.log("RollL5r5e.evaluate.out", this); // TODO tmp

        return this;
    }

    /**
     * Return the total result of the Roll expression if it has been evaluated, otherwise null
     * @override
     */
    get total() {
        if (!this._rolled) {
            return null;
        }

        let total = "";

        // Regular dices total (eg 6)
        if (this.l5r5e.dicesTypes.std) {
            total = this._total;
        }

        // Add L5R summary
        if (this.l5r5e.dicesTypes.l5r) {
            const summary = this.l5r5e.summary;

            // TODO i18n lang trad or symbols
            total +=
                (this.l5r5e.dicesTypes.std ? " | " : "") +
                ["success", "explosive", "opportunity", "strife"]
                    .map((props) => (summary[props] > 0 ? props + ": " + summary[props] : null))
                    .filter((c) => !!c)
                    .join(", ");
        }

        return total;
    }

    /**
     * Render the tooltip HTML for a Roll instance and inner rolls (eg [[2ds]])
     * @param contexte Used to differentiate render (no l5r dices) or inline tooltip (with l5r dices)
     * @override
     */
    getTooltip(contexte = null) {
        const parts = this.dice.map((term) => {
            const cls = term.constructor;
            const isL5rDie = term instanceof L5rBaseDie;

            return {
                formula: term.formula,
                total: term.total,
                faces: term.faces,
                flavor: term.options.flavor,
                isDieL5r: isL5rDie,
                isDieStd: !isL5rDie,
                display: !isL5rDie || contexte?.from !== "render",
                rolls: term.results.map((r) => {
                    return {
                        result: cls.getResultLabel(r.result),
                        classes: [
                            cls.name.toLowerCase(),
                            "d" + term.faces,
                            !isL5rDie && r.rerolled ? "rerolled" : null,
                            !isL5rDie && r.exploded ? "exploded" : null,
                            !isL5rDie && r.discarded ? "discarded" : null,
                            !isL5rDie && r.result === 1 ? "min" : null,
                            !isL5rDie && r.result === term.faces ? "max" : null,
                        ]
                            .filter((c) => !!c)
                            .join(" "),
                    };
                }),
            };
        });
        parts.addedResults = this.addedResults;

        const chatData = {
            parts: parts,
            l5r5e: this.l5r5e,
        };

        return renderTemplate(this.constructor.TOOLTIP_TEMPLATE, { chatData });
    }

    /**
     * Render a Roll instance to HTML
     * @override
     */
    async render(chatOptions = {}) {
        chatOptions = mergeObject(
            {
                user: game.user._id,
                flavor: null,
                template: this.constructor.CHAT_TEMPLATE,
                blind: false,
            },
            chatOptions
        );
        const isPrivate = chatOptions.isPrivate;

        // Execute the roll, if needed
        if (!this._rolled) {
            this.roll();
        }

        // Define chat data
        const chatData = {
            formula: isPrivate ? "???" : this._formula,
            flavor: isPrivate ? null : chatOptions.flavor,
            user: chatOptions.user,
            isPublicRoll: !chatOptions.isPrivate,
            tooltip: isPrivate ? "" : await this.getTooltip({ from: "render" }),
            total: isPrivate ? "?" : Math.round(this._total * 100) / 100,
            data: this.data,
            l5r5e: isPrivate
                ? {}
                : {
                      dicesTypes: this.l5r5e.dicesTypes,
                      summary: this.l5r5e.summary,
                      dices: this.dice.map((d) => {
                          return {
                              diceTypeL5r: d instanceof L5rBaseDie,
                              rolls: d.results.map((r) => {
                                  return {
                                      result: d.constructor.getResultLabel(r.result),
                                  };
                              }),
                          };
                      }),
                  },
        };

        // Render the roll display template
        return renderTemplate(chatOptions.template, chatData);
    }

    /**
     * Transform a Roll instance into a ChatMessage, displaying the roll result.
     * This function can either create the ChatMessage directly, or return the data object that will be used to create.
     * @override
     */
    toMessage(messageData = {}, { rollMode = null, create = true } = {}) {
        console.log("RollL5r5e.toMessage", this); // TODO tmp

        // Perform the roll, if it has not yet been rolled
        if (!this._rolled) {
            this.evaluate();
        }

        const rMode = rollMode || messageData.rollMode || game.settings.get("core", "rollMode");

        let template = CONST.CHAT_MESSAGE_TYPES.ROLL;
        if (["gmroll", "blindroll"].includes(rMode)) {
            messageData.whisper = ChatMessage.getWhisperRecipients("GM");
        }
        if (rMode === "blindroll") messageData.blind = true;
        if (rMode === "selfroll") messageData.whisper = [game.user.id];

        // Prepare chat data
        messageData = mergeObject(
            {
                user: game.user._id,
                type: template,
                content: this._total,
                sound: CONFIG.sounds.dice,
            },
            messageData
        );
        messageData.roll = this;

        // Prepare message options
        const messageOptions = { rollMode: rMode };

        // Either create the message or just return the chat data
        return create ? CONFIG.ChatMessage.entityClass.create(messageData, messageOptions) : messageData;
    }

    /** @override */
    static fromData(data) {
        const roll = super.fromData(data);

        roll.data = data.data;
        roll.l5r5e = data.l5r5e;

        return roll;
    }

    /**
     * Represent the data of the Roll as an object suitable for JSON serialization
     * @override
     */
    toJSON() {
        const json = super.toJSON();

        json.data = this.data;
        json.l5r5e = this.l5r5e;

        return json;
    }
}
