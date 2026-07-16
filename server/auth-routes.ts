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
import { getUserToken, listUserTokens } from "./new-api.js";
import { config } from "./config.js";
import { encryptText, maskApiKey } from "./crypto.js";
import { appDb } from "./db.js";
import { ApiError } from "./errors.js";
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
                apiTokenId: upstream.apiTokenId,
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

    app.get("/api/account/tokens", { preHandler: requireAuth }, async (request) => {
        const user = request.aikartUser!;
        return {
            items: await listUserTokens(user.newApiUserId, user.selectedTokenId),
            selectedTokenId: user.selectedTokenId,
        };
    });

    app.put("/api/account/token", { preHandler: requireAuth }, async (request) => {
        const body = recordBody(request.body);
        const tokenId = textValue(body.tokenId, "令牌", { required: true, max: 30 });
        if (!/^\d+$/.test(tokenId)) throw new ApiError(400, "令牌格式不正确", "invalid_token_id");
        const user = request.aikartUser!;
        const token = await getUserToken(user.newApiUserId, tokenId);
        if (!token) throw new ApiError(404, "令牌不存在、已禁用或不属于当前用户", "token_not_found");
        const hint = maskApiKey(token.key);
        await appDb.query(
            `UPDATE aikart_users
             SET encrypted_api_key = $2, api_key_hint = $3, selected_token_id = $4::bigint, updated_at = now()
             WHERE id = $1`,
            [user.id, encryptText(token.key, config.contentEncryptionKey), hint, token.id],
        );
        user.apiKey = token.key;
        user.apiKeyHint = hint;
        user.selectedTokenId = token.id;
        return { user: publicUser(user) };
    });
}
