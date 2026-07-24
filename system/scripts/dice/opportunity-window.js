const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Separate, single-instance Opportunity surface owned by one RollnKeepDialog. */
export class OpportunityWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        classes: ["l5r5e", "l5r5e-opportunity-window"],
        position: { width: 900, height: "auto" },
        window: { resizable: true, minimizable: true },
    };

    static PARTS = {
        content: {
            template: "systems/l5r5e/templates/dice/opportunity-window.hbs",
            scrollable: [".opportunity-list"],
        },
    };

    constructor(parent, mode) {
        if (!parent || !["reference", "spend"].includes(mode)) throw new TypeError("OpportunityWindow requires a roll parent and a valid mode");
        super({
            id: `l5r5e-opportunity-${mode}-${parent.message?.id ?? "roll"}`,
            window: { title: `l5r5e.automation.opportunity.title${mode === "reference" ? "Reference" : "Spend"}` },
        });
        this.rollParent = parent;
        this.mode = mode;
    }

    async _prepareContext() {
        return this.rollParent.getOpportunityWindowContext(this.mode);
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        if (this.mode !== "spend") return;
        for (const element of this.element.querySelectorAll("[data-opportunity-toggle]")) {
            element.addEventListener("change", (event) => this.rollParent.setOpportunitySelected(event.currentTarget.dataset.opportunityToggle, event.currentTarget.checked));
        }
        for (const element of this.element.querySelectorAll("[data-opportunity-adjust]")) {
            element.addEventListener("click", (event) => {
                event.preventDefault();
                this.rollParent.adjustOpportunitySpend(event.currentTarget.dataset.opportunityAdjust, Number(event.currentTarget.dataset.delta) || 0);
            });
        }
        for (const element of this.element.querySelectorAll("[data-opportunity-decision]")) {
            element.addEventListener("change", (event) => {
                const { opportunityDecision: key, field } = event.currentTarget.dataset;
                const value = event.currentTarget.multiple
                    ? [...event.currentTarget.selectedOptions].map((option) => option.value).filter(Boolean)
                    : event.currentTarget.value;
                this.rollParent.setOpportunityDecision(key, field, value);
            });
        }
        this.element.querySelector("[data-opportunity-confirm]")?.addEventListener("click", async (event) => {
            event.preventDefault();
            if (!this.rollParent.getOpportunityWindowContext(this.mode).valid) return;
            await this.refreshParentRoll();
            await this.close();
        });
    }

    /** Refresh the parent; the V2 compatibility bridge normalizes this legacy call shape. */
    refreshParentRoll() {
        return this.rollParent.render(false);
    }

    /** Refresh this ApplicationV2 child with an options object. */
    refreshOpportunityWindow() {
        return this.render({ force: true });
    }

    async close(options = {}) {
        this.rollParent?._forgetOpportunityWindow?.(this.mode, this);
        return super.close(options);
    }
}
