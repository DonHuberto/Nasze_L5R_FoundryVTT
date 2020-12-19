/**
 * Import Compendium from raw csv text
 */
export class ImporterL5r5e extends FormApplication {
    /**
     * Selected compendium
     * @private
     */
    _selectedCompendium = {
        name: "",
        type: "",
    };

    /**
     * Importable compendiums list (unlocked only)
     * @private
     */
    _compendiumsList = [];

    /**
     * Assign the default options
     * @override
     */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "l5r5e-importer-dialog",
            classes: ["l5r5e", "importer-dialog"],
            template: CONFIG.l5r5e.paths.templates + "importer/importer-dialog.html",
            title: "L5R Import",
            width: 400,
            height: 660,
            resizable: true,
        });
    }

    /**
     * Create dialog
     */
    constructor(options = null) {
        super(options);
        this._loadCompendiumsList();
        this._selectCompendiumByName(this._compendiumsList[0]?.collection);
    }

    /**
     * Load compendiums list (unlocked only)
     * @private
     */
    _loadCompendiumsList() {
        const packs = game.packs.filter((p) => {
            return p.locked === false && ["Item", "Actor"].includes(p.metadata.entity);
        });
        if (packs.length < 1) {
            return [];
        }
        packs.sort((a, b) => a.collection.localeCompare(b.collection));
        this._compendiumsList = packs;
    }

    /**
     * Select a compendium and type by name
     * @private
     */
    _selectCompendiumByName(name) {
        if (name == null) {
            return;
        }
        this._selectedCompendium = {
            name: name,
            type: this._compendiumsList.find((e) => e.collection === name).entity,
        };
    }

    /**
     * Construct and return the data object used to render the HTML template for this form application.
     * @param options
     * @return {Object}
     */
    getData(options = null) {
        return {
            data: {
                selectedCompendium: this._selectedCompendium,
                compendiumList: this._compendiumsList,
                typesList: {
                    Item: ["item", "armor", "weapon", "technique", "property", "peculiarity", "advancement"],
                    Actor: ["character", "npc"],
                },
            },
        };
    }

    /**
     * Render the dialog
     * @param force
     * @param options
     * @returns {Application}
     */
    render(force, options) {
        // GM only
        if (!game.user.isGM) {
            return;
        }

        options = {
            ...options,
        };

        if (force === undefined) {
            force = true;
        }

        return super.render(force, options);
    }

    /**
     * Listen to html elements
     * @override
     */
    activateListeners(html) {
        super.activateListeners(html);

        html.find("#l5r5e-import-cn").on("change", async (event) => {
            this._selectCompendiumByName(event.target.value);
            this.render(false);
        });
    }

    /**
     * This method is called upon form submission after form data is validated
     * @param event    The initial triggering submission event
     * @param formData The object of validated form data with which to update the object
     * @returns        A Promise which resolves once the update operation has completed
     * @override
     */
    async _updateObject(event, formData) {
        await this.import(
            formData.compendiumName,
            formData.importType,
            formData.importLang,
            formData.importDesc,
            formData.rawtext,
            formData.separator
        );
    }

    /**
     * Main function for importing
     *
     * @param {String} compendiumName CompendiumCollection name
     * @param {String} importType     Item type (armor, character...)
     * @param {String} rawText        Text to import
     * @param {String} separator      Separator text/character ";", "|"...
     */
    async import(compendiumName, importType, importLang, importDesc, rawText, separator) {
        try {
            if (!rawText || /^\s*$/.test(rawText)) {
                throw "RawText is empty";
            }
            if (!importType) {
                throw "ImportType is empty";
            }
            if (!importLang) {
                throw "importLang is empty";
            }
            if (!importDesc) {
                throw "importDesc is empty";
            }
            if (!separator) {
                throw "Separator is empty";
            }
            if (!separator.indexOf(rawText) < 0) {
                throw "Separator was not found in RawText";
            }

            // Find the target compendium
            const targetCompendium = await game.packs.find((p) => p.collection === compendiumName);
            if (targetCompendium == null) {
                throw "Could not find compendium with the name " + compendiumName;
            }

            // useful props
            const targetEntity = targetCompendium.metadata.entity;
            // const targetSystem = targetCompendium.metadata.system;

            // console.log('ImporterL5r5e | ', targetCompendium, targetEntity, importType, importLang, importDesc, separator); return;

            // Parse data
            let entitiesList = [];
            const linesList = rawText.match(/[^\r\n]+/g);
            for (let sCurrLine of linesList) {
                sCurrLine = sCurrLine.trim();
                if (sCurrLine) {
                    let aRows = this._line2Row(sCurrLine, separator);
                    let oEntity = this._template(targetEntity, importType, importLang, importDesc, aRows);

                    if (oEntity) {
                        entitiesList.push(oEntity);
                    } else {
                        console.warn(`ImporterL5r5e | wrong format for `, sCurrLine);
                    }
                }
            } //fr linesList

            if (entitiesList.length < 1) {
                throw "entitiesList is empty";
            }

            // Create temporary Actor entities which impose structure on the imported data
            let entities;
            switch (targetEntity) {
                case "Item":
                    entities = await Item.create(entitiesList, { temporary: true });
                    break;

                case "Actor":
                    entities = await Actor.create(entitiesList, { temporary: true });
                    break;

                default:
                    console.error("ImporterL5r5e | Unknown/unsupported TargetEntity " + targetEntity);
                    return;
            } //swi

            if (entitiesList.length === 1) {
                entities = [entities];
            }
            if (entities.length < 1) {
                throw "entities is empty";
            }

            // Save each temporary entity into the Compendium pack
            for (let entity of entities) {
                await targetCompendium.importEntity(entity);
                //console.log(`ImporterL5r5e | Imported entity ${entity.name} into Compendium pack ${targetCompendium.collection}`);
            } //fr

            //console.log(`ImporterL5r5e | Finished importing ${entities.length} entitie(s) into Compendium pack ${targetCompendium.collection}`);
            new Dialog({
                title: `ImporterL5r5e | Job finished`,
                content: `Finished importing ${entities.length} entitie(s) into Compendium pack ${targetCompendium.collection}`,
                buttons: {
                    ok: {
                        label: "Ok",
                    },
                },
                default: "ok",
            }).render(true);
        } catch (sEx) {
            console.error(sEx);

            new Dialog({
                title: `ImporterL5r5e | Job error`,
                content: sEx,
                buttons: {
                    ok: {
                        label: "Ok",
                    },
                },
                default: "ok",
            }).render(true);
        }
    }

    /**
     * Split and sanitize one line
     *
     * @param   {String} str       Text
     * @param   {String} separator Text separator
     * @returns {String}
     */
    _line2Row(str, separator) {
        if (separator === "]") {
            separator = "\\]";
        }
        if (separator === "|") {
            separator = "|";
        }
        if (separator === "\\") {
            separator = "\\\\";
        }
        return str
            .replace(new RegExp("^[" + separator + "]+|[" + separator + "]+$", "g"), "") // clean boundary separator
            .replace(new RegExp("([\\S]+)[\\s]*[\\\\]{2}[\\s]*([\\S]+)", "g"), "$1<br>$2") // "\\" -> "br"
            .split(separator)
            .map((s) => s.trim());
    }

    /**
     * Basic conversion to L5R5e template
     *
     * @param   {String}   targetEntity  Entity Type (Item, Actor...)
     * @param   {String}   importType    Import type for Items (edges, skills...)
     * @param   {String}   importLang    Language en,fr
     * @param   {String}   importDesc    Desc full|light
     * @param   {String[]} rows          Data's array
     * @returns {Object}
     */
    _template(targetEntity, importType, importLang, importDesc, rows) {
        const isEng = importLang === "en";
        const isLight = importDesc === "light";

        switch (targetEntity) {
            case "Item":
                // Subtypes of Item
                switch (importType) {
                    case "item":
                        return {
                            name: rows[isEng ? 1 : 0],
                            img: rows[10] || "systems/l5r5e/assets/icons/fire.svg",
                            permission: {
                                default: 0,
                            },
                            type: "item",
                            data: {
                                equipped: false,
                                quantity: 1,
                                weight: rows[3] || 0,
                                rarity: rows[2] || 0,
                                zeni: rows[4] || 0,
                                properties: ImporterL5r5e._formatProperties(rows[5]),
                                description: ImporterL5r5e._formatDescription(
                                    rows[isEng ? (isLight ? 8 : 9) : isLight ? 6 : 7]
                                ),
                            },
                        };
                }
                break;

            case "Actor":
                // Subtypes of Actor
                switch (importType) {
                    case "character":
                    case "npc":
                }
                break;
        }

        console.error(`ImporterL5r5e | Unknown/unsupported ${targetEntity} ImportType : ${importType}`);
    }

    /**
     * Basic Description formatting
     *
     * @param   {String} str Text
     * @returns {String}
     */
    static _formatDescription(str) {
        if (undefined === str) {
            return null;
        }
        return "<p>" + str.replace(new RegExp("<br>", "g"), "</p><p>") + "</p>";
    }

    /**
     * explode and get properties by name, store theirs ids
     * @private
     */
    static _formatProperties(str) {
        // TODO explode and get properties by name, store theirs ids
        return str;
    }
} //cls
