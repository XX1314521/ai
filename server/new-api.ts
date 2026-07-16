import { randomBytes } from "node:crypto";

import type { PoolClient } from "pg";

import { config } from "./config.js";
import { maskApiKey } from "./crypto.js";
import { billingDb } from "./db.js";
import { ApiError } from "./errors.js";
import type { BillingUserRow } from "./types.js";

type NewApiToken = { id: string; key: string; name: string; group?: string };

type NewApiLoginBody = {
    success?: boolean;
    message?: string;
    data?: Record<string, unknown>;
};

export async function authenticateNewApi(username: string, password: string) {
    let response: Response;
    try {
        response = await fetch(`${config.newApiBaseUrl}/api/user/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ username, password }),
            redirect: "manual",
            signal: AbortSignal.timeout(15_000),
        });
    } catch (error) {
        throw new ApiError(
            502,
            `无法连接爱坤Ai登录服务：${error instanceof Error ? error.message : "网络错误"}`,
            "new_api_unavailable",
        );
    }

    const body = (await response.json().catch(() => ({}))) as NewApiLoginBody;
    if (!response.ok || body.success === false) {
        throw new ApiError(401, body.message || "爱坤Ai账号或密码错误", "invalid_credentials");
    }

    const userId = Number(body.data?.id ?? body.data?.user_id);
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new ApiError(502, "爱坤Ai登录响应缺少用户信息", "invalid_login_response");
    }

    const billingUser = await getBillingUser(userId);
    if (!billingUser || Number(billingUser.status) !== 1) {
        throw new ApiError(403, "爱坤Ai账户不可用", "account_disabled");
    }

    const apiToken = await getOrCreateAikartToken(userId, billingUser.group);
    return {
        userId,
        username: billingUser.username || String(body.data?.username || username),
        displayName: String(body.data?.display_name || body.data?.username || billingUser.username || username),
        avatarUrl: String(body.data?.profile_picture || body.data?.avatar_url || ""),
        role: Number(billingUser.role) || 1,
        quota: Number(billingUser.quota) || 0,
        apiKey: apiToken.key,
        apiTokenId: apiToken.id,
    };
}

export async function getBillingUser(userId: number, client?: PoolClient) {
    const executor = client || billingDb;
    const result = await executor.query<BillingUserRow>(
        'SELECT id, username, quota, role, status, "group" FROM users WHERE id = $1 LIMIT 1',
        [userId],
    );
    return result.rows[0] || null;
}

export async function getOrCreateAikartToken(userId: number, group: string, preferredTokenId?: string | null) {
    if (preferredTokenId) {
        const preferred = await getUserToken(userId, preferredTokenId);
        if (preferred) return preferred;
    }
    const existing = await billingDb.query<{ id: string; key: string; name: string }>(
        "SELECT id::text, key, name FROM tokens WHERE user_id = $1 AND status = 1 AND deleted_at IS NULL ORDER BY (name = 'AikArt') DESC, id ASC LIMIT 1",
        [userId],
    );
    if (existing.rows[0]?.key) return normalizeToken(existing.rows[0]);

    const storedKey = randomBytes(36).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const inserted = await billingDb.query<{ id: string; key: string; name: string }>(
        `INSERT INTO tokens
            (user_id, key, status, name, created_time, accessed_time, expired_time, remain_quota, unlimited_quota,
             model_limits_enabled, model_limits, allow_ips, used_quota, "group", cross_group_retry)
         VALUES ($1, $2, 1, 'AikArt', $3, 0, -1, 0, true, false, '', '', 0, $4, false)
         RETURNING id::text, key, name`,
        [userId, storedKey, now, group || "default"],
    );
    return normalizeToken(inserted.rows[0] || { id: "", key: storedKey, name: "AikArt" });
}

export async function getUserToken(userId: number, tokenId: string) {
    const result = await billingDb.query<{ id: string; key: string; name: string; group: string }>(
        `SELECT id::text, key, name
                , "group"
         FROM tokens
         WHERE id = $2::bigint AND user_id = $1 AND status = 1 AND deleted_at IS NULL
         LIMIT 1`,
        [userId, tokenId],
    );
    return result.rows[0] ? normalizeToken(result.rows[0]) : null;
}

export async function listUserTokens(userId: number, selectedTokenId?: string | null) {
    const result = await billingDb.query<{
        id: string;
        name: string;
        key: string;
        created_time: string;
        accessed_time: string;
        expired_time: string;
        unlimited_quota: boolean;
        remain_quota: string;
        group: string;
    }>(
        `SELECT id::text, name, key, created_time, accessed_time, expired_time,
                unlimited_quota, remain_quota, "group"
         FROM tokens
         WHERE user_id = $1 AND status = 1 AND deleted_at IS NULL
         ORDER BY (id::text = $2) DESC, (name = 'AikArt') DESC, id ASC`,
        [userId, selectedTokenId || ""],
    );
    return result.rows.map((row) => {
        const key = bearerKey(row.key);
        return {
            id: row.id,
            name: row.name || `令牌 ${row.id}`,
            hint: maskApiKey(key),
            selected: row.id === selectedTokenId,
            createdAt: epochDate(row.created_time),
            lastUsedAt: epochDate(row.accessed_time),
            expiresAt: Number(row.expired_time) > 0 ? epochDate(row.expired_time) : null,
            unlimited: Boolean(row.unlimited_quota),
            remainingBalance: quotaToDisplay(Number(row.remain_quota) || 0),
            group: row.group || "default",
        };
    });
}

export async function fetchNewApiModels(token: NewApiToken) {
    let response: Response;
    try {
        response = await fetch(`${config.newApiBaseUrl}/v1/models`, {
            headers: { Accept: "application/json", Authorization: `Bearer ${token.key}` },
            signal: AbortSignal.timeout(15_000),
        });
    } catch (error) {
        throw new ApiError(502, `无法连接爱坤Ai模型服务：${error instanceof Error ? error.message : "网络错误"}`, "new_api_models_unavailable");
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload && typeof payload === "object" && "error" in payload && payload.error && typeof payload.error === "object"
            ? String((payload.error as Record<string, unknown>).message || "模型接口请求失败")
            : "模型接口请求失败";
        throw new ApiError(response.status, message, "new_api_models_error");
    }

    const models = extractModelIds(payload);
    if (models.length || !token.group?.trim()) return models;

    // Some New API deployments return an empty /v1/models list for group tokens.
    // The abilities table is the authoritative fallback for that token group.
    try {
        const result = await billingDb.query<{ model: string }>(
            `SELECT DISTINCT model
             FROM abilities
             WHERE "group" = $1 AND enabled = true AND model IS NOT NULL AND model <> ''
             ORDER BY model`,
            [token.group.trim()],
        );
        return result.rows.map((row) => row.model.trim()).filter(Boolean);
    } catch {
        return models;
    }
}

function normalizeToken(token: { id: string; key: string; name: string; group?: string }) {
    return { id: token.id, key: bearerKey(token.key), name: token.name || "AikArt", group: token.group || "" };
}

function extractModelIds(payload: unknown): string[] {
    if (Array.isArray(payload)) {
        return Array.from(new Set(payload.flatMap((item) => {
            if (typeof item === "string") return item.trim() ? [item.trim()] : [];
            if (!item || typeof item !== "object") return [];
            const record = item as Record<string, unknown>;
            const value = [record.id, record.name, record.model].find((entry) => typeof entry === "string" && entry.trim());
            return typeof value === "string" ? [value.trim()] : [];
        }))).sort((a, b) => a.localeCompare(b));
    }
    if (!payload || typeof payload !== "object") return [];
    const record = payload as Record<string, unknown>;
    for (const key of ["data", "models", "items", "result"]) {
        const models = extractModelIds(record[key]);
        if (models.length) return models;
    }
    return [];
}

function epochDate(value: string) {
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

function bearerKey(value: string) {
    return value.startsWith("sk-") ? value : `sk-${value}`;
}

export function quotaToDisplay(quota: number) {
    return Math.max(0, quota) / config.newApiQuotaPerUnit;
}

export function displayToQuota(value: unknown) {
    const amount = typeof value === "number" ? value : Number(String(value || ""));
    if (!Number.isFinite(amount) || amount < 0) {
        throw new ApiError(400, "价格格式不正确", "invalid_price");
    }
    return Math.round(amount * config.newApiQuotaPerUnit);
}
