import type { FastifyInstance } from "fastify";

import {
    SESSION_COOKIE,
    authenticateRequest,
    clearSessionCookie,
    createSession,
    deleteSession,
    loadAuthenticatedUser,
    publicUser,
    requireAuth,
    setSessionCookie,
} from "./auth.js";
import { authenticateNewApi } from "./new-api.js";
import { recordBody, textValue } from "./http.js";
import { upsertLoggedInUser } from "./users.js";

export async function registerAuthRoutes(app: FastifyInstance) {
    app.post(
        "/api/auth/login",
        { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
        async (request, reply) => {
            const body = recordBody(request.body);
            const username = textValue(body.username, "爱坤Ai账号", { required: true, max: 120 });
            const password = textValue(body.password, "密码", { required: true, max: 500 });
            const inviteCode = textValue(body.inviteCode, "邀请码", { max: 100 });
            const upstream = await authenticateNewApi(username, password);
            const row = await upsertLoggedInUser({
                newApiUserId: upstream.userId,
                username: upstream.username,
                displayName: upstream.displayName,
                avatarUrl: upstream.avatarUrl,
                role: upstream.role,
                apiKey: upstream.apiKey,
                inviteCode,
            });
            const session = await createSession(row.id);
            setSessionCookie(reply, session.token, session.expiresAt);
            const user = await loadAuthenticatedUser(session.token);
            return { user: user ? publicUser(user) : null };
        },
    );

    app.get("/api/auth/me", async (request) => {
        const user = await authenticateRequest(request);
        return { user: user && user.status === "active" ? publicUser(user) : null };
    });

    app.post("/api/auth/logout", async (request, reply) => {
        await deleteSession(request.cookies[SESSION_COOKIE]);
        clearSessionCookie(reply);
        request.aikartUser = null;
        return { success: true };
    });

    app.get("/api/account/balance", { preHandler: requireAuth }, async (request) => {
        return { balance: publicUser(request.aikartUser!).balance };
    });
}
