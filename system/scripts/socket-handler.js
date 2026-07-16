/**
 * L5R Socket Handler
 */
export class SocketHandlerL5r5e {
    /**
     * Namespace in FVTT
     */
    static SOCKET_NAME = "system.l5r5e";
    authorityHandlers = new Map();
    pendingAuthorityRequests = new Map();
    decisionHandlers = new Map();
    pendingDecisionRequests = new Map();

    constructor() {
        this.registerSocketListeners();
    }

    /**
     * registers all the socket listeners
     */
    registerSocketListeners() {
        game.socket.on(SocketHandlerL5r5e.SOCKET_NAME, (payload) => {
            switch (payload.type) {
                case "deleteChatMessage":
                    this._onDeleteChatMessage(payload);
                    break;

                case "refreshAppId":
                    this._onRefreshAppId(payload);
                    break;

                case "updateMessageIdAndRefresh":
                    this._onUpdateMessageIdAndRefresh(payload);
                    break;

                case "openDicePicker":
                    this._onOpenDicePicker(payload);
                    break;

                case "authorityRequest":
                    this._onAuthorityRequest(payload);
                    break;

                case "authorityResponse":
                    this._onAuthorityResponse(payload);
                    break;

                case "decisionRequest":
                    this._onDecisionRequest(payload);
                    break;

                case "decisionResponse":
                    this._onDecisionResponse(payload);
                    break;

                default:
                    console.warn(new Error("L5R5E | SH | This socket event is not supported"), payload);
                    break;
            }
        });
    }

    registerAuthorityHandler(type, handler) {
        if (!type || typeof handler !== "function") throw new TypeError("Authority handler requires a type and function");
        this.authorityHandlers.set(type, handler);
    }

    registerDecisionHandler(type, handler) {
        if (!type || typeof handler !== "function") throw new TypeError("Decision handler requires a type and function");
        this.decisionHandlers.set(type, handler);
    }

    requestDecision(type, data = {}, { userId, timeout = 60000 } = {}) {
        if (!userId) return Promise.reject(new Error("A target user is required for the decision"));
        const request = game.l5r5e.authority.request(type, data);
        request.requesterUserId = game.user.id;
        request.decisionUserId = userId;
        const handler = this.decisionHandlers.get(type);
        if (userId === game.user.id && handler) return Promise.resolve(handler(data, request));
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingDecisionRequests.delete(request.requestId);
                reject(new Error(`Decision request timed out: ${type}`));
            }, timeout);
            this.pendingDecisionRequests.set(request.requestId, { resolve, reject, timer });
            game.socket.emit(SocketHandlerL5r5e.SOCKET_NAME, { type: "decisionRequest", request });
        });
    }

    async _onDecisionRequest(payload) {
        const request = payload.request;
        if (!request || request.decisionUserId !== game.user.id) return;
        const handler = this.decisionHandlers.get(request.type);
        let response;
        try {
            if (!handler) throw new Error(`Unknown decision operation: ${request.type}`);
            response = { requestId: request.requestId, ok: true, result: await handler(request.data, request) };
        } catch (error) {
            response = { requestId: request.requestId, ok: false, error: error.message };
        }
        game.socket.emit(SocketHandlerL5r5e.SOCKET_NAME, { type: "decisionResponse", requesterUserId: request.requesterUserId, response });
    }

    _onDecisionResponse(payload) {
        if (payload.requesterUserId !== game.user.id) return;
        const pending = this.pendingDecisionRequests.get(payload.response?.requestId);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pendingDecisionRequests.delete(payload.response.requestId);
        if (payload.response.ok) pending.resolve(payload.response.result);
        else pending.reject(new Error(payload.response.error ?? "Target decision failed"));
    }

    requestAuthority(type, data = {}, { timeout = 15000 } = {}) {
        const request = game.l5r5e.authority.request(type, data);
        request.requesterUserId = game.user.id;
        const handler = this.authorityHandlers.get(type);
        if (game.l5r5e.authority.isAuthority() && handler) return game.l5r5e.authority.execute(request, handler).then((response) => response.result);
        if (!request.authorityUserId) return Promise.reject(new Error("No active GM is available for the authoritative operation"));
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingAuthorityRequests.delete(request.requestId);
                reject(new Error(`Authority request timed out: ${type}`));
            }, timeout);
            this.pendingAuthorityRequests.set(request.requestId, { resolve, reject, timer });
            game.socket.emit(SocketHandlerL5r5e.SOCKET_NAME, { type: "authorityRequest", request });
        });
    }

    async _onAuthorityRequest(payload) {
        const request = payload.request;
        if (!request || !game.l5r5e.authority.isAuthority() || request.authorityUserId !== game.user.id) return;
        const handler = this.authorityHandlers.get(request.type);
        let response;
        try {
            if (!handler) throw new Error(`Unknown authority operation: ${request.type}`);
            response = await game.l5r5e.authority.execute(request, handler);
        } catch (error) {
            response = { requestId: request.requestId, ok: false, error: error.message };
        }
        game.socket.emit(SocketHandlerL5r5e.SOCKET_NAME, { type: "authorityResponse", requesterUserId: request.requesterUserId, response });
    }

    _onAuthorityResponse(payload) {
        if (payload.requesterUserId !== game.user.id) return;
        const pending = this.pendingAuthorityRequests.get(payload.response?.requestId);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pendingAuthorityRequests.delete(payload.response.requestId);
        if (payload.response.ok) pending.resolve(payload.response.result);
        else pending.reject(new Error(payload.response.error ?? "Authority operation failed"));
    }

    /**
     * Delete ChatMessage by ID, the GM permission is required (used in RnK).
     * @param {String} messageId
     */
    deleteChatMessage(messageId) {
        game.socket.emit(SocketHandlerL5r5e.SOCKET_NAME, {
            type: "deleteChatMessage",
            messageId,
            userId: game.userId,
        });
    }
    _onDeleteChatMessage(payload) {
        // Only delete the message if the user is a GM (otherwise it has no real effect)
        // Currently only used in RnK
        if (!game.user.isFirstGM || !game.settings.get(CONFIG.l5r5e.namespace, "rnk-deleteOldMessage")) {
            return;
        }
        game.messages.get(payload.messageId)?.delete();
    }

    /**
     * Refresh an app by his "id", not "appId" (ex "l5r5e-twenty-questions-dialog-kZHczAFghMNYFRWe", not "65")
     *
     * Usage : game.l5r5e.sockets.refreshAppId(appId);
     *
     * @param {String} appId
     */
    refreshAppId(appId) {
        game.l5r5e.HelpersL5r5e.debounce(appId, () => {
            game.socket.emit(SocketHandlerL5r5e.SOCKET_NAME, {
                type: "refreshAppId",
                appId,
            });
        })();
    }
    _onRefreshAppId(payload) {
        const app = game.l5r5e.HelpersL5r5e.getApplication(payload.appId);
        if (!app || typeof app.refresh !== "function") {
            return;
        }
        app.refresh();
    }

    /**
     * Change in app message and refresh (used in RnK)
     * @param {String} appId
     * @param {String} msgId
     */
    updateMessageIdAndRefresh(appId, msgId) {
        game.socket.emit(SocketHandlerL5r5e.SOCKET_NAME, {
            type: "updateMessageIdAndRefresh",
            appId,
            msgId,
        });
    }
    _onUpdateMessageIdAndRefresh(payload) {
        const app = game.l5r5e.HelpersL5r5e.getApplication(payload.appId);
        if (!app || !app.message || typeof app.refresh !== "function") {
            return;
        }
        app.message = game.messages.get(payload.msgId);
        app.refresh();
    }

    /**
     * Remotely open the DicePicker
     *
     * Usage : game.l5r5e.sockets.openDicePicker({
     *   users: game.users.players.filter(u => u.active && u.hasPlayerOwner),
     *   dpOptions: {
     *     ringId: 'water',
     *     skillId: 'unarmed',
     *     skillList: 'melee,range,unarmed',
     *     difficulty: 3,
     *     difficultyHidden: true,
     *   }
     * });
     *
     * @param {User[]}  users     Users list to trigger the DP (will be reduced to id for network perf.)
     * @param {Actor[]} actors    Actors list to trigger the DP (will be reduced to uuid for network perf.)
     * @param {Object}  dpOptions Any DicePickerDialog.options
     */
    openDicePicker({ users = [], actors = [], dpOptions = {} }) {
        // At least one user or one actor
        if (foundry.utils.isEmpty(users) && foundry.utils.isEmpty(actors)) {
            console.error("L5R5E | SH | openDicePicker - 'users' and 'actors' are both empty, use at least one.");
            return;
        }
        // Fail if dpOptions.actor* provided
        if (!foundry.utils.isEmpty(dpOptions?.actorName)) {
            console.error("L5R5E | SH | openDicePicker - Do not use 'dpOptions.actorName', use 'actors' list instead.");
            return;
        }
        if (!foundry.utils.isEmpty(dpOptions?.actorId)) {
            console.error("L5R5E | SH | openDicePicker - Do not use 'dpOptions.actorId', use 'actors' list instead.");
            return;
        }
        if (!foundry.utils.isEmpty(dpOptions?.actor)) {
            console.error("L5R5E | SH | openDicePicker - Do not use 'dpOptions.actor', use 'actors' list instead.");
            return;
        }

        game.socket.emit(SocketHandlerL5r5e.SOCKET_NAME, {
            type: "openDicePicker",
            users: users?.map((u) => u.id),
            actors: actors?.map((a) => a.uuid),
            dpOptions,
        });
    }
    _onOpenDicePicker(payload) {
        if (!foundry.utils.isEmpty(payload.users) && !payload.users.includes(game.user.id)) {
            return;
        }

        // Actors
        if (!foundry.utils.isEmpty(payload.actors)) {
            payload.actors.forEach((uuid) => {
                const actor = fromUuidSync(uuid);
                if (actor && actor.testUserPermission(game.user, "OWNER")) {
                    new game.l5r5e.DicePickerDialog({
                        ...payload.dpOptions,
                        actor: actor,
                    }).render(true);
                }
            });
            return;
        }

        // User Only : Let the DP select the actor
        new game.l5r5e.DicePickerDialog(payload.dpOptions).render(true);
    }
}
