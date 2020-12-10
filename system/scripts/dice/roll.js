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

        // Parse flavor for stance and skillId
        const flavors = Array.from(args[0].matchAll(/\d+d(s|r)\[([^\]]+)\]/gmu));
        flavors.forEach((res) => {
            if (res[1] === "r" && !!res[2] && this.l5r5e.stance === "") {
                this.l5r5e.stance = res[2];
            }
            if (res[1] === "s" && !!res[2] && this.l5r5e.skillId === "") {
                this.l5r5e.skillId = res[2];
            }
        });

        // TODO parse difficulty stance skillId from cmd line ?
    }

    /**
     * Execute the Roll, replacing dice and evaluating the total result
     * @override
     **/
    evaluate({ minimize = false, maximize = false } = {}) {
        if (this._rolled) {
            throw new Error("This Roll object has already been rolled.");
        }
        if (this.terms.length < 1) {
            throw new Error("This Roll object need dice to be rolled.");
        }

        // Clean terms (trim symbols)
        this.terms = this._identifyTerms(this.constructor.cleanFormula(this.terms));

        // Roll dices and inner dices
        this._total = 0;

        // Roll
        super.evaluate({ minimize, maximize });

        // Current terms - L5R Summary
        this.terms.forEach((term) => this._l5rSummary(term));

        // Check inner L5R rolls - L5R Summary
        this._dice.forEach((term) => this._l5rSummary(term));

        // Store final outputs
        this._rolled = true;
        this.l5r5e.dicesTypes.std = this.dice.some((term) => term instanceof DiceTerm && !(term instanceof L5rBaseDie)); // ignore math symbols
        this.l5r5e.dicesTypes.l5r = this.dice.some((term) => term instanceof L5rBaseDie);

        return this;
    }

    /**
     * Summarise the total of success, strife... for L5R dices for the current roll
     *
     * @param term
     * @private
     */
    _l5rSummary(term) {
        if (!(term instanceof L5rBaseDie)) {
            return;
        }

        ["success", "explosive", "opportunity", "strife"].forEach((props) => {
            this.l5r5e.summary[props] += parseInt(term.l5r5e[props]);
        });
        // TODO Others advantage/disadvantage
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
            total +=
                (this.l5r5e.dicesTypes.std ? " | " : "") +
                ["success", "explosive", "opportunity", "strife"]
                    .map((props) => (summary[props] > 0 ? `<i class="${props}"></i> ${summary[props]}` : null))
                    .filter((c) => !!c)
                    .join(" | ");
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
            displaySummary: contexte?.from !== "render",
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

        const skillName =
            game.i18n.translations.l5r5e.skills?.[RollL5r5e.getCategoryForSkillId(this.l5r5e.skillId)]?.[
                this.l5r5e.skillId
            ] || "";

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
                      stance: this.l5r5e.stance,
                      skillName: skillName,
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

    /**
     * Return the categoryId for the skillId
     * TODO in proper category helper ?
     * @param skillId
     */
    static getCategoryForSkillId(skillId) {
        return Object.keys(game.i18n.translations.l5r5e.skills).find((e) => {
            return !!game.i18n.translations.l5r5e.skills?.[e]?.[skillId];
        });
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
