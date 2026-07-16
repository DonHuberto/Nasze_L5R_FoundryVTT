import { makeId } from "./rule-utils.js";

export class GmAuthorityService {
    constructor({ users = null } = {}) {
        this.users = users;
        this.results = new Map();
        this.pending = new Map();
    }

    activeGms() {
        const users = this.users ?? globalThis.game?.users ?? [];
        return [...users].filter((user) => user.active && user.isGM).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    }

    authorityUser() {
        return this.activeGms()[0] ?? null;
    }

    isAuthority(user = globalThis.game?.user) {
        return Boolean(user?.id && user.id === this.authorityUser()?.id);
    }

    request(type, data = {}, { requestId = makeId("authority") } = {}) {
        return { type, data, requestId, authorityUserId: this.authorityUser()?.id ?? null };
    }

    async execute(request, handler) {
        if (!request?.requestId) throw new Error("Authority requestId is required");
        if (this.results.has(request.requestId)) return { ...this.results.get(request.requestId), idempotent: true };
        if (this.pending.has(request.requestId)) return this.pending.get(request.requestId);
        const execution = Promise.resolve(handler(request.data, request)).then((result) => {
            const response = { requestId: request.requestId, ok: true, result };
            this.results.set(request.requestId, response);
            this.pending.delete(request.requestId);
            return response;
        }).catch((error) => {
            this.pending.delete(request.requestId);
            throw error;
        });
        this.pending.set(request.requestId, execution);
        return execution;
    }
}
