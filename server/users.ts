import { randomUUID } from "node:crypto";

import { appDb, billingDb } from "./db.js";
import { encryptText, maskApiKey, randomToken } from "./crypto.js";
import { config } from "./config.js";
import type { AikartUserRow, BillingUserRow } from "./types.js";

let billingColumns: Set<string> | null = null;

async function getBillingColumns() {
    if (billingColumns) return billingColumns;
    const result = await billingDb.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'users'",
    );
    billingColumns = new Set(result.rows.map((row) => row.column_name));
    return billingColumns;
}

function makeInviteCode() {
    return randomToken(8).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase();
}

async function uniqueInviteCode() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const code = makeInviteCode();
        const exists = await appDb.query("SELECT 1 FROM aikart_users WHERE invite_code = $1", [code]);
        if (!exists.rowCount) return code;
    }
    return randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

async function ensureAikartUserForBillingUser(row: BillingUserRow) {
    const existing = await appDb.query<AikartUserRow>("SELECT * FROM aikart_users WHERE new_api_user_id = $1", [row.id]);
    if (existing.rows[0]) return existing.rows[0];
    const id = randomUUID();
    const code = await uniqueInviteCode();
    const inserted = await appDb.query<AikartUserRow>(
        `INSERT INTO aikart_users (id, new_api_user_id, username, display_name, new_api_role, invite_code)
         VALUES ($1, $2, $3, $3, $4, $5)
         ON CONFLICT (new_api_user_id) DO UPDATE SET username = EXCLUDED.username, new_api_role = EXCLUDED.new_api_role
         RETURNING *`,
        [id, row.id, row.username, row.role, code],
    );
    return inserted.rows[0];
}

async function billingInviter(userId: number) {
    const columns = await getBillingColumns();
    if (!columns.has("inviter_id")) return null;
    const result = await billingDb.query<{ inviter_id: string | null }>("SELECT inviter_id FROM users WHERE id = $1", [userId]);
    return result.rows[0]?.inviter_id ? Number(result.rows[0].inviter_id) : null;
}

async function resolveInviteCode(code: string) {
    const normalized = normalizeInviteCode(code);
    if (!normalized) return null;
    const local = await appDb.query<AikartUserRow>("SELECT * FROM aikart_users WHERE upper(invite_code) = upper($1)", [normalized]);
    if (local.rows[0]) return local.rows[0];

    const columns = await getBillingColumns();
    if (!columns.has("aff_code")) return null;
    const upstream = await billingDb.query<BillingUserRow>(
        'SELECT id, username, quota, role, status, "group" FROM users WHERE aff_code = $1 AND status = 1 LIMIT 1',
        [normalized],
    );
    return upstream.rows[0] ? ensureAikartUserForBillingUser(upstream.rows[0]) : null;
}

function normalizeInviteCode(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return "";
    try {
        const url = new URL(trimmed);
        return (
            url.searchParams.get("invite") ||
            url.searchParams.get("aff") ||
            url.searchParams.get("aff_code") ||
            url.searchParams.get("code") ||
            trimmed
        ).trim();
    } catch {
        return trimmed;
    }
}

export async function upsertLoggedInUser(input: {
    newApiUserId: number;
    username: string;
    displayName: string;
    avatarUrl: string;
    role: number;
    apiKey: string;
    inviteCode?: string;
}) {
    const existing = await appDb.query<AikartUserRow>("SELECT * FROM aikart_users WHERE new_api_user_id = $1", [input.newApiUserId]);
    const id = existing.rows[0]?.id || randomUUID();
    const ownInviteCode = existing.rows[0]?.invite_code || (await uniqueInviteCode());
    let inviter = existing.rows[0]?.invited_by_user_id ? null : await resolveInviteCode(input.inviteCode || "");
    if (!inviter && !existing.rows[0]?.invited_by_user_id) {
        const upstreamInviterId = await billingInviter(input.newApiUserId);
        if (upstreamInviterId && upstreamInviterId !== input.newApiUserId) {
            const result = await billingDb.query<BillingUserRow>(
                'SELECT id, username, quota, role, status, "group" FROM users WHERE id = $1 AND status = 1',
                [upstreamInviterId],
            );
            if (result.rows[0]) inviter = await ensureAikartUserForBillingUser(result.rows[0]);
        }
    }
    if (inviter?.new_api_user_id === String(input.newApiUserId)) inviter = null;

    const result = await appDb.query<AikartUserRow>(
        `INSERT INTO aikart_users
            (id, new_api_user_id, username, display_name, avatar_url, encrypted_api_key, api_key_hint, new_api_role,
             invite_code, invited_by_user_id, last_login_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
         ON CONFLICT (new_api_user_id) DO UPDATE SET
            username = EXCLUDED.username,
            display_name = EXCLUDED.display_name,
            avatar_url = EXCLUDED.avatar_url,
            encrypted_api_key = EXCLUDED.encrypted_api_key,
            api_key_hint = EXCLUDED.api_key_hint,
            new_api_role = EXCLUDED.new_api_role,
            invited_by_user_id = COALESCE(aikart_users.invited_by_user_id, EXCLUDED.invited_by_user_id),
            updated_at = now(),
            last_login_at = now()
         RETURNING *`,
        [
            id,
            input.newApiUserId,
            input.username,
            input.displayName,
            input.avatarUrl,
            encryptText(input.apiKey, config.contentEncryptionKey),
            maskApiKey(input.apiKey),
            input.role,
            ownInviteCode,
            inviter?.id || existing.rows[0]?.invited_by_user_id || null,
        ],
    );
    return result.rows[0];
}
