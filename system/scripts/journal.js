/**
 * Extends the JournalEntity to process special things from L5R.
 */
export class JournalL5r5e extends JournalEntry {
    /**
     * Render the text template for this Journal (tooltips and chat)
     * @return {Promise<string|null>}
     */
    async renderTextTemplate() {
        const tpl = await renderTemplate(`${CONFIG.l5r5e.paths.templates}journal/journal-text.html`, this);
        if (!tpl) {
            return null;
        }
        return tpl;
    }
}
