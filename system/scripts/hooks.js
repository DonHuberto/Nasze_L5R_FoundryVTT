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
        // TODO do this in partial
        let bar = "";

        // *** Encounter Type ***
        const encounterIcons = {
            intrigue: "i_courtier",
            duel: "fas fa-tint", // fa-tint / fa-blind
            skirmish: "i_bushi",
            mass_battle: "fa fa-users",
        };
        const encounterType = game.settings.get("l5r5e", "initiative.encounter");
        Object.entries(CONFIG.l5r5e.initiativeSkills).forEach(([id, skill]) => {
            bar =
                bar +
                `<a class="encounter encounter-control" data-id="${id}">` +
                `<i class="${encounterIcons[id]}${id === encounterType ? " active" : ""}" title="${game.i18n.localize(
                    "l5r5e.conflict.initiative." + id
                )}"></i>` +
                `</a>`;
        });

        // *** Prepared ***
        // TODO
        // const encounterType = game.settings.get("l5r5e", "initiative.prepared");
        bar =
            bar +
            `<a class="encounter prepared-control" data-id="tmp">` +
            `<i class="fa fa-low-vision" title="npc prepared or not (WIP)"></i>` +
            `</a>`;

        const elmt = html.find("#l5r5e_encounter");
        if (elmt.length > 0) {
            elmt.html(bar);
        } else {
            html.find("#combat-round").append(`<nav class="encounters flexrow" id="l5r5e_encounter">${bar}</nav>`);
        }

        // Buttons Listener
        html.find(".encounter-control").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const encounter = $(event.currentTarget).data("id");
            game.settings
                .set("l5r5e", "initiative.encounter", encounter)
                .then(() => HooksL5r5e.renderCombatTracker(app, html, data));
        });

        // html.find(".prepared-control").on("click", (event) => {
        //     event.preventDefault();
        //     event.stopPropagation();
        //     let prepared = $(event.currentTarget).data('id');
        //     // if same, unset it
        //     if (prepared === encounterType) {
        //         prepared = "";
        //     }
        //     game.settings.set("l5r5e", "initiative.prepared", prepared).then(() => HooksL5r5e.renderCombatTracker(app, html, data));
        // });
    }

    /**
     * Compendium display
     */
    static async renderCompendium(app, html, data) {
        // Add Rank & Ring in the compendium
        if (app.entity === "Item") {
            const content = await app.getContent();
            content.forEach((item) => {
                const tags = [];
                if (item.data.data.rank) {
                    tags.push("<i>" + game.i18n.localize("l5r5e.rank") + " " + item.data.data.rank + "</i>");
                }
                if (item.data.data.ring) {
                    tags.push(`<i class="i_${item.data.data.ring}"></i>`);
                }
                if (tags.length > 0) {
                    html.find(`[data-entry-id='${item._id}']`).append(tags.join(" "));
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
