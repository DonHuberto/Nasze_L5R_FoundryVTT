import { L5R5E } from "../config.js";
import { inferActionTypes as inferStructuralActionTypes } from "../services/rule-utils.js";

export function getRollActionTypes() {
    const configured = globalThis.CONFIG?.l5r5e?.rollActionTypes ?? L5R5E.rollActionTypes;
    return Array.from(configured ?? []);
}

export function defaultActionsState(isActive = false) {
    const active = !!isActive;
    return getRollActionTypes().reduce((acc, action) => {
        acc[action] = active;
        return acc;
    }, {});
}

export function normalizeActions(actions) {
    const normalized = defaultActionsState();
    const actionTypes = Object.keys(normalized);
    if (actions === undefined || actions === null) {
        return normalized;
    }

    const toggleFromList = (list) => {
        list
            .map((action) => String(action ?? ""))
            .map((action) => action.toLowerCase().trim())
            .forEach((action) => {
                if (action && Object.prototype.hasOwnProperty.call(normalized, action)) {
                    normalized[action] = true;
                }
            });
    };

    if (Array.isArray(actions)) {
        toggleFromList(actions);
    } else if (typeof actions === "string") {
        toggleFromList(actions.split(/[\s,]+/).filter((value) => value.length > 0));
    } else if (typeof actions === "object") {
        actionTypes.forEach((action) => {
            if (Object.prototype.hasOwnProperty.call(actions, action)) {
                normalized[action] = !!actions[action];
            }
        });
    }

    return normalized;
}

export function inferActions(source) {
    return normalizeActions(inferStructuralActionTypes(source));
}
