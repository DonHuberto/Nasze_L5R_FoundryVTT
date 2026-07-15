const { CompendiumDirectory } = foundry.applications.sidebar.tabs;

export class CompendiumDirectoryL5r5e extends CompendiumDirectory {

    /** @inheritdoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.sidebarIcon = foundry.applications.sidebar.Sidebar.TABS.compendium.icon;
        return context;
    }
}