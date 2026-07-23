import { validateOpportunityDefinition } from "../services/opportunity-service.js";

const { api, sheets } = foundry.applications;

export class OpportunitySheetL5r5e extends api.HandlebarsApplicationMixin(sheets.ItemSheetV2) {
    static DEFAULT_OPTIONS = {
        classes: ["l5r5e", "opportunity-sheet"],
        position: { width: 650, height: "auto" },
        form: { closeOnSubmit: false, submitOnChange: true },
        window: { title: "TYPES.Item.opportunity", resizable: true },
    };

    static PARTS = {
        form: { template: "systems/l5r5e/templates/items/opportunity/opportunity-sheet.html" },
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const system = this.item.system;
        return {
            ...context,
            item: this.item,
            system,
            editable: this.isEditable,
            contextsJson: JSON.stringify(system.contexts ?? {}, null, 2),
            actionIdsCsv: (system.contexts?.actionIds ?? []).join(", "),
            requirementsJson: JSON.stringify(system.requirements ?? {}, null, 2),
            targetJson: JSON.stringify(system.target ?? {}, null, 2),
            effectJson: JSON.stringify(system.effect ?? {}, null, 2),
            durationJson: JSON.stringify(system.duration ?? null, null, 2),
            rings: ["any", "air", "earth", "fire", "water", "void"],
            timings: ["preValidation", "strife", "beforeSuccess", "afterSuccess", "beforeDamage", "afterDamage", "deferred", "manual"],
            automations: ["automatic", "confirm", "manual"],
        };
    }

    _processFormData(event, form, formData) {
        const data = super._processFormData(event, form, formData);
        data.system ??= {};
        for (const [field, target] of [["contextsJson", "contexts"], ["requirementsJson", "requirements"], ["targetJson", "target"], ["effectJson", "effect"], ["durationJson", "duration"]]) {
            if (data[field] === undefined) continue;
            try {
                data.system[target] = JSON.parse(data[field]);
            } catch (error) {
                throw new Error(game.i18n.format("l5r5e.automation.opportunity.invalidJson", { field, error: error.message }));
            }
            delete data[field];
        }
        if (data.actionIdsCsv !== undefined) {
            data.system.contexts = { ...(this.item.system.contexts ?? {}), ...(data.system.contexts ?? {}) };
            data.system.contexts.actionIds = [...new Set(String(data.actionIdsCsv).split(/[\s,]+/).map((value) => value.trim().toLowerCase()).filter(Boolean))];
            delete data.actionIdsCsv;
        }
        const candidate = { ...this.item.system, ...data.system };
        const validation = validateOpportunityDefinition(candidate);
        if (!validation.valid) throw new Error(game.i18n.format("l5r5e.automation.opportunity.invalidSchema", { fields: validation.errors.join(", ") }));
        return data;
    }
}
