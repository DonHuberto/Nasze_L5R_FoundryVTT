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
        console.log("L5rBaseDie.constructor", termData, this); // TODO tmp
    }

    /**
     * Return a standardized representation for the displayed formula associated with this DiceTerm
     * @override
     */
    get formula() {
        return `${this.number}${this.constructor.DENOMINATION}${this.modifiers.join("")}`;
    }

    /**
     * Return a string used as the label for each rolled result
     * @override
     */
    static getResultLabel(result) {
        return `<img src="${CONFIG.L5r5e.paths.assets}dices/default/${this.FACES[result].image}.png" alt="${result}" />`;
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

        console.log("L5rBaseDie.evaluate.out", this); // TODO tmp

        return this;
    }

    /**
     * Roll the DiceTerm by mapping a random uniform draw against the faces of the dice term
     * @override
     */
    roll(options) {
        const roll = super.roll(options);

        //roll.l5r5e = this.l5r5e;

        console.log("L5rBaseDie.roll", roll); // TODO tmp

        return roll;
    }

    /** @override */
    static fromData(data) {
        const roll = super.fromData(data);

        roll.l5r5e = data.l5r5e;

        console.log("L5rBaseDie.fromData", roll); // TODO tmp
        return roll;
    }

    /**
     * Represent the data of the Roll as an object suitable for JSON serialization
     * @override
     */
    toJSON() {
        const json = super.toJSON();

        json.l5r5e = this.l5r5e;

        console.log("L5rBaseDie.toJSON", json); // TODO tmp
        return json;
    }
}
