import { LegacyApplicationV2 } from "./legacy-v2-application.js";

/**
 * Read-only document presentation using the exact HTML rendered for chat.
 */
export class ItemPreviewApplication extends LegacyApplicationV2 {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["l5r5e", "item-preview"],
            template: "systems/l5r5e/templates/dialogs/item-preview.html",
            width: 620,
            height: "auto",
            resizable: true,
        });
    }

    async getData(options = {}) {
        return {
            ...(await super.getData(options)),
            content: await this.object?.renderTextTemplate?.(),
        };
    }
}
