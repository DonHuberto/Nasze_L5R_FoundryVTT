/**
 * L5R5e Base Die
 */
export class L5rBaseDie extends DiceTerm {
    /** Need to be override */
    static DENOMINATION = "";

    /** Need to be override */
    static FACES = {};

    /** @override */
    constructor(termData) {
        super(termData);
        this.l5r5e = { success: 0, explosive: 0, opportunity: 0, strife: 0 };
    }

    /**
     * Return the total number of success + explosives
     * @returns {number}
     */
    get totalSuccess() {
        return this.l5r5e.success + this.l5r5e.explosive;
    }

    /**
     * Return a standardized representation for the displayed formula associated with this DiceTerm
     * @override
     */
    get formula() {
        return `${this.number}${this.constructor.DENOMINATION}${this.modifiers.join("")}`;
    }

    /**
     * Return the full img string used as the label for each rolled result
     * @override
     */
    static getResultLabel(result) {
        return `<img src="${CONFIG.l5r5e.paths.assets}dices/default/${this.FACES[result].image}.svg" alt="${result}" />`;
    }

    /**
     * Return the url of the result face
     */
    static getResultSrc(result) {
        return `${CONFIG.l5r5e.paths.assets}dices/default/${this.FACES[result].image}.svg`;
    }

    /**
     * Return the total result of the DiceTerm if it has been evaluated
     * Always zero for L5R dices to not count in total for regular dices
     * @override
     */
    get total() {
        return 0;
    }

    /**
     * Evaluate the roll term, populating the results Array
     * @override
     */
    evaluate({ minimize = false, maximize = false } = {}) {
        if (this._evaluated) {
            throw new Error(`This ${this.constructor.name} has already been evaluated and is immutable`);
        }

        // Roll the initial number of dice
        for (let n = 1; n <= this.number; n++) {
            this.roll({ minimize, maximize });
        }

        // Apply modifiers
        this._evaluateModifiers();

        // Combine all results
        this.l5r5e = { success: 0, explosive: 0, opportunity: 0, strife: 0 };
        this.results.forEach((term) => {
            const face = this.constructor.FACES[term.result];
            ["success", "explosive", "opportunity", "strife"].forEach((props) => {
                this.l5r5e[props] += parseInt(face[props]);
            });
        });

        // Return the evaluated term
        this._evaluated = true;
        this.result = 0;

        return this;
    }

    /**
     * Roll the DiceTerm by mapping a random uniform draw against the faces of the dice term
     * @override
     */
    roll(options) {
        const roll = super.roll(options);

        //roll.l5r5e = this.l5r5e;

        return roll;
    }

    /** @override */
    static fromData(data) {
        const roll = super.fromData(data);

        roll.l5r5e = data.l5r5e;

        return roll;
    }

    /**
     * Represent the data of the Roll as an object suitable for JSON serialization
     * @override
     */
    toJSON() {
        const json = super.toJSON();

        json.l5r5e = this.l5r5e;

        return json;
    }
}
