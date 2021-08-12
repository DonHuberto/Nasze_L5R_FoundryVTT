/**
 * Extends the actor to process special things from L5R.
 */
export class HelpersL5r5e {
    /**
     * Get Rings/Element for List / Select
     * @param {Actor|null} actor
     * @return {{id: string, label: *, value}[]}
     */
    static getRingsList(actor = null) {
        return CONFIG.l5r5e.stances.map((e) => ({
            id: e,
            label: game.i18n.localize(`l5r5e.rings.${e}`),
            value: actor?.data?.data?.rings?.[e] || 1,
        }));
    }

    /**
     * Get Skills for List / Select with groups
     * @param {boolean} useGroup
     * @return {{cat: any, id: any, label: *}[]}
     */
    static getSkillsList(useGroup = false) {
        if (!useGroup) {
            return Array.from(CONFIG.l5r5e.skills).map(([id, cat]) => ({
                id: id,
                cat: cat,
                label: game.i18n.localize(`l5r5e.skills.${cat}.${id}`),
            }));
        }

        const skills = {};
        Array.from(CONFIG.l5r5e.skills).forEach(([id, cat]) => {
            if (!skills[cat]) {
                skills[cat] = [];
            }
            skills[cat].push({
                id: id,
                cat: cat,
                label: game.i18n.localize(`l5r5e.skills.${cat}.${id}`),
            });
        });
        return skills;
    }

    /**
     * Get Techniques for List / Select
     * @param types           core|school|title|custom
     * @param displayInTypes  null|true|false
     * @returns {{displayInTypes: boolean|*, id: any, label: *, type: *}[]}
     */
    static getTechniquesList({ types = [], displayInTypes = null }) {
        return Array.from(CONFIG.l5r5e.techniques)
            .filter(
                ([id, cfg]) =>
                    (types.length === 0 || types.includes(cfg.type)) &&
                    (displayInTypes === null || cfg.displayInTypes === displayInTypes)
            )
            .map(([id, cfg]) => ({
                id,
                label: game.i18n.localize(`l5r5e.techniques.${id}`),
                type: cfg.type,
                displayInTypes: cfg.displayInTypes,
            }));
    }

    /**
     * Return the target object on a drag n drop event, or null if not found
     * @param {DragEvent} event
     * @return {Promise<null>}
     */
    static async getDragnDropTargetObject(event) {
        const json = event.dataTransfer.getData("text/plain");
        if (!json) {
            return null;
        }
        const data = JSON.parse(json);
        if (!data) {
            return null;
        }
        return await HelpersL5r5e.getObjectGameOrPack(data);
    }

    /**
     * Return the object from Game or Pack by his ID, or null if not found
     * @param {string}      id
     * @param {string}      type     Type (Item, JournalEntry...)
     * @param {any[]|null}  data     Plain data
     * @param {string|null} pack     Pack name
     * @param {string|null} parentId Used to avoid an infinite loop in properties if set
     * @return {Promise<null>}
     */
    static async getObjectGameOrPack({ id, type, data = null, pack = null, parentId = null }) {
        let document = null;

        try {
            // Direct Object
            if (data?._id) {
                document = HelpersL5r5e.createDocumentFromCompendium({ type, data });
            } else if (!id || !type) {
                return null;
            }

            // Named pack
            if (!document) {
                // If no pack passed, but it's a core item, we know the pack to get it
                if (!pack && id.substr(0, 7) === "L5RCore") {
                    pack = HelpersL5r5e.getPackNameForCoreItem(id);
                }

                if (pack) {
                    const tmpData = await game.packs.get(pack).getDocument(id);
                    if (tmpData) {
                        document = HelpersL5r5e.createDocumentFromCompendium({ type, data: tmpData });
                    }
                }
            }

            // Game object
            if (!document) {
                document = CONFIG[type].collection.instance.get(id);
            }

            // Unknown pack object, iterate all packs
            if (!document) {
                for (const comp of game.packs) {
                    // TODO Bug with babele if "comp.getDocument(id)" return null...
                    const babeleFix = (await comp.getIndex()).some((e) => e.id === id);
                    if (!babeleFix) {
                        continue;
                    }

                    const tmpData = await comp.getDocument(id);
                    if (tmpData) {
                        document = HelpersL5r5e.createDocumentFromCompendium({ type, data: tmpData });
                    }
                }
            }

            // Final
            if (document) {
                // Flag the source GUID
                if (document.uuid && !document.getFlag("core", "sourceId")) {
                    document.data.update({ "flags.core.sourceId": document.uuid });
                }

                // Care to infinite loop in properties
                if (!parentId) {
                    await HelpersL5r5e.refreshItemProperties(document);
                }
                document.prepareData();
            }
        } catch (err) {
            console.warn("L5R5E | ", err);
        }
        return document;
    }

    /**
     * Make a temporary item for compendium drag n drop
     * @param {string}          type
     * @param {ItemL5r5e|JournalL5r5e|any[]} data
     * @return {ItemL5r5e}
     */
    static createDocumentFromCompendium({ type, data }) {
        let document = null;

        switch (type) {
            case "Item":
                if (data instanceof game.l5r5e.ItemL5r5e) {
                    document = data;
                } else {
                    document = new game.l5r5e.ItemL5r5e(data);
                }
                break;

            case "JournalEntry":
                if (data instanceof game.l5r5e.JournalL5r5e) {
                    document = data;
                } else {
                    document = new game.l5r5e.JournalL5r5e(data);
                }
                break;

            default:
                console.log(`L5R5E | createObjectFromCompendium - Unmanaged type ${type}`);
                break;
        } // swi

        return document;
    }

    /**
     * Babele and properties specific
     * @param {Document} document
     * @return {Promise<void>}
     */
    static async refreshItemProperties(document) {
        if (document.data?.data?.properties && typeof Babele !== "undefined") {
            document.data.data.properties = await Promise.all(
                document.data.data.properties.map(async (property) => {
                    const gameProp = await HelpersL5r5e.getObjectGameOrPack({
                        id: property.id,
                        type: "Item",
                        parentId: document.data?._id || 1,
                    });
                    if (gameProp) {
                        return { id: gameProp.id, name: gameProp.name };
                    } else {
                        console.warn(`L5R5E | Unknown property id[${property.id}]`);
                    }
                    return property;
                })
            );
            document.data.update({ "data.properties": document.data.data.properties });
        }
    }

    /**
     * Convert (op), (ex)... to associated symbols for content/descriptions
     * @param {string}  text     Input text
     * @param {boolean} toSymbol If True convert symbol to html (op), if false html to symbol
     * @return {string}
     */
    static convertSymbols(text, toSymbol) {
        CONFIG.l5r5e.symbols.forEach((cfg, tag) => {
            if (toSymbol) {
                text = text.replace(
                    new RegExp(HelpersL5r5e.escapeRegExp(tag), "gi"),
                    `<i class="${cfg.class}" title="${game.i18n.localize(cfg.label)}"></i>`
                );
            } else {
                text = text.replace(new RegExp(`<i class="${cfg.class}" title(="[^"]*")?></i>`, "gi"), tag);
            }
        });
        return text;
    }

    /**
     * Escape Regx characters
     * @param {string} str
     * @return {string}
     */
    static escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * Get the associated pack for a core item (time saving)
     * @param {string} documentId
     * @return {string}
     */
    static getPackNameForCoreItem(documentId) {
        const core = new Map();

        // Items
        core.set("Pro", "l5r5e.core-properties");
        core.set("Kat", "l5r5e.core-techniques-kata");
        core.set("Kih", "l5r5e.core-techniques-kiho");
        core.set("Ins", "l5r5e.core-techniques-inversion");
        core.set("Inv", "l5r5e.core-techniques-invocations");
        core.set("Rit", "l5r5e.core-techniques-rituals");
        core.set("Shu", "l5r5e.core-techniques-shuji");
        core.set("Mah", "l5r5e.core-techniques-maho");
        core.set("Nin", "l5r5e.core-techniques-ninjutsu");
        core.set("Sch", "l5r5e.core-techniques-school");
        core.set("Mas", "l5r5e.core-techniques-mastery");
        core.set("Ite", "l5r5e.core-items");
        core.set("Arm", "l5r5e.core-armors");
        core.set("Wea", "l5r5e.core-weapons");
        core.set("Bon", "l5r5e.core-bonds");
        core.set("Tit", "l5r5e.core-titles");
        core.set("Itp", "l5r5e.core-item-patterns");
        core.set("Sig", "l5r5e.core-signature-scrolls");
        core.set("Dis", "l5r5e.core-peculiarities-distinctions");
        core.set("Pas", "l5r5e.core-peculiarities-passions");
        core.set("Adv", "l5r5e.core-peculiarities-adversities");
        core.set("Anx", "l5r5e.core-peculiarities-anxieties");

        // Journal
        core.set("Csc", "l5r5e.core-journal-school-curriculum");
        core.set("Con", "l5r5e.core-journal-conditions");
        core.set("Ter", "l5r5e.core-journal-terrain-qualities");

        return core.get(documentId.replace(/L5RCore(\w{3})\d+/gi, "$1"));
    }

    /**
     * Show a confirm dialog before a deletion
     * @param {string} content
     * @param {function} callback The callback function for confirmed action
     */
    static confirmDeleteDialog(content, callback) {
        new Dialog({
            title: game.i18n.localize("Delete"),
            content,
            buttons: {
                confirm: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: game.i18n.localize("Yes"),
                    callback,
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("No"),
                },
            },
        }).render(true);
    }

    /**
     * Display a dialog to choose what Item type to add
     * @param {string[]|null} types
     * @return {Promise<*>} Return the item type choice (armor, bond...)
     */
    static async showSubItemDialog(types = null) {
        // If no types, get the full list
        if (!types) {
            types = game.system.entityTypes.Item;
        }
        const title = game.i18n.format("ENTITY.Create", { entity: game.i18n.localize("Item") });

        // Render the template
        const html = await renderTemplate(`${CONFIG.l5r5e.paths.templates}dialogs/choose-item-type-dialog.html`, {
            type: null,
            types: types.reduce((obj, t) => {
                const label = CONFIG.Item.typeLabels[t] ?? t;
                obj[t] = game.i18n.has(label) ? game.i18n.localize(label) : t;
                return obj;
            }, {}),
        });

        // Display the dialog
        return Dialog.prompt({
            title: title,
            content: html,
            label: title,
            callback: (html) => $(html).find("[name='type'] option:selected").val(),
            rejectClose: false,
        });
    }

    /**
     * Notify Applications using Difficulty settings that the values was changed
     */
    static notifyDifficultyChange() {
        ["l5r5e-dice-picker-dialog", "l5r5e-gm-tools-dialog"].forEach((appId) => {
            const app = Object.values(ui.windows).find((e) => e.id === appId);
            if (app && typeof app.refresh === "function") {
                app.refresh();
            }
        });
    }

    /**
     * Compute the Xp cost for cursus and total
     * @param {ItemL5r5e|ItemL5r5e[]} itemsList Item Data
     * @return {{xp_used_total: number, xp_used: number}}
     */
    static getItemsXpCost(itemsList) {
        let xp_used = 0;
        let xp_used_total = 0;

        if (!Array.isArray(itemsList)) {
            itemsList = [itemsList];
        }

        itemsList.forEach((item) => {
            let xp = parseInt(item.data.xp_used_total || item.data.xp_used || 0);

            // Full  price
            xp_used_total += xp;

            // if not in curriculum, xp spent /2 for this item
            if (!item.data.in_curriculum && xp > 0) {
                xp = Math.ceil(xp / 2);
            }

            // Halved or full
            xp_used += xp;
        });
        return { xp_used, xp_used_total };
    }

    /**
     * Subscribe to common events from the sheet.
     * @param {jQuery} html HTML content of the sheet.
     * @param {Actor} actor Actor Object
     */
    static commonListeners(html, actor = null) {
        // Toggle
        html.find(".toggle-on-click").on("click", (event) => {
            const elmt = $(event.currentTarget).data("toggle");
            const tgt = html.find("." + elmt);
            tgt.toggleClass("toggle-active");
        });

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

        // Item detail tooltips
        const fctPos = (event, popup) => {
            let left = +event.clientX + 60,
                top = +event.clientY;

            let maxY = window.innerHeight - popup.outerHeight();
            if (top > maxY) {
                top = maxY - 10;
            }

            let maxX = window.innerWidth - popup.outerWidth();
            if (left > maxX) {
                left -= popup.outerWidth() + 100;
            }
            return { left: left + "px", top: top + "px", visibility: "visible" };
        };
        html.find(".l5r5e-tooltip")
            .on("mouseenter", async (event) => {
                $(document.body).find("#l5r5e-tooltip-ct").remove();

                const item = await HelpersL5r5e.getEmbedItemByEvent(event, actor);
                if (!item) {
                    return;
                }

                const tpl = await item.renderTextTemplate();
                if (!tpl) {
                    return;
                }

                const popup = $(document.body).append(
                    `<div id="l5r5e-tooltip-ct" class="l5r5e-tooltip l5r5e-tooltip-ct">${tpl}</div>`
                );
                popup.css(fctPos(event, popup));
            })
            .on("mousemove", (event) => {
                const popup = $(document.body).find("#l5r5e-tooltip-ct");
                if (popup) {
                    popup.css(fctPos(event, popup));
                }
            })
            .on("mouseleave", () => {
                $(document.body).find("#l5r5e-tooltip-ct").remove();
            }); // tooltips
    }

    /**
     * Get a Item from a Actor Sheet
     * @param {Event} event HTML Event
     * @param {ActorL5r5e} actor
     * @return {ItemL5r5e}
     */
    static async getEmbedItemByEvent(event, actor) {
        const current = $(event.currentTarget);
        const itemId = current.data("item-id");
        const propertyId = current.data("property-id");
        const itemParentId = current.data("item-parent-id");

        let item;
        if (propertyId) {
            item = await HelpersL5r5e.getObjectGameOrPack({ id: propertyId, type: "Item" });
        } else if (itemParentId) {
            // Embed Item
            const parentItem = actor.items.get(itemParentId);
            if (!parentItem) {
                return;
            }
            item = parentItem.items.get(itemId);
        } else {
            // Regular item
            item = actor.items.get(itemId);
        }
        if (!item) {
            return;
        }
        return item;
    }

    /**
     * Send the description of this Item to chat
     * @param {JournalL5r5e|ItemSheetL5r5e} object
     * @return {Promise<*>}
     */
    static async sendToChat(object) {
        // Get the html
        const tpl = await object.renderTextTemplate();
        if (!tpl) {
            return;
        }

        // Create the link
        let link = null;
        if (object.data.flags.core?.sourceId) {
            link = object.data.flags.core?.sourceId.replace(/(\w+)\.(.+)/, "@$1[$2]");
        } else if (object.pack) {
            link = `@Compendium[${object.pack}.${object.id}]{${object.name}}`;
        } else if (!object.actor) {
            link = object.link;
        }

        // Send to Chat
        return ChatMessage.create({
            content: `<div class="l5r5e-chat-item">${tpl}${link ? `<hr>` + link : ""}</div>`,
        });
    }

    /**
     * Return the RollMode for this ChatData
     * @param  {object} chatData
     * @return {string}
     */
    static getRollMode(chatData) {
        if (chatData.whisper.length === 1 && chatData.whisper[0] === game.user.id) {
            return "selfroll";
        }
        if (chatData.blind) {
            return "blindroll";
        }
        if (chatData.whisper.length > 1) {
            return "gmroll";
        }
        return "roll";
    }
}
