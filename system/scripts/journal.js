/**
 * Extends the JournalEntity to process special things from L5R.
 */
export class JournalL5r5e extends JournalEntry {
    /**
     * Render the text template for this Journal (tooltips and chat)
     * @return {Promise<string|null>}
     */
    async renderTextTemplate(page = this.getCurrentPage()) {
        if (!page) return null;
        const pageData = page.toObject(false);
        if (pageData.text?.content) {
            pageData.text.content = await foundry.applications.ux.TextEditor.implementation.enrichHTML(pageData.text.content, {
                async: true,
                secrets: page.isOwner,
                relativeTo: page,
            });
        }

        const tpl = await foundry.applications.handlebars.renderTemplate(`${CONFIG.l5r5e.paths.templates}journal/journal-text.html`, {
            data: pageData,
        });
        return tpl || null;
    }

    /**
     * Return the Current JournalEntryPage
     * @return JournalEntryPage
     */
    getCurrentPage() {
        const pageId = this.sheet?.pageId;
        if (pageId) {
            const page = this.pages.get(pageId);
            return page?.testUserPermission(game.user, "OBSERVER") ? page : null;
        }
        return Array.from(this.pages)
            .filter((page) => page.testUserPermission(game.user, "OBSERVER"))
            .sort((a, b) => a.sort - b.sort)[0] || null;
    }
}
