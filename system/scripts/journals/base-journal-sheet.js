/**
 * Base JournalSheet for L5R5e
 * @extends {JournalSheet}
 */
export class BaseJournalSheetL5r5e extends JournalSheet {
    // /** @override */
    // static get defaultOptions() {
    //     return foundry.utils.mergeObject(super.defaultOptions, {
    //         classes: ["l5r5e", "sheet", "journal"], // app window-app sheet journal-sheet
    //         template: CONFIG.l5r5e.paths.templates + "journal/journal-sheet.html",
    //         width: 520,
    //         height: 480,
    //         tabs: [{ navSelector: ".journal-tabs", contentSelector: ".journal-body", initial: "description" }],
    //     });
    // }

    /**
     * Add the SendToChat button on top of sheet
     * @override
     */
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();

        // Send To Chat
        buttons.unshift({
            label: game.i18n.localize("l5r5e.global.send_to_chat"),
            class: "send-to-chat",
            icon: "fas fa-comment-dots",
            onclick: () =>
                game.l5r5e.HelpersL5r5e.debounce(
                    "send2chat-" + this.object.id,
                    () => game.l5r5e.HelpersL5r5e.sendToChat(this.object),
                    2000,
                    true
                )(),
        });

        return buttons;
    }

    /**
     * Activate a named TinyMCE text editor
     * @param {string} name             The named data field which the editor modifies.
     * @param {object} options          TinyMCE initialization options passed to TextEditor.create
     * @param {string} initialContent   Initial text content for the editor area.
     * @override
     */
    activateEditor(name, options = {}, initialContent = "") {
        if (initialContent) {
            initialContent = game.l5r5e.HelpersL5r5e.convertSymbols(initialContent, false);
        }
        super.activateEditor(name, options, initialContent);
    }

    /**
     * This method is called upon form submission after form data is validated
     * @param event {Event}       The initial triggering submission event
     * @param formData {Object}   The object of validated form data with which to update the object
     * @returns {Promise}         A Promise which resolves once the update operation has completed
     * @override
     */
    async _updateObject(event, formData) {
        if (formData.content) {
            formData.content = game.l5r5e.HelpersL5r5e.convertSymbols(formData.content, true);
        }
        return super._updateObject(event, formData);
    }

    /**
     * Subscribe to events from the sheet.
     * @param {jQuery} html HTML content of the sheet.
     */
    activateListeners(html) {
        super.activateListeners(html);

        // Commons
        game.l5r5e.HelpersL5r5e.commonListeners(html);

        // *** Everything below here is only needed if the sheet is editable ***
        // if (!this.isEditable) {
        //     return;
        // }
    }
}
