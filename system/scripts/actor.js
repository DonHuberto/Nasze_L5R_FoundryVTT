/**
 * Extends the actor to process special things from L5R.
 */
export class ActorL5r5e extends Actor {
    /**
     * Create a new entity using provided input data
     * @override
     */
    static async create(data, options = {}) {
        // if (!Object.keys(data).includes("type")) {
        //     data.type = "character";
        // }

        // Replace default image
        data.img = `${CONFIG.l5r5e.paths.assets}icons/actors/${data.type}.svg`;

        // Some tweak on actors token
        data.token = data.token || {};
        switch (data.type) {
            case "character":
                mergeObject(
                    data.token,
                    {
                        // vision: true,
                        // dimSight: 30,
                        // brightSight: 0,
                        actorLink: true,
                        disposition: 1, // friendly
                        bar1: {
                            attribute: "fatigue",
                        },
                        bar2: {
                            attribute: "strife",
                        },
                    },
                    { overwrite: false }
                );
                break;

            case "npc":
                mergeObject(
                    data.token,
                    {
                        actorLink: false,
                        disposition: 0, // neutral
                        bar1: {
                            attribute: "fatigue",
                        },
                        bar2: {
                            attribute: "strife",
                        },
                    },
                    { overwrite: false }
                );
                break;
        }
        await super.create(data, options);
    }

    /** @override */
    prepareData() {
        super.prepareData();

        if (["character", "npc"].includes(this.data.type)) {
            const data = this.data.data;

            data.endurance = (Number(data.rings.earth) + Number(data.rings.fire)) * 2;
            data.composure = (Number(data.rings.earth) + Number(data.rings.water)) * 2;
            data.focus = Number(data.rings.air) + Number(data.rings.fire);
            data.vigilante = Math.floor((Number(data.rings.air) + Number(data.rings.water)) / 2);

            // Attributes bars
            data.void_points.max = data.rings.void;
            data.fatigue.max = data.endurance;
            data.strife.max = data.composure;

            // Make sure void points are never greater than max
            if (data.void_points.value > data.void_points.max) {
                data.void_points.value = data.void_points.max;
            }
        }
    }
}
