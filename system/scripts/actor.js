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

        // Some tweak on actors
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

        const actorData = this.data;
        const data = actorData.data;
        const isCharacter = ["character", "npc"].includes(actorData.type);

        if (isCharacter) {
            data.endurance = (Number(data.rings.earth) + Number(data.rings.fire)) * 2;
            data.composure = (Number(data.rings.earth) + Number(data.rings.water)) * 2;
            data.focus = Number(data.rings.air) + Number(data.rings.fire);
            data.vigilante = Math.floor((Number(data.rings.air) + Number(data.rings.water)) / 2);
            data.void_points.max = data.rings.void;

            // Make sure void points are never greater than max
            if (data.void_points.current > data.void_points.max) {
                data.void_points.current = data.void_points.max;
            }
        }
    }
}
