const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2, ItemSheetV2 } = foundry.applications.sheets;

function legacyOptions(applicationClass) {
    return applicationClass.defaultOptions ?? {};
}

/**
 * Build a detached template context without asking Foundry to serialize the
 * whole document. Legacy worlds can contain values which a newer DataModel
 * refuses to serialize (notably old embedded-item collections), while the
 * prepared `system` model itself remains usable by the sheet.
 */
function legacyDocumentSnapshot(document) {
    if (!document?._source) return document?.toObject?.(false) ?? {};
    const data = foundry.utils.deepClone(document._source);
    if (document.system) data.system = foundry.utils.deepClone(document.system);
    return data;
}

function v2Options(applicationClass, options = {}) {
    const legacy = legacyOptions(applicationClass);
    return {
        classes: [...(legacy.classes ?? [])],
        tag: "form",
        position: {
            width: legacy.width ?? "auto",
            height: legacy.height ?? "auto",
        },
        window: {
            title: legacy.title,
            resizable: legacy.resizable !== false,
        },
        form: {
            closeOnSubmit: Boolean(legacy.closeOnSubmit),
            submitOnChange: Boolean(legacy.submitOnChange),
            handler: LegacyApplicationV2.formHandler,
        },
        ...options,
    };
}

function activateLegacyTabs(application) {
    const definitions = legacyOptions(application.constructor).tabs ?? [];
    application._legacyTabState ??= new Map();
    application._tabs = definitions.map((definition) => {
        const nav = application.element.querySelector(definition.navSelector);
        const content = application.element.querySelector(definition.contentSelector);
        const tabs = nav ? [...nav.querySelectorAll("[data-tab]")] : [];
        const panels = content ? [...content.querySelectorAll(":scope > [data-tab], .tab[data-tab]")] : [];
        const initial = application._legacyTabState.get(definition.navSelector) ?? definition.initial ?? tabs[0]?.dataset.tab ?? null;
        const controller = {
            _navSelector: definition.navSelector,
            active: initial,
            activate(tab) {
                if (!tab) return;
                this.active = tab;
                application._legacyTabState.set(definition.navSelector, tab);
                for (const element of tabs) element.classList.toggle("active", element.dataset.tab === tab);
                for (const panel of panels) panel.classList.toggle("active", panel.dataset.tab === tab);
            },
        };
        for (const element of tabs) {
            element.addEventListener("click", (event) => {
                event.preventDefault();
                controller.activate(element.dataset.tab);
            });
        }
        controller.activate(initial);
        return controller;
    });
}

function bindLegacyDragDrop(application) {
    if (typeof application._createDragDropHandlers === "function") {
        application._legacyDragDrop ??= application._createDragDropHandlers();
        for (const handler of application._legacyDragDrop ?? []) handler.bind?.(application.element);
        return;
    }
    if (!application.isEditable) return;
    for (const definition of legacyOptions(application.constructor).dragDrop ?? []) {
        for (const draggable of application.element.querySelectorAll(definition.dragSelector)) {
            draggable.draggable = true;
            if (typeof application._onDragStart === "function") {
                draggable.addEventListener("dragstart", (event) => application._onDragStart(event));
            }
        }
        const dropTargets = definition.dropSelector
            ? application.element.querySelectorAll(definition.dropSelector)
            : [application.element];
        for (const target of dropTargets) {
            target.addEventListener("dragover", (event) => event.preventDefault());
            if (typeof application._onDrop === "function") {
                target.addEventListener("drop", (event) => application._onDrop(event));
            }
        }
    }
}

function legacyHeaderControls(application, controls = []) {
    if (typeof application._getHeaderButtons !== "function") return controls;
    return [
        ...application._getHeaderButtons().map((button) => ({
            action: button.class,
            icon: button.icon,
            label: button.label,
            onClick: button.onclick,
        })),
        ...controls,
    ];
}

export class LegacyApplicationV2 extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        tag: "form",
        form: {
            closeOnSubmit: false,
            submitOnChange: false,
            handler: LegacyApplicationV2.formHandler,
        },
        window: { resizable: true },
    };

    static get defaultOptions() {
        return {
            id: this.name,
            classes: [],
            template: null,
            title: "",
            width: "auto",
            height: "auto",
            resizable: true,
            closeOnSubmit: false,
            submitOnChange: false,
            tabs: [],
        };
    }

    static get PARTS() {
        return {
            form: {
                template: legacyOptions(this).template,
            },
        };
    }

    static async formHandler(event, _form, formData) {
        return this._updateObject?.(event, { ...(formData?.object ?? {}) });
    }

    constructor(object = {}, options = {}) {
        super(v2Options(new.target, options));
        this.object = object;
    }

    get isEditable() {
        return true;
    }

    async getData(options = {}) {
        const context = await super._prepareContext(options);
        return {
            ...context,
            object: this.object,
            data: this.object,
            editable: this.isEditable,
            options: { ...legacyOptions(this.constructor), editable: this.isEditable },
            cssClass: (legacyOptions(this.constructor).classes ?? []).join(" "),
        };
    }

    async _prepareContext(options) {
        return this.getData(options);
    }

    _configureRenderParts(options) {
        const parts = super._configureRenderParts(options);
        parts.form = { ...parts.form, template: legacyOptions(this.constructor).template };
        return parts;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        activateLegacyTabs(this);
        bindLegacyDragDrop(this);
        const jquery = globalThis.jQuery ?? globalThis.$;
        if (jquery) this.activateListeners(jquery(this.element));
    }

    _getHeaderControls() {
        return legacyHeaderControls(this, super._getHeaderControls());
    }

    _getHeaderButtons() {
        return [];
    }

    activateListeners(_html) {}

    async _updateObject(_event, formData) {
        this.object = foundry.utils.mergeObject(this.object ?? {}, foundry.utils.expandObject(formData), { inplace: false });
        return this.object;
    }

    render(force = true, options = {}) {
        if (typeof force === "object") return super.render(force);
        return super.render({ ...options, force: Boolean(force) });
    }
}

export class LegacyActorSheetV2 extends HandlebarsApplicationMixin(ActorSheetV2) {
    static DEFAULT_OPTIONS = {
        form: {
            closeOnSubmit: false,
            submitOnChange: true,
            handler: LegacyApplicationV2.formHandler,
        },
        window: { resizable: true },
    };

    static get defaultOptions() {
        return {
            id: this.name,
            classes: ["l5r5e", "sheet", "actor"],
            template: null,
            width: 600,
            height: 800,
            closeOnSubmit: false,
            submitOnChange: true,
            tabs: [],
        };
    }

    static get PARTS() {
        return {
            form: {
                template: legacyOptions(this).template,
            },
        };
    }

    constructor(options = {}) {
        super(v2Options(new.target, options));
    }

    get object() {
        return this.document;
    }

    async getData(options = {}) {
        const context = await super._prepareContext(options);
        const data = legacyDocumentSnapshot(this.actor);
        const items = this.actor.items.map((item) => legacyDocumentSnapshot(item));
        data.items = items;
        const defaults = legacyOptions(this.constructor);
        return {
            ...context,
            actor: this.actor,
            document: this.document,
            object: this.document,
            data,
            system: data.system,
            items,
            owner: this.actor.isOwner,
            limited: this.actor.limited,
            editable: this.isEditable,
            options: { ...defaults, editable: this.isEditable },
            cssClass: [...(defaults.classes ?? []), this.isEditable ? "editable" : "locked"].join(" "),
        };
    }

    async _prepareContext(options) {
        return this.getData(options);
    }

    _configureRenderParts(options) {
        const parts = super._configureRenderParts(options);
        parts.form = { ...parts.form, template: this.template };
        return parts;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        activateLegacyTabs(this);
        bindLegacyDragDrop(this);
        const jquery = globalThis.jQuery ?? globalThis.$;
        if (jquery) this.activateListeners(jquery(this.element));
    }

    _getHeaderControls() {
        return legacyHeaderControls(this, super._getHeaderControls());
    }

    _getHeaderButtons() {
        return [];
    }

    activateListeners(_html) {}

    async _updateObject(_event, formData) {
        const update = { ...formData };
        delete update._id;
        return this.document.update(update);
    }

    render(force = true, options = {}) {
        if (typeof force === "object") return super.render(force);
        return super.render({ ...options, force: Boolean(force) });
    }
}

export class LegacyItemSheetV2 extends HandlebarsApplicationMixin(ItemSheetV2) {
    static DEFAULT_OPTIONS = {
        form: {
            closeOnSubmit: false,
            submitOnChange: true,
            handler: LegacyApplicationV2.formHandler,
        },
        window: { resizable: true },
    };

    static get defaultOptions() {
        return {
            id: this.name,
            classes: ["l5r5e", "sheet", "item"],
            template: null,
            width: 520,
            height: 800,
            closeOnSubmit: false,
            submitOnChange: true,
            tabs: [],
        };
    }

    static get PARTS() {
        return {
            form: {
                template: legacyOptions(this).template,
            },
        };
    }

    constructor(options = {}) {
        super(v2Options(new.target, options));
    }

    get object() {
        return this.document;
    }

    async getData(options = {}) {
        const context = await super._prepareContext(options);
        const data = legacyDocumentSnapshot(this.item);
        const defaults = legacyOptions(this.constructor);
        return {
            ...context,
            actor: this.actor,
            item: this.item,
            document: this.document,
            object: this.document,
            data,
            system: data.system,
            owner: this.item.isOwner,
            editable: this.isEditable,
            options: { ...defaults, editable: this.isEditable },
            cssClass: [...(defaults.classes ?? []), this.isEditable ? "editable" : "locked"].join(" "),
        };
    }

    async _prepareContext(options) {
        return this.getData(options);
    }

    _configureRenderParts(options) {
        const parts = super._configureRenderParts(options);
        parts.form = { ...parts.form, template: legacyOptions(this.constructor).template };
        return parts;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        activateLegacyTabs(this);
        bindLegacyDragDrop(this);
        const jquery = globalThis.jQuery ?? globalThis.$;
        if (jquery) this.activateListeners(jquery(this.element));
    }

    _getHeaderControls() {
        return legacyHeaderControls(this, super._getHeaderControls());
    }

    _getHeaderButtons() {
        return [];
    }

    activateListeners(_html) {}

    async _updateObject(_event, formData) {
        const update = { ...formData };
        delete update._id;
        return this.document.update(update);
    }

    render(force = true, options = {}) {
        if (typeof force === "object") return super.render(force);
        return super.render({ ...options, force: Boolean(force) });
    }
}
