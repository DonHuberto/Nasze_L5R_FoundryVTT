/**
 * Base JournalSheet for L5R5e
 * @extends {JournalSheet}
 */
export class BaseJournalSheetL5r5e extends JournalSheet {
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
        // event.type = mcesave / submit
        if (formData.content) {
            formData.content = game.l5r5e.HelpersL5r5e.convertSymbols(formData.content, true);
        }
        return super._updateObject(event, formData);
    }
}
