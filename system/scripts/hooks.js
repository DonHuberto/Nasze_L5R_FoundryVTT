import { L5r5eHtmlMultiSelectElement } from "./misc/l5r5e-multiselect.js";

export default class HooksL5r5e {
    /**
     * Do anything after initialization but before ready
     */
    static setup() {
        // Enable embed Babele compendiums only if custom compendium is not found or disabled
        if (
            game.babele &&
            game.babele.modules.every((module) => module.module !== game.settings.get(CONFIG.l5r5e.namespace, "custom-compendium-name"))
        ) {
            game.babele.setSystemTranslationsDir("babele"); // Since Babele v2.0.7
        }
    }

    /**
     * Do anything once the system is ready
     */
    static async ready() {
        // If multiple GM connected, tag the 1st alive, useful for some traitements that need to be done once (migration, delete...)
        Object.defineProperty(game.user, "isFirstGM", {
            get: function () {
                return game.user.isGM && game.user.id === game.users.find((u) => u.active && u.isGM)?.id;
            },
        });

        // Migration stuff
        if (game.user.isFirstGM && game.l5r5e.migrations.needUpdate(game.l5r5e.migrations.NEEDED_VERSION)) {
            game.l5r5e.migrations.migrateWorld({ force: false }).then();
        }

        // Taken from dnd5 : Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
        Hooks.on("hotbarDrop", (bar, data, slot) => {
            if (data.type === "Item") {
                HooksL5r5e.#createItemMacro(data, slot);
                return false;
            }
        });

        // For some reasons, not always really ready, so wait a little
        await new Promise((r) => setTimeout(r, 2000));

        // Settings TN and EncounterType
        if (game.user.isGM) {
            new game.l5r5e.GmToolbox().render(true);
        }

        // ***** UI *****
        // Open Help dialog on clic on logo
        $("#logo")
            .on("click", () => new game.l5r5e.HelpDialog().render(true))
            .prop("title", game.i18n.localize("l5r5e.logo.alt"));

        // If any disclaimer "not translated by Edge"
        const disclaimer = game.i18n.localize("l5r5e.global.edge_translation_disclaimer");
        if (disclaimer !== "" && disclaimer !== "l5r5e.global.edge_translation_disclaimer") {
            ui.notifications.info(disclaimer);
        }

        // Find all additional source references that is not the official ones:
        const references = new Set(Object.keys(CONFIG.l5r5e.sourceReference));
        for(let pack of game.packs) {
            if(pack.metadata.packageType === "system") {
                continue;
            }
            const documents = await pack.getDocuments();
            for(let document of documents) {
                if(document?.system?.source_reference) {
                    references.add(document.system.source_reference.source);
                }
            }
        }
        game.settings.set(CONFIG.l5r5e.namespace, "all-compendium-references", Array.from(references));
    }

    /**
     * SidebarTab
     */
    static renderSidebarTab(app, html, data) {
        switch (app.tabName) {
            case "chat":
                // Add DP on dice icon
                html.find(`.chat-control-icon`).on("mousedown", async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    switch (event.which) {
                        case 1:
                            // Left clic - Local DP
                            new game.l5r5e.DicePickerDialog().render();
                            break;
                        case 3:
                            // Right clic - Players DP
                            if (game.user.isGM) {
                                game.l5r5e.HelpersL5r5e.debounce(
                                    "gm-request-dp",
                                    () => {
                                        game.l5r5e.sockets.openDicePicker({
                                            users: game.users.players.filter((u) => u.active && u.hasPlayerOwner),
                                            dpOptions: {
                                                skillsList: "artisan,martial,scholar,social,trade",
                                            },
                                        });
                                        ui.notifications.info("l5r5e.dice.dicepicker.gm_request_dp_to_players", {localize: true});
                                    },
                                    3000,
                                    true
                                )();
                            }
                            break;
                    }
                });

                // Add title on button dice icon
                html.find(".chat-control-icon")[0].title = game.i18n.localize("l5r5e.dice.dicepicker.title");
                break;

            case "settings":
                // Add Changelog link
                html.find("#game-details .system").append(
                    `<span><a href="${game.system.changelog}" target="_blank">Changelog</a>`
                    + ` <a href="${game.i18n.localize("l5r5e.settings.wiki.link")}" target="_blank">${game.i18n.localize("l5r5e.settings.wiki.title")}</a>`
                    + ` <a href="${game.i18n.localize("l5r5e.settings.custom-compendiums.link")}" target="_blank">${game.i18n.localize("l5r5e.settings.custom-compendiums.title")}</a>`
                    + `</span>`
                );
                break;
        }
    }

    /**
     * Chat Message
     */
    static renderChatMessage(message, html, data) {
        if (message.isRoll) {
            // Add an extra CSS class to roll
            html.addClass("roll");
            html.on("click", ".chat-dice-rnk", game.l5r5e.RollnKeepDialog.onChatAction.bind(this));

            // Remove specific elements
            if (game.user.isGM) {
                html.find(".player-only").remove();
            } else {
                html.find(".gm-only").remove();
            }
        }

        // Compendium folder link
        html.find(".compendium-link").on("click", (event) => {
            const packId = $(event.currentTarget).data("pack");
            if (packId) {
                const pack = game.packs.get(packId);
                if (pack) {
                    pack.render(true);
                }
            }
        });
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
            character: game.settings.get(CONFIG.l5r5e.namespace, "initiative-prepared-character"),
            adversary: game.settings.get(CONFIG.l5r5e.namespace, "initiative-prepared-adversary"),
            minion: game.settings.get(CONFIG.l5r5e.namespace, "initiative-prepared-minion"),
        };

        // *** Template ***
        const tpl = await renderTemplate(`${CONFIG.l5r5e.paths.templates}gm/combat-tracker-bar.html`, {
            encounterType: game.settings.get(CONFIG.l5r5e.namespace, "initiative-encounter"),
            encounterTypeList,
            prepared,
        });

        // Add/replace in bar
        const elmt = html.find("#l5r5e_gm_combat_tracker_bar");
        if (elmt.length > 0) {
            elmt.replaceWith(tpl);
        } else {
            html.find(".combat-tracker-header").append(tpl);
        }

        // Buttons Listeners
        html.find(".encounter-control").on("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const encounter = $(event.currentTarget).data("id");
            if (!encounterTypeList.includes(encounter)) {
                return;
            }
            game.settings.set(CONFIG.l5r5e.namespace, "initiative-encounter", encounter);
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
                false: rev ? "true" : "actor",
                true: rev ? "actor" : "false",
                actor: rev ? "false" : "true",
            };
            game.settings.set(CONFIG.l5r5e.namespace, `initiative-prepared-${preparedId}`, nextValue[prepared[preparedId]]);
        });
    }

    /**
     * Compendium display
     */
    static async renderCompendium(app, html, data) {
        if (app.collection.documentName === "Item") {
            const content = await app.collection.getDocuments();
            let sources_in_this_compendium = new Set([]);
            let filters_to_show = {
                rank: false,
                rarity: false,
                source: false,
                ring: false,
            }

            // Add additional data to the entries to make it faster to lookup.
            // Add Ring/rank/rarity information
            for (const document of content) {
                const entry = html.find(`[data-document-id="${document.id}"]`);
                if(document.system?.rank) {
                    entry.data("rank", document.system.rank);
                    filters_to_show.rank = true;
                }

                if(document.system?.source_reference) {
                    sources_in_this_compendium.add(document.system.source_reference.source);
                    entry.data("source", document.system.source_reference);
                    filters_to_show.source = true;
                }

                if(document.system?.ring) {
                    entry.data("ring", document.system.ring);
                    filters_to_show.ring = true
                }

                if(document.system?.rarity) {
                    entry.data("rarity", document.system.rarity);
                    filters_to_show.rarity = true;
                }

                // Add ring/rank/rarity information on the item in the compendium view
                if(document.system?.ring || document.system?.rarity || document.system?.ring) {
                    const ring_rarity_rank = await renderTemplate(`${CONFIG.l5r5e.paths.templates}compendium/ring-rarity-rank.html`, document.system);
                    entry.append(ring_rarity_rank);
                }
            }

            //Setup what the player cannot see.
            const officialContent = game.settings.get(CONFIG.l5r5e.namespace, "compendium-official-content-for-players");
            const unofficialContent = game.settings.get(CONFIG.l5r5e.namespace, "compendium-unofficial-content-for-players");
            const unavailableSourceForPlayers = game.settings.get(CONFIG.l5r5e.namespace, "all-compendium-references")
            .filter((element) => {
                if(CONFIG.l5r5e.sourceReference[element]) {
                    return officialContent.length > 0 ? !officialContent.includes(element) : false;
                }
                return unofficialContent.length > 0 ? !unofficialContent.includes(element) : false;
            });

            // Create the function that will hide/show elements based on various factors
            const header = html.find(".directory-header");
            const applyCompendiumFilter = function() {
                const rank_filter = header.find(".rank-filter").find(".selected").data("rank");
                const user_filter = header.find("l5r5e-multi-select").val();
                const ring_filter = header.find(".ring-filter").find(".selected").data("ring");
                const rarity_filter = header.find(".rarity-filter").find(".selected").data("rarity");

                $(html).find(".directory-item").each(function() {
                    const lineSource = $(this).data("source")?.source;
                    if(lineSource === null || lineSource === undefined) {
                        return; // We might have stuff in the compendium view that does not have a source (folders etc.) Ignore those.
                    }

                    let should_show = true;
                    if(unavailableSourceForPlayers.includes(lineSource)) {
                        if(game.user.isGM) {
                            should_show &= true;
                            $(this).addClass("not-for-players");
                            $(this).attr("data-tooltip", game.i18n.localize("l5r5e.compendium.not_for_players"));
                        }
                        else {
                            should_show &= false;
                        }
                    }

                    if(lineSource === "" && game.settings.get(CONFIG.l5r5e.namespace, "compendium-hide-empty-sources-from-players")) {
                        if(game.user.isGM) {
                            should_show &= true;
                            $(this).addClass("not-for-players");
                            $(this).attr("data-tooltip", game.i18n.localize("l5r5e.compendium.not_for_players"))
                        }
                        else {
                            should_show &= false;
                        }
                    }

                    if(rank_filter) {
                        should_show &= $(this).data("rank") == rank_filter;
                    }

                    if(user_filter.length) {
                        should_show &= user_filter.includes(lineSource);
                    }

                    if(ring_filter) {
                        should_show &= $(this).data("ring") == ring_filter
                    }

                    if(rarity_filter >= 0) {
                        should_show &= $(this).data("rarity") == rarity_filter
                    }

                    if(should_show) {
                        $(this).show();
                    } else {
                        $(this).hide();
                    }
                });
            }

            // Rank filter: Add the HTML element and on click handling
            if (filters_to_show.rank) {
                header.append(await renderTemplate(`${CONFIG.l5r5e.paths.templates}compendium/rank-filter.html`, {type: "rank", number:[1,2,3,4,5]}));
                header.find(".rank-filter").children().each(function() {
                    $(this).on("click", (event, rank=$(this).data("rank")) => {
                        const already_selected = $(event.target).hasClass("selected");
                        $(html).find(".rank-filter").children().each(function() {
                            $(this).removeClass("selected");
                        });

                        // Only select valid values
                        if(rank) {
                            $(event.target).addClass("selected");
                        }
                        // we click the same button to unselect
                        if(already_selected) {
                            $(event.target).removeClass("selected");
                        }

                        applyCompendiumFilter();
                    });
                });
            }

            if(filters_to_show.rarity) {
                header.append(await renderTemplate(`${CONFIG.l5r5e.paths.templates}compendium/rank-filter.html`, {type: "rarity", number:[0,1,2,3,4,5,6,7,8,9,10]}));
                header.find(".rarity-filter").children().each(function() {
                    $(this).on("click", (event, rarity=$(this).data("rarity")) => {
                        const already_selected = $(event.target).hasClass("selected");
                        $(html).find(".rarity-filter").children().each(function() {
                            $(this).removeClass("selected");
                        });

                        // Only select valid values
                        if(Number.isInteger(rarity)) {
                            $(event.target).addClass("selected");
                        }
                        // we click the same button to unselect
                        if(already_selected) {
                            $(event.target).removeClass("selected");
                        }

                        applyCompendiumFilter();
                    });
                });
            }

            if(filters_to_show.ring) {
                header.append(await renderTemplate(`${CONFIG.l5r5e.paths.templates}compendium/ring-filter.html`));
                header.find(".ring-filter").children().each(function() {
                    $(this).on("click", (event, ring=$(this).data("ringid")) => {
                        const already_selected = $(event.target).hasClass("selected");
                        $(html).find(".ring-filter").children().each(function() {
                            $(this).removeClass("selected");
                        });

                        if(ring) { // Do not keep the "reset" button highlighted
                            $(event.target).addClass("selected");
                        }
                        // we click the same button to unselect
                        if(already_selected) {
                            $(event.target).removeClass("selected");
                        }

                        applyCompendiumFilter();
                    });
                });
            }

            if(filters_to_show.source) {
                // Setup the source select and add it to the document with change callback
                const selectable_sources = game.settings.get(CONFIG.l5r5e.namespace, "all-compendium-references")
                .map((reference) => {
                    return {
                        disable: !sources_in_this_compendium.has(reference),
                        source: reference
                    }
                })
                .map((reference) => {
                    return {
                        value: reference.source,
                        label: CONFIG.l5r5e.sourceReference[reference.source]?.label ?? reference.source,
                        translate: true,
                        group: CONFIG.l5r5e.sourceReference[reference.source]?.type.split(",")[0] ?? "l5r5e.multiselect.sources_categories.others",
                        disabled: reference.disable
                    }
                });

                const filterSourcesBox = L5r5eHtmlMultiSelectElement.create({
                    name: "filter-sources",
                    options: selectable_sources,
                    localize: true,
                });
                header.append(filterSourcesBox.outerHTML);
                $("l5r5e-multi-select").on("change", (event) => {
                    applyCompendiumFilter();
                });

                // If gm add a extra button to easily filter the content to see the same stuff as a player
                if(game.user.isGM) {
                    if(unavailableSourceForPlayers.length > 0) {
                        const buttonHTML = `<button type="button" class="gm" data-tooltip="${game.i18n.localize('l5r5e.multiselect.player_filter_tooltip')}">`
                        + game.i18n.localize('l5r5e.multiselect.player_filter_label')
                        + '</button>'

                        const filterPlayerView = game.settings.get(CONFIG.l5r5e.namespace, "all-compendium-references")
                            .filter((item) => !unavailableSourceForPlayers.includes(item))
                            .filter((item) => sources_in_this_compendium.has(item));
                        $(buttonHTML).appendTo($(header).find("l5r5e-multi-select")).click(function() {
                            header.find("l5r5e-multi-select")[0].value = filterPlayerView;
                        });
                    }
                }
            }

            // TODO find a better way
            // This is ugly but if we hide the content too early then it won't be hidden for some reason.
            // Current guess is that the foundry search filter is doing something.
            // Adding a delay here so that we hide the content. This will fail on slow computers/network...
            setTimeout(() => {
                applyCompendiumFilter();
            }, 250)

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
        if (message?.rolls?.[0]?.l5r5e?.history) {
            context.blind = true;
        }
    }

    static updateCompendium(pack, documents, options, userId) {
        documents.forEach((document) => {
            const inc_reference = document?.system?.source_reference?.source;
            if(inc_reference) {
                const references = game.settings.get(CONFIG.l5r5e.namespace, "all-compendium-references");
                if(!references.includes(inc_reference)) {
                    references.push(inc_reference);
                    game.settings.set(CONFIG.l5r5e.namespace, "all-compendium-references", references);
                }
            }
        })
    }

    /**
     * Attempt to create a macro from the dropped data. Will use an existing macro if one exists.
     * @param {object} dropData     The dropped data
     * @param {number} slot         The hotbar slot to use
     * @returns {Promise}
     */
    static async #createItemMacro(dropData, slot) {
        const itemData = await Item.implementation.fromDropData(dropData);
        if (!itemData) {
            console.log("L5R5E | HK | Fail to get itemData", dropData);
            return null;
        }

        const macroData = {
            type: "script",
            scope: "actor",
            name: (itemData.actor?.name ? `${itemData.actor?.name} : ` : '') + itemData.name,
            img: itemData.img,
            command: `await Hotbar.toggleDocumentSheet("${itemData.uuid}")`,
        };

        // Assign the macro to the hotbar
        const macro = game.macros.find((m) =>
                m.name === macroData.name
                && m.command === macroData.command
                && m.isAuthor
            ) || await Macro.create(macroData);

        await game.user.assignHotbarMacro(macro, slot);
    }
}
