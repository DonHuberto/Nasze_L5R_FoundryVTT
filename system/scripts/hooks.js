/* eslint-disable no-undef */
export default class HooksL5r5e {
    /**
     * Do anything after initialization but before ready
     */
    static setup() {
        // Enable embed Babele compendiums only if custom compendium is not found or disabled
        if (
            typeof Babele !== "undefined" &&
            Babele.get().modules.every((module) => module.module !== "l5r5e-custom-compendiums")
        ) {
            Babele.get().setSystemTranslationsDir("babele"); // Since Babele v2.0.4
        }
    }

    /**
     * Do anything once the system is ready
     */
    static async ready() {
        // Migration stuff
        if (game.l5r5e.migrations.needUpdate(game.l5r5e.migrations.NEEDED_VERSION)) {
            game.l5r5e.migrations.migrateWorld({ force: false });
        }

        // For some reasons, not always really ready, so wait a little
        await new Promise((r) => setTimeout(r, 2000));

        // Settings TN and EncounterType
        if (game.user.isGM) {
            new game.l5r5e.GmToolbox().render(true);
        }

        // ***** UI *****
        // Add title on button dice icon
        $(".chat-control-icon")[0].title = game.i18n.localize("l5r5e.chatdices.dicepicker");

        // Open Help dialog on clic on logo
        $("#logo")
            .on("click", () => new game.l5r5e.HelpDialog().render(true))
            .prop("title", game.i18n.localize("l5r5e.logo.alt"));

        // If any disclaimer "not translated by Edge"
        const disclaimer = game.i18n.localize("l5r5e.global.edge_translation_disclaimer");
        if (disclaimer !== "l5r5e.global.edge_translation_disclaimer") {
            ui.notifications.info(disclaimer);
        }
    }

    /**
     * SidebarTab
     */
    static renderSidebarTab(app, html, data) {
        // Add button on dice icon
        html.find(".chat-control-icon").click(async () => {
            new game.l5r5e.DicePickerDialog().render();
        });
    }

    /**
     * Modify the content for chat roll command
     *
     * The 0.8.x introduce a weird behavior, it get to roll.total as content event if a template was defined.
     * So we need to intercept a chat roll (/r 1dr) for having them use the right template and not the inline (=total)
     *
     * @param {ChatMessage} document
     * @param {Object}      data
     * @param {Object}      options
     * @param {string}      userId
     * @return {boolean}
     */
    static preCreateChatMessage(document, data, options, userId) {
        // Roll from DP have the "isL5r5eTemplate" option set
        if (!document.isRoll || options?.isL5r5eTemplate || !document.data?.roll) {
            return;
        }

        // Get the roll object
        const roll = game.l5r5e.RollL5r5e.fromJSON(document.data.roll);

        // Ignore non l5r roll (std or table)
        if (!roll.l5r5e?.dicesTypes?.l5r) {
            return;
        }

        // So now we have our wrong message only, redo it using the roll
        roll.toMessage();

        // Return false to let the system known we handled this
        return false;
    }

    /**
     * Chat Message
     */
    static renderChatMessage(message, html, data) {
        // Add a extra CSS class to roll
        if (message.isRoll) {
            html.addClass("roll");
            html.on("click", ".chat-dice-rnk", game.l5r5e.RollnKeepDialog.onChatAction.bind(this));
        }
    }

    /**
     * Combat tracker
     */
    static async renderCombatTracker(app, html, data) {
        // Display Combat bar (only for GMs)
        await this._gmCombatBar(app, html, data);
    }

    /**
     * Display a GM bar for Combat/Initiative
     * @private
     */
    static async _gmCombatBar(app, html, data) {
        // Only for GMs
        if (!game.user.isGM) {
            return;
        }

        // *** Conf ***
        const encounterTypeList = Object.keys(CONFIG.l5r5e.initiativeSkills);
        const prepared = {
            character: game.settings.get("l5r5e", "initiative-prepared-character"),
            adversary: game.settings.get("l5r5e", "initiative-prepared-adversary"),
            minion: game.settings.get("l5r5e", "initiative-prepared-minion"),
        };

        // *** Template ***
        const tpl = await renderTemplate(`${CONFIG.l5r5e.paths.templates}gm/combat-tracker-bar.html`, {
            encounterType: game.settings.get("l5r5e", "initiative-encounter"),
            encounterTypeList,
            prepared,
        });

        // Add/replace in bar
        const elmt = html.find("#l5r5e_gm_combat_tracker_bar");
        if (elmt.length > 0) {
            elmt.replaceWith(tpl);
        } else {
            html.find("#combat-round").append(tpl);
        }

        // Buttons Listeners
        // TODO event for multiple GM
        html.find(".encounter-control").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const encounter = $(event.currentTarget).data("id");
            if (!encounterTypeList.includes(encounter)) {
                return;
            }
            game.settings
                .set("l5r5e", "initiative-encounter", encounter)
                .then(() => HooksL5r5e._gmCombatBar(app, html, data));
        });

        html.find(".prepared-control").on("mousedown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const preparedId = $(event.currentTarget).data("id");
            if (!Object.hasOwnProperty.call(prepared, preparedId)) {
                return;
            }
            const rev = event.which === 3;
            const nextValue = {
                false: rev ? "true" : "null",
                true: rev ? "null" : "false",
                null: rev ? "false" : "true",
            };
            game.settings
                .set("l5r5e", `initiative-prepared-${preparedId}`, nextValue[prepared[preparedId]])
                .then(() => HooksL5r5e._gmCombatBar(app, html, data));
        });
    }

    /**
     * Compendium display
     */
    static async renderCompendium(app, html, data) {
        // templates "item" : add Rarity
        // Techniques / Peculiarities : add Ring / Rank
        if (app.collection.documentName === "Item") {
            const content = await app.collection.getDocuments();
            content.forEach((document) => {
                if (["weapon", "armor", "item", "peculiarity", "technique", "peculiarity"].includes(document.type)) {
                    html.find(`[data-document-id="${document.id}"]`).append(
                        `<i` +
                            (document.data.data.ring ? ` class="i_${document.data.data.ring}"` : ``) +
                            `>` +
                            (document.data.data.rarity
                                ? `${game.i18n.localize("l5r5e.rarity")} ${document.data.data.rarity}`
                                : "") +
                            (document.data.data.rank
                                ? game.i18n.localize("l5r5e.rank") + " " + document.data.data.rank
                                : "") +
                            `</i>`
                    );
                }
            });
            return false;
        }
    }

    /**
     * DiceSoNice - Add L5R DicePresets
     */
    static diceSoNiceReady(dice3d) {
        const texturePath = `${CONFIG.l5r5e.paths.assets}dices/default/3d/`;

        // dice3d.addSystem({
        //     id: "l5r5e",
        //     name: "Legend of the Five Rings 5E"
        // }, "force");

        // Rings
        dice3d.addDicePreset(
            {
                name: "L5R Ring Dice",
                type: "dr",
                labels: Object.keys(game.l5r5e.RingDie.FACES).map(
                    (e) => `${texturePath}${game.l5r5e.RingDie.FACES[e].image.replace("ring_", "")}.png`
                ),
                bumpMaps: Object.keys(game.l5r5e.RingDie.FACES).map(
                    (e) => `${texturePath}${game.l5r5e.RingDie.FACES[e].image.replace("ring_", "")}_bm.png`
                ),
                colorset: "black",
                system: "standard",
            },
            "d6"
        );

        // Skills
        dice3d.addDicePreset(
            {
                name: "L5R Skill Dice",
                type: "ds",
                labels: Object.keys(game.l5r5e.AbilityDie.FACES).map(
                    (e) => `${texturePath}${game.l5r5e.AbilityDie.FACES[e].image.replace("skill_", "")}.png`
                ),
                bumpMaps: Object.keys(game.l5r5e.AbilityDie.FACES).map(
                    (e) => `${texturePath}${game.l5r5e.AbilityDie.FACES[e].image.replace("skill_", "")}_bm.png`
                ),
                colorset: "white",
                system: "standard",
            },
            "d12"
        );
    }

    /**
     * DiceSoNice - Do not show 3D roll for the Roll n Keep series
     *
     * @param {string} messageId
     * @param {object} context
     */
    static diceSoNiceRollStart(messageId, context) {
        // In DsN 4.2.1+ the roll is altered in context.
        // So we need to get the original message instead of "context.roll.l5r5e?.history"
        const message = game.messages.get(messageId);
        if (message?._roll?.l5r5e?.history) {
            context.blind = true;
        }
    }
}
