Hooks.on("init", () => {
    // Register module settings.
    game.settings.register("l5r5e", "icBgColor", {
        name: game.i18n.localize("ic.bg.color"),
        hint: game.i18n.localize("hexa.color"),
        default: "rgba(255,255,255,0.5)",
        type: String,
        scope: "client",
        config: true,
    });
    game.settings.register("l5r5e", "icTextColor", {
        name: game.i18n.localize("ic.text.color"),
        hint: game.i18n.localize("hexa.color"),
        default: "rgba(0,0,0,0.75)",
        type: String,
        scope: "client",
        config: true,
    });
    game.settings.register("l5r5e", "emoteBgColor", {
        name: game.i18n.localize("emote.bg.color"),
        hint: game.i18n.localize("hexa.color"),
        default: "rgba(255,255,255,0.5)",
        type: String,
        scope: "client",
        config: true,
    });
    game.settings.register("l5r5e", "emoteTextColor", {
        name: game.i18n.localize("emote.text.color"),
        hint: game.i18n.localize("hexa.color"),
        default: "rgba(0,0,0,0.75)",
        type: String,
        scope: "client",
        config: true,
    });
    game.settings.register("l5r5e", "rollBgColor", {
        name: game.i18n.localize("roll.bg.color"),
        hint: game.i18n.localize("hexa.color"),
        default: "rgba(195,165,130,0.5)",
        type: String,
        scope: "client",
        config: true,
    });
    game.settings.register("l5r5e", "rollTextColor", {
        name: game.i18n.localize("roll.text.color"),
        hint: game.i18n.localize("hexa.color"),
        default: "rgba(0,0,0,0.75)",
        type: String,
        scope: "client",
        config: true,
    });
    game.settings.register("l5r5e", "otherBgColor", {
        name: game.i18n.localize("other.bg.color"),
        hint: game.i18n.localize("hexa.color"),
        default: "rgba(255,255,255,0.5)",
        type: String,
        scope: "client",
        config: true,
    });
    game.settings.register("l5r5e", "otherTextColor", {
        name: game.i18n.localize("other.text.color"),
        hint: game.i18n.localize("hexa.color"),
        default: "rgba(0,0,0,0.75)",
        type: String,
        scope: "client",
        config: true,
    });
    game.settings.register("l5r5e", "defaultChatPrefix", {
        name: game.i18n.localize("def.chat.pref"),
        hint: game.i18n.localize("spe.chat.pref"),
        default: "",
        type: String,
        scope: "client",
        config: true,
    });
});

Hooks.on("renderChatLog", (log, html) => {
    // Prepend inline CSS to the chatlog to style the chat messages.
    const icBgColor = game.settings.get("l5r5e", "icBgColor");
    const icTextColor = game.settings.get("l5r5e", "icTextColor");
    const emoteBgColor = game.settings.get("l5r5e", "emoteBgColor");
    const emoteTextColor = game.settings.get("l5r5e", "emoteTextColor");
    const rollBgColor = game.settings.get("l5r5e", "rollBgColor");
    const rollTextColor = game.settings.get("l5r5e", "rollTextColor");
    const otherBgColor = game.settings.get("l5r5e", "otherBgColor");
    const otherTextColor = game.settings.get("l5r5e", "otherTextColor");
    $(
        "<style type='text/css'> #chat-log .message.ic { background-color: " +
            icBgColor +
            "; color: " +
            icTextColor +
            " }\n #chat-log .message.ic .message-header { color: " +
            icTextColor +
            " }\n #chat-log .message.emote { background-color: " +
            emoteBgColor +
            "; color: " +
            emoteTextColor +
            " }\n #chat-log .message.emote .message-header { color: " +
            emoteTextColor +
            " }\n #chat-log .message.chatColorsRoll { background-color: " +
            rollBgColor +
            "; color: " +
            rollTextColor +
            " }\n #chat-log .message.chatColorsRoll .message-header { color: " +
            rollTextColor +
            " }\n #chat-log .message { background-color: " +
            otherBgColor +
            "; color: " +
            otherTextColor +
            " }\n #chat-log .message .message-header { color: " +
            otherTextColor +
            "; } </style>"
    ).prependTo(html);
});

Hooks.on("chatMessage", (chatLog, message, chatData) => {
    if (game.settings.get("l5r5e", "defaultChatPrefix")) {
        const prefix = game.settings.get("l5r5e", "defaultChatPrefix");

        // Check if the message begins with any command.
        let [command, match] = chatLog.constructor.parse(message);

        if (command === "none") {
            // If there is no command, insert the prefix and reprocess.
            chatLog.processMessage(prefix + " " + message);
            return false;
        }

        // Otherwise do nothing.
        return true;
    }
});

Hooks.on("renderChatMessage", (message, html, data) => {
    // Add extra CSS classes to rolls so we can style them.
    if (message.isRoll) {
        html.addClass("chatColorsRoll");
    }
});
