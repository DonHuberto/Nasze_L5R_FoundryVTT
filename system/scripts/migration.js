/**
 * L5R Migration class
 */
export class MigrationL5r5e {
    /**
     * Minimum Version needed for migration stuff to trigger
     * @type {string}
     */
    static NEEDED_VERSION = "1.3.0";

    /**
     * Return true if the version need some updates
     * @param {string} version
     * @return {boolean}
     */
    static needUpdate(version) {
        const currentVersion = game.settings.get("l5r5e", "systemMigrationVersion");
        return currentVersion && foundry.utils.isNewerVersion(version, currentVersion);
    }

    /**
     * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
     * @param options
     * @return {Promise<void>} A Promise which resolves once the migration is completed
     */
    static async migrateWorld(options = { force: false }) {
        if (!game.user.isFirstGM) {
            return;
        }

        // if (MigrationL5r5e.needUpdate("1.3.0")) {
        //     ChatMessage.create({"content": "<strong>L5R5E v1.3.0 :</strong><br>"});
        // }

        // Warn the users
        ui.notifications.info(
            `Applying L5R5e System Migration for version ${game.system.data.version}.` +
                ` Please be patient and do not close your game or shut down your server.`,
            { permanent: true }
        );

        // Migrate World Actors
        for (let actor of game.actors.contents) {
            try {
                const updateData = MigrationL5r5e._migrateActorData(actor, options);
                if (!foundry.utils.isEmpty(updateData)) {
                    console.log(`L5R5E | Migrating Actor entity ${actor.name}`);
                    await actor.update(updateData);
                }
            } catch (err) {
                err.message = `L5R5E | Failed L5R5e system migration for Actor ${actor.name}: ${err.message}`;
                console.error(err);
            }
        }

        // Migrate World Items
        for (let item of game.items.contents) {
            try {
                const updateData = MigrationL5r5e._migrateItemData(item.data, options);
                if (!foundry.utils.isEmpty(updateData)) {
                    console.log(`L5R5E | Migrating Item entity ${item.name}`);
                    await item.update(updateData);
                }
            } catch (err) {
                err.message = `L5R5E | Failed L5R5e system migration for Item ${item.name}: ${err.message}`;
                console.error(err);
            }
        }

        // Migrate Actor Override Tokens
        for (let scene of game.scenes.contents) {
            try {
                const updateData = MigrationL5r5e._migrateSceneData(scene.data, options);
                if (!foundry.utils.isEmpty(updateData)) {
                    console.log(`L5R5E | Migrating Scene entity ${scene.name}`);
                    await scene.update(updateData);
                    // If we do not do this, then synthetic token actors remain in cache
                    // with the un-updated actorData.
                    scene.tokens.contents.forEach((t) => (t._actor = null));
                }
            } catch (err) {
                err.message = `L5R5E | Failed L5R5e system migration for Scene ${scene.name}: ${err.message}`;
                console.error(err);
            }
        }

        // Migrate World Compendium Packs
        for (let pack of game.packs) {
            if (pack.metadata.package !== "world" || !["Actor", "Item", "Scene"].includes(pack.metadata.entity)) {
                continue;
            }
            await MigrationL5r5e._migrateCompendium(pack, options);
        }

        // Migrate ChatMessages
        try {
            const updatedChatList = [];
            for (let message of game.collections.get("ChatMessage")) {
                const updateData = MigrationL5r5e._migrateChatMessage(message.data, options);
                if (!foundry.utils.isEmpty(updateData)) {
                    updateData["_id"] = message.data._id;
                    updatedChatList.push(updateData);
                }
            }
            // Save all the modified entries at once
            if (updatedChatList.length > 0) {
                console.log(`L5R5E | Migrating ${updatedChatList.length} ChatMessage entities`);
                await ChatMessage.updateDocuments(updatedChatList);
            }
        } catch (err) {
            err.message = `L5R5E | Failed L5R5e system migration for ChatMessage`;
            console.error(err);
        }

        // Set the migration as complete
        await game.settings.set("l5r5e", "systemMigrationVersion", game.system.data.version);
        ui.notifications.info(`L5R5e System Migration to version ${game.system.data.version} completed!`, {
            permanent: true,
        });
    }

    /**
     * Apply migration rules to all Entities within a single Compendium pack
     * @param {Compendium} pack
     * @param options
     * @return {Promise}
     */
    static async _migrateCompendium(pack, options = { force: false }) {
        const entity = pack.metadata.entity;
        if (!["Actor", "Item", "Scene"].includes(entity)) {
            return;
        }

        const wasLocked = pack.locked;
        try {
            // Unlock the pack for editing
            await pack.configure({ locked: false });

            // Begin by requesting server-side data model migration and get the migrated content
            await pack.migrate();
            const documents = await pack.getDocuments();

            // Iterate over compendium entries - applying fine-tuned migration functions
            const updateDatasList = [];
            for (let ent of documents) {
                let updateData = {};

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
                if (foundry.utils.isEmpty(updateData)) {
                    continue;
                }

                // Add the entry, if data was changed
                updateData["_id"] = ent.data._id;
                updateDatasList.push(updateData);

                console.log(`L5R5E | Migrating ${entity} entity ${ent.name} in Compendium ${pack.collection}`);
            }

            // Save the modified entries
            if (updateDatasList.length > 0) {
                await pack.documentClass.updateDocuments(updateDatasList, { pack: pack.collection });
            }
        } catch (err) {
            // Handle migration failures
            err.message = `L5R5E | Failed system migration for entities ${entity} in pack ${pack.collection}: ${err.message}`;
            console.error(err);
        }

        // Apply the original locked status for the pack
        pack.configure({ locked: wasLocked });
        console.log(`L5R5E | Migrated all ${entity} contents from Compendium ${pack.collection}`);
    }

    /**
     * Migrate a single Scene entity to incorporate changes to the data model of it's actor data overrides
     * Return an Object of updateData to be applied
     * @param {Object} scene  The Scene data to Update
     * @param options
     * @return {Object}       The updateData to apply
     */
    static _migrateSceneData(scene, options = { force: false }) {
        const tokens = scene.tokens.map((token) => {
            const t = token.toJSON();
            if (!t.actorId || t.actorLink) {
                t.actorData = {};
            } else if (!game.actors.has(t.actorId)) {
                t.actorId = null;
                t.actorData = {};
            } else if (!t.actorLink) {
                const actorData = foundry.utils.duplicate(t.actorData);
                actorData.type = token.actor?.type;
                const update = MigrationL5r5e._migrateActorData(actorData, options);
                ["items", "effects"].forEach((embeddedName) => {
                    if (!update[embeddedName]?.length) {
                        return;
                    }
                    const updates = new Map(update[embeddedName].map((u) => [u._id, u]));
                    t.actorData[embeddedName].forEach((original) => {
                        const update = updates.get(original._id);
                        if (update) {
                            foundry.utils.mergeObject(original, update);
                        }
                    });
                    delete update[embeddedName];
                });

                foundry.utils.mergeObject(t.actorData, update);
            }
            return t;
        });
        return { tokens };
    }

    /**
     * Migrate a single Actor entity to incorporate latest data model changes
     * Return an Object of updateData to be applied
     * @param {Actor} actor   The actor to Update
     * @param options
     * @return {Object}       The updateData to apply
     */
    static _migrateActorData(actor, options = { force: false }) {
        const updateData = {};
        const actorData = actor.system;

        // We need to be careful for unlinked tokens, only the diff is store in "data".
        // ex no diff : actor = {type: "npc"}, actorData = undefined
        if (!actorData) {
            return updateData;
        }

        // ***** Start of 1.1.0 *****
        if (options?.force || MigrationL5r5e.needUpdate("1.1.0")) {
            // Add "Prepared" in actor
            if (actorData.prepared === undefined) {
                updateData["system.prepared"] = true;
            }

            // NPC are now without autostats, we need to save the value
            if (actor.type === "npc") {
                if (actorData.endurance < 1) {
                    updateData["system.endurance"] = (Number(actorData.rings.earth) + Number(actorData.rings.fire)) * 2;
                    updateData["system.composure"] =
                        (Number(actorData.rings.earth) + Number(actorData.rings.water)) * 2;
                    updateData["system.focus"] = Number(actorData.rings.air) + Number(actorData.rings.fire);
                    updateData["system.vigilance"] = Math.ceil(
                        (Number(actorData.rings.air) + Number(actorData.rings.water)) / 2
                    );
                }
            }
        }
        // ***** End of 1.1.0 *****

        // ***** Start of 1.3.0 *****
        if (options?.force || MigrationL5r5e.needUpdate("1.3.0")) {
            // PC/NPC removed notes useless props "value"
            if (actorData.notes?.value) {
                updateData["system.notes"] = actorData.notes.value;
            }

            // NPC have now more thant a Strength and a Weakness
            if (actor.type === "npc" && actorData.rings_affinities?.strength) {
                const aff = actorData.rings_affinities;
                updateData["system.rings_affinities." + aff.strength.ring] = aff.strength.value;
                updateData["system.rings_affinities." + aff.weakness.ring] = aff.weakness.value;

                // Delete old keys
                updateData["system.rings_affinities.-=strength"] = null;
                updateData["system.rings_affinities.-=weakness"] = null;
            }
        }
        // ***** End of 1.3.0 *****

        return updateData;
    }

    /**
     * Scrub an Actor's system data, removing all keys which are not explicitly defined in the system template
     * @param {Object} actorData The data object for an Actor
     * @return {Object}          The scrubbed Actor data
     */
    static cleanActorData(actorData) {
        const model = game.system.model.Actor[actorData.type];
        actorData.data = foundry.utils.filterObject(actorData.data, model);
        return actorData;
    }

    /**
     * Migrate a single Item entity to incorporate latest data model changes
     * @param item
     * @param options
     */
    static _migrateItemData(item, options = { force: false }) {
        // Nothing for now
        return {};
    }

    /**
     * Migrate a single Item entity to incorporate latest data model changes
     * @param {ChatMessageData} message
     * @param options
     */
    static _migrateChatMessage(message, options = { force: false }) {
        const updateData = {};

        // ***** Start of 1.3.0 *****
        if (options?.force || MigrationL5r5e.needUpdate("1.3.0")) {
            // Old chat messages have a "0" in content, in foundry 0.8+ the roll content is generated only if content is null
            if (message.content === "0") {
                updateData["content"] = "";
            }
        }

        return updateData;
    }
}
