/* eslint-disable no-undef */
export default class HooksL5r5e {
    /**
     * Do anything after initialization but before ready
     */
    static setup() {
        // Embed Babele compendiums
        if (
            typeof Babele !== "undefined" &&
            Babele.get().modules.every((module) => module.lang !== "fr" || module.module !== "l5r5e-dev")
        ) {
            Babele.get().register({
                module: "../systems/l5r5e", // babele only accept modules, so... well :D
                lang: "fr",
                dir: "babele/fr-fr",
            });
        }
    }

    /**
     * Do anything once the system is ready
     */
    static ready() {
        // Migration stuff
        if (game.l5r5e.migrations.needUpdate()) {
            game.l5r5e.migrations.migrateWorld();
        }

        // Settings TN and EncounterType
        if (game.user.isGM) {
            new game.l5r5e.GmToolsDialog().render(true);
        }

        // ***** UI *****
        // Add title on button dice icon
        $(".chat-control-icon")[0].title = game.i18n.localize("l5r5e.chatdices.dicepicker");

        // Open Help dialog on clic on logo
        $("#logo")
            .on("click", () => new game.l5r5e.HelpDialog().render(true))
            .prop("title", game.i18n.localize("l5r5e.logo.alt"));

        // Spanish specific - Disclaimer "not translated by Edge"
        if (game.i18n.lang === "es") {
            ui.notifications.info(game.i18n.localize("l5r5e.global.edge_translation_disclaimer"));
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
            character: game.settings.get("l5r5e", "initiative.prepared.character"),
            adversary: game.settings.get("l5r5e", "initiative.prepared.adversary"),
            minion: game.settings.get("l5r5e", "initiative.prepared.minion"),
        };

        // *** Template ***
        const tpl = await renderTemplate(`${CONFIG.l5r5e.paths.templates}gm/combat-tracker-bar.html`, {
            encounterType: game.settings.get("l5r5e", "initiative.encounter"),
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
                .set("l5r5e", "initiative.encounter", encounter)
                .then(() => HooksL5r5e._gmCombatBar(app, html, data));
        });

        html.find(".prepared-control").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            let preparedId = $(event.currentTarget).data("id");
            if (!Object.hasOwnProperty.call(prepared, preparedId)) {
                return;
            }
            let value = prepared[preparedId];
            switch (value) {
                case "false":
                    value = "true";
                    break;
                case "true":
                    value = preparedId === "minion" ? "false" : "null";
                    break;
                case "null":
                    value = "false";
                    break;
            }
            game.settings
                .set("l5r5e", `initiative.prepared.${preparedId}`, value)
                .then(() => HooksL5r5e._gmCombatBar(app, html, data));
        });
    }

    /**
     * Compendium display
     */
    static async renderCompendium(app, html, data) {
        // templates "item" : add Rarity
        // Techniques / Peculiarities : add Ring / Rank
        if (app.entity === "Item") {
            const content = await app.getContent();
            content.forEach((item) => {
                if (["weapon", "armor", "item", "peculiarity", "technique", "peculiarity"].includes(item.type)) {
                    html.find(`[data-entry-id="${item._id}"]`).append(
                        `<i` +
                            (item.data.data.ring ? ` class="i_${item.data.data.ring}"` : ``) +
                            `>` +
                            (item.data.data.rarity
                                ? `${game.i18n.localize("l5r5e.rarity")} ${item.data.data.rarity}`
                                : "") +
                            (item.data.data.rank ? game.i18n.localize("l5r5e.rank") + " " + item.data.data.rank : "") +
                            `</i>`
                    );
                }
            });
            return false;
        }
    }

    /**
     * DiceSoNice Hook
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
                type: "ddr", // don't known why the "dd" prefix is required, term is "r"
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
                type: "dds",
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
}
