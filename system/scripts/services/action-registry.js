const action = (actionId, actionTypes, requiresCheck, profiles, resolver, slotCost = "action") =>
    Object.freeze({ actionId, actionTypes: Object.freeze(actionTypes), requiresCheck, profiles: Object.freeze(profiles), resolver, slotCost });

export const ACTION_REGISTRY = Object.freeze({
    generic_roll: action("generic_roll", [], true, ["universal"], "dicePicker", "none"),
    assist: action("assist", ["support"], true, ["intrigue", "skirmish"], "dicePicker"),
    calming_breath: action("calming_breath", ["support"], false, ["intrigue", "duel", "skirmish"], "immediate"),
    guard: action("guard", ["support"], true, ["skirmish"], "dicePicker"),
    maneuver: action("maneuver", ["move"], true, ["skirmish"], "movement"),
    prepare_item: action("prepare_item", ["support"], false, ["duel", "skirmish"], "equipment"),
    strike: action("strike", ["attack"], true, ["duel", "skirmish"], "dicePicker"),
    wait: action("wait", ["support"], false, ["skirmish"], "immediate"),
    persuade: action("persuade", ["scheme"], true, ["intrigue"], "dicePicker"),
    challenge: action("challenge", ["scheme"], true, ["skirmish", "mass_battle"], "dicePicker"),
    center: action("center", ["support"], true, ["duel"], "dicePicker"),
    predict: action("predict", ["scheme"], false, ["duel"], "immediate"),
    concede: action("concede", [], false, ["duel"], "chat", "none"),
    staredown: action("staredown", [], false, ["duel"], "duel", "none"),
    assault: action("assault", ["attack"], true, ["mass_battle"], "dicePicker"),
    rally: action("rally", ["support"], true, ["mass_battle"], "dicePicker"),
    reinforce: action("reinforce", ["support"], true, ["mass_battle"], "dicePicker"),
    custom_action: action("custom_action", [], true, ["intrigue", "duel", "skirmish"], "dicePicker"),
    throw_item: action("throw_item", ["attack"], true, ["duel", "skirmish"], "equipment"),
    end_turn: action("end_turn", [], false, ["intrigue", "duel", "skirmish", "mass_battle"], "combat", "none"),
});
