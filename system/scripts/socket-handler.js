/**
 * L5R Socket Handler
 */
export class SocketHandlerL5r5e {
    /**
     * Namespace in FVTT
     */
    static SOCKET_NAME = "system.l5r5e";

    constructor() {
        this.registerSocketListeners();
    }

    /**
     * registers all the socket listeners
     */
    registerSocketListeners() {
        game.socket.on(SocketHandlerL5r5e.SOCKET_NAME, (data) => {
            switch (data.type) {
                case "deleteChatMessage":
                    this._onDeleteChatMessage(data);
                    break;

                case "refreshAppId":
                    this._onRefreshAppId(data);
                    break;

                default:
                    console.warn(new Error("This socket event is not supported"), data);
                    break;
            }
        });
    }

    deleteChatMessage(messageId) {
        game.socket.emit(SocketHandlerL5r5e.SOCKET_NAME, {
            type: "deleteChatMessage",
            messageId,
            userId: game.userId,
        });
    }
    _onDeleteChatMessage(data) {
        const message = game.messages.get(data.messageId);
        // only delete the message if the user is a GM and the event emitter is one of the recipients
        if (game.user.isGM && message.data["whisper"].includes(data.userId)) {
            message.delete();
        }
    }

    /**
     * Refresh a app by it's id, not windowsId (ex "l5r5e-twenty-questions-dialog-kZHczAFghMNYFRWe", not "65")
     * usage : game.l5r5e.sockets.refreshAppId(appId);
     * @param appId
     */
    refreshAppId(appId) {
        game.socket.emit(SocketHandlerL5r5e.SOCKET_NAME, {
            type: "refreshAppId",
            appId,
        });
    }
    _onRefreshAppId(data) {
        const app = Object.values(ui.windows).find((e) => e.id === data.appId);
        if (!app) {
            return;
        }
        if (typeof app.refresh !== "function") {
            return;
        }
        app.refresh();
    }
}
