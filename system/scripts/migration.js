/**
 * L5R Migration class
 */
export class MigrationL5r5e {
    /**
     * Version needed for migration stuff to trigger
     * @type {string}
     */
    static NEEDED_VERSION = "1.1.0";

    /**
     * Return true if the current world need some updates
     * @returns {boolean}
     */
    static needUpdate() {
        const currentVersion = game.settings.get("l5r5e", "systemMigrationVersion");
        return currentVersion && isNewerVersion(MigrationL5r5e.NEEDED_VERSION, currentVersion);
    }

    /**
     * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
     * @return {Promise}      A Promise which resolves once the migration is completed
     */
    static async migrateWorld() {
        if (!game.user.isGM) {
            return;
        }

        ui.notifications.info(
            `Applying L5R5e System Migration for version ${game.system.data.version}.` +
                ` Please be patient and do not close your game or shut down your server.`,
            { permanent: true }
        );

        // Migrate World Actors
        for (let a of game.actors.entities) {
            try {
                const updateData = MigrationL5r5e._migrateActorData(a.data);
                if (!isObjectEmpty(updateData)) {
                    console.log(`Migrating Actor entity ${a.name}`);
                    await a.update(updateData, { enforceTypes: false });
                }
            } catch (err) {
                err.message = `Failed L5R5e system migration for Actor ${a.name}: ${err.message}`;
                console.error(err);
            }
        }

        // Migrate World Items
        for (let i of game.items.entities) {
            try {
                const updateData = MigrationL5r5e._migrateItemData(i.data);
                if (!isObjectEmpty(updateData)) {
                    console.log(`Migrating Item entity ${i.name}`);
                    await i.update(updateData, { enforceTypes: false });
                }
            } catch (err) {
                err.message = `Failed L5R5e system migration for Item ${i.name}: ${err.message}`;
                console.error(err);
            }
        }

        // Migrate Actor Override Tokens
        for (let s of game.scenes.entities) {
            try {
                const updateData = MigrationL5r5e._migrateSceneData(s.data);
                if (!isObjectEmpty(updateData)) {
                    console.log(`Migrating Scene entity ${s.name}`);
                    await s.update(updateData, { enforceTypes: false });
                }
            } catch (err) {
                err.message = `Failed L5R5e system migration for Scene ${s.name}: ${err.message}`;
                console.error(err);
            }
        }

        // Migrate World Compendium Packs
        for (let p of game.packs) {
            if (p.metadata.package !== "world") {
                continue;
            }
            if (!["Actor", "Item", "Scene"].includes(p.metadata.entity)) {
                continue;
            }
            await MigrationL5r5e._migrateCompendium(p);
        }

        // Set the migration as complete
        await game.settings.set("l5r5e", "systemMigrationVersion", game.system.data.version);
        ui.notifications.info(`L5R5e System Migration to version ${game.system.data.version} completed!`, {
            permanent: true,
        });
    }

    /**
     * Apply migration rules to all Entities within a single Compendium pack
     * @param pack
     * @return {Promise}
     */
    static async _migrateCompendium(pack) {
        const entity = pack.metadata.entity;
        if (!["Actor", "Item", "Scene"].includes(entity)) {
            return;
        }

        // Unlock the pack for editing
        const wasLocked = pack.locked;
        await pack.configure({ locked: false });

        // Begin by requesting server-side data model migration and get the migrated content
        await pack.migrate();
        const content = await pack.getContent();

        // Iterate over compendium entries - applying fine-tuned migration functions
        for (let ent of content) {
            let updateData = {};
            try {
                switch (entity) {
                    case "Actor":
                        updateData = MigrationL5r5e._migrateActorData(ent.data);
                        break;
                    case "Item":
                        updateData = MigrationL5r5e._migrateItemData(ent.data);
                        break;
                    case "Scene":
                        updateData = MigrationL5r5e._migrateSceneData(ent.data);
                        break;
                }
                if (isObjectEmpty(updateData)) {
                    continue;
                }

                // Save the entry, if data was changed
                updateData["_id"] = ent._id;
                await pack.updateEntity(updateData);
                console.log(`Migrated ${entity} entity ${ent.name} in Compendium ${pack.collection}`);
            } catch (err) {
                // Handle migration failures
                err.message = `Failed L5R5e system migration for entity ${ent.name} in pack ${pack.collection}: ${err.message}`;
                console.error(err);
            }
        }

        // Apply the original locked status for the pack
        pack.configure({ locked: wasLocked });
        console.log(`Migrated all ${entity} entities from Compendium ${pack.collection}`);
    }

    /**
     * Migrate a single Scene entity to incorporate changes to the data model of it's actor data overrides
     * Return an Object of updateData to be applied
     * @param {Object} scene  The Scene data to Update
     * @return {Object}       The updateData to apply
     */
    static _migrateSceneData(scene) {
        const tokens = duplicate(scene.tokens);
        return {
            tokens: tokens.map((t) => {
                if (!t.actorId || t.actorLink || !t.actorData.data) {
                    t.actorData = {};
                    return t;
                }
                const token = new Token(t);
                if (!token.actor) {
                    t.actorId = null;
                    t.actorData = {};
                } else if (!t.actorLink) {
                    const updateData = MigrationL5r5e._migrateActorData(token.data.actorData);
                    t.actorData = foundry.utils.mergeObject(token.data.actorData, updateData);
                }
                return t;
            }),
        };
    }

    /**
     * Migrate a single Actor entity to incorporate latest data model changes
     * Return an Object of updateData to be applied
     * @param {Actor} actor   The actor to Update
     * @return {Object}       The updateData to apply
     */
    static _migrateActorData(actor) {
        const updateData = {};
        const actorData = actor.data;

        // ***** Start of 1.1.0 *****
        // Add "Prepared" in actor
        if (actorData.prepared === undefined) {
            updateData["data.prepared"] = true;
        }

        // NPC are now without autostats, we need to save the value
        if (actor.type === "npc") {
            if (actorData.endurance < 1) {
                updateData["data.endurance"] = (Number(actorData.rings.earth) + Number(actorData.rings.fire)) * 2;
                updateData["data.composure"] = (Number(actorData.rings.earth) + Number(actorData.rings.water)) * 2;
                updateData["data.focus"] = Number(actorData.rings.air) + Number(actorData.rings.fire);
                updateData["data.vigilance"] = Math.ceil(
                    (Number(actorData.rings.air) + Number(actorData.rings.water)) / 2
                );
            }
        }
        // ***** End of 1.1.0 *****

        return updateData;
    }

    /**
     * Scrub an Actor's system data, removing all keys which are not explicitly defined in the system template
     * @param {Object} actorData The data object for an Actor
     * @return {Object}          The scrubbed Actor data
     */
    static cleanActorData(actorData) {
        const model = game.system.model.Actor[actorData.type];
        actorData.data = filterObject(actorData.data, model);
        return actorData;
    }

    /**
     * Migrate a single Item entity to incorporate latest data model changes
     * @param item
     */
    static _migrateItemData(item) {
        // Nothing for now
        return {};
    }
}
