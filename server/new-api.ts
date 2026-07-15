import { randomBytes } from "node:crypto";

import type { PoolClient } from "pg";

import { config } from "./config.js";
import { billingDb } from "./db.js";
import { ApiError } from "./errors.js";
import type { BillingUserRow } from "./types.js";

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

    const apiKey = await getOrCreateAikartToken(userId, billingUser.group);
    return {
        userId,
        username: billingUser.username || String(body.data?.username || username),
        displayName: String(body.data?.display_name || body.data?.username || billingUser.username || username),
        avatarUrl: String(body.data?.profile_picture || body.data?.avatar_url || ""),
        role: Number(billingUser.role) || 1,
        quota: Number(billingUser.quota) || 0,
        apiKey,
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

async function getOrCreateAikartToken(userId: number, group: string) {
    const existing = await billingDb.query<{ key: string }>(
        "SELECT key FROM tokens WHERE user_id = $1 AND status = 1 AND deleted_at IS NULL ORDER BY (name = 'AikArt') DESC, id ASC LIMIT 1",
        [userId],
    );
    if (existing.rows[0]?.key) return bearerKey(existing.rows[0].key);

    const storedKey = randomBytes(36).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const inserted = await billingDb.query<{ key: string }>(
        `INSERT INTO tokens
            (user_id, key, status, name, created_time, accessed_time, expired_time, remain_quota, unlimited_quota,
             model_limits_enabled, model_limits, allow_ips, used_quota, "group", cross_group_retry)
         VALUES ($1, $2, 1, 'AikArt', $3, 0, -1, 0, true, false, '', '', 0, $4, false)
         RETURNING key`,
        [userId, storedKey, now, group || "default"],
    );
    return bearerKey(inserted.rows[0]?.key || storedKey);
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
