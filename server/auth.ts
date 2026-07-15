import { randomUUID } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";

import { config } from "./config.js";
import { decryptText, hashToken, randomToken } from "./crypto.js";
import { appDb } from "./db.js";
import { ApiError } from "./errors.js";
import { getBillingUser, quotaToDisplay } from "./new-api.js";
import type { AikartUserRow, AuthenticatedUser, PublicUser } from "./types.js";

export const SESSION_COOKIE = "aikart_session";

export async function createSession(userId: string) {
    const token = randomToken();
    const expiresAt = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000);
    await appDb.query(
        "INSERT INTO aikart_sessions (id, token_hash, user_id, expires_at) VALUES ($1, $2, $3, $4)",
        [randomUUID(), hashToken(token), userId, expiresAt],
    );
    return { token, expiresAt };
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date) {
    reply.setCookie(SESSION_COOKIE, token, {
        path: "/",
        httpOnly: true,
        secure: config.isProduction,
        sameSite: "lax",
        expires: expiresAt,
    });
}

export function clearSessionCookie(reply: FastifyReply) {
    reply.clearCookie(SESSION_COOKIE, {
        path: "/",
        httpOnly: true,
        secure: config.isProduction,
        sameSite: "lax",
    });
}

export async function deleteSession(token?: string) {
    if (!token) return;
    await appDb.query("DELETE FROM aikart_sessions WHERE token_hash = $1", [hashToken(token)]);
}

export async function loadAuthenticatedUser(token?: string): Promise<AuthenticatedUser | null> {
    if (!token) return null;
    const result = await appDb.query<AikartUserRow>(
        `SELECT u.* FROM aikart_sessions s
         JOIN aikart_users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > now()
         LIMIT 1`,
        [hashToken(token)],
    );
    const row = result.rows[0];
    if (!row || !row.encrypted_api_key) return null;

    const billingUser = await getBillingUser(Number(row.new_api_user_id));
    if (!billingUser || Number(billingUser.status) !== 1) return null;
    return {
        id: row.id,
        newApiUserId: Number(row.new_api_user_id),
        username: row.username,
        displayName: row.display_name || row.username,
        avatarUrl: row.avatar_url,
        role: Number(row.new_api_user_id) === config.platformAdminUserId || Number(row.new_api_role) >= 10 ? "admin" : "user",
        status: row.status,
        inviteCode: row.invite_code,
        invitedByUserId: row.invited_by_user_id,
        apiKey: decryptText(row.encrypted_api_key, config.contentEncryptionKey),
        apiKeyHint: row.api_key_hint,
        quota: Number(billingUser.quota) || 0,
    };
}

export function publicUser(user: AuthenticatedUser): PublicUser {
    return {
        id: user.id,
        newApiUserId: user.newApiUserId,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        inviteCode: user.inviteCode,
        invitedByUserId: user.invitedByUserId,
        apiKeyHint: user.apiKeyHint,
        balance: quotaToDisplay(user.quota),
        inviteLink: `${config.publicOrigin}/login?invite=${encodeURIComponent(user.inviteCode)}`,
        retentionDays: config.draftRetentionDays,
    };
}

export async function authenticateRequest(request: FastifyRequest) {
    if (request.aikartUser) return request.aikartUser;
    const user = await loadAuthenticatedUser(request.cookies[SESSION_COOKIE]);
    request.aikartUser = user;
    return user;
}

export async function requireAuth(request: FastifyRequest) {
    const user = await authenticateRequest(request);
    if (!user) throw new ApiError(401, "请先登录 AikArt", "authentication_required");
    if (user.status === "banned") throw new ApiError(403, "该账户已被管理员封禁", "account_banned");
}

export async function requireAdmin(request: FastifyRequest) {
    await requireAuth(request);
    if (request.aikartUser?.role !== "admin") {
        throw new ApiError(403, "需要管理员权限", "admin_required");
    }
}
