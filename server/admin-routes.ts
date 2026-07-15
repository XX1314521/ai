import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";

import { requireAdmin } from "./auth.js";
import { appDb, billingDb } from "./db.js";
import { ApiError } from "./errors.js";
import { integerValue, recordBody, textValue } from "./http.js";
import { quotaToDisplay } from "./new-api.js";
import { getPlatformSettings, updatePlatformSettings } from "./settings.js";

export async function registerAdminRoutes(app: FastifyInstance) {
    app.get("/api/admin/stats", { preHandler: requireAdmin }, async () => {
        const [counts, settings] = await Promise.all([
            appDb.query<{
                users: string;
                banned_users: string;
                published_works: string;
                blocked_works: string;
                media_bytes: string;
                completed_orders: string;
                traded_quota: string;
                platform_fee_quota: string;
                invite_commission_quota: string;
            }>(
                `SELECT
                    (SELECT count(*) FROM aikart_users) AS users,
                    (SELECT count(*) FROM aikart_users WHERE status = 'banned') AS banned_users,
                    (SELECT count(*) FROM aikart_works WHERE status = 'published') AS published_works,
                    (SELECT count(*) FROM aikart_works WHERE status = 'blocked') AS blocked_works,
                    (SELECT COALESCE(sum(bytes), 0) FROM aikart_media WHERE deleted_at IS NULL) AS media_bytes,
                    (SELECT count(*) FROM aikart_purchases WHERE status = 'completed') AS completed_orders,
                    (SELECT COALESCE(sum(price_quota), 0) FROM aikart_purchases WHERE status = 'completed') AS traded_quota,
                    (SELECT COALESCE(sum(platform_fee_quota), 0) FROM aikart_purchases WHERE status = 'completed') AS platform_fee_quota,
                    (SELECT COALESCE(sum(invite_commission_quota), 0) FROM aikart_purchases WHERE status = 'completed') AS invite_commission_quota`,
            ),
            getPlatformSettings(),
        ]);
        const row = counts.rows[0];
        return {
            users: Number(row.users),
            bannedUsers: Number(row.banned_users),
            publishedWorks: Number(row.published_works),
            blockedWorks: Number(row.blocked_works),
            storageBytes: Number(row.media_bytes),
            completedOrders: Number(row.completed_orders),
            traded: quotaToDisplay(Number(row.traded_quota)),
            platformFees: quotaToDisplay(Number(row.platform_fee_quota)),
            inviteCommissions: quotaToDisplay(Number(row.invite_commission_quota)),
            settings: {
                platformFeePercent: settings.platformFeeBps / 100,
                inviteCommissionOfFeePercent: settings.inviteCommissionBps / 100,
                minPrice: settings.minPriceDisplay,
            },
        };
    });

    app.get("/api/admin/settings", { preHandler: requireAdmin }, async () => {
        const settings = await getPlatformSettings();
        return {
            platformFeePercent: settings.platformFeeBps / 100,
            inviteCommissionOfFeePercent: settings.inviteCommissionBps / 100,
            minPrice: settings.minPriceDisplay,
        };
    });

    app.patch("/api/admin/settings", { preHandler: requireAdmin }, async (request) => {
        const body = recordBody(request.body);
        const settings = await updatePlatformSettings({
            platformFeeBps:
                body.platformFeePercent === undefined ? undefined : Number(body.platformFeePercent) * 100,
            inviteCommissionBps:
                body.inviteCommissionOfFeePercent === undefined
                    ? undefined
                    : Number(body.inviteCommissionOfFeePercent) * 100,
            minPriceDisplay: body.minPrice === undefined ? undefined : Number(body.minPrice),
        });
        await audit(request.aikartUser!.id, "settings.update", "settings", "platform", body);
        return {
            platformFeePercent: settings.platformFeeBps / 100,
            inviteCommissionOfFeePercent: settings.inviteCommissionBps / 100,
            minPrice: settings.minPriceDisplay,
        };
    });

    app.get("/api/admin/users", { preHandler: requireAdmin }, async (request) => {
        const query = request.query as Record<string, unknown>;
        const page = integerValue(query.page, 1, 1, 100_000);
        const pageSize = integerValue(query.pageSize, 30, 1, 100);
        const search = textValue(query.search, "搜索词", { max: 100 });
        const result = await appDb.query<{
            id: string;
            new_api_user_id: string;
            username: string;
            display_name: string;
            avatar_url: string;
            status: string;
            invite_code: string;
            created_at: Date;
            last_login_at: Date;
            works: string;
            total: string;
        }>(
            `SELECT u.id, u.new_api_user_id, u.username, u.display_name, u.avatar_url, u.status,
                    u.invite_code, u.created_at, u.last_login_at,
                    (SELECT count(*) FROM aikart_works w WHERE w.owner_id = u.id AND w.status <> 'deleted') AS works,
                    count(*) OVER() AS total
             FROM aikart_users u
             WHERE ($1 = '' OR u.username ILIKE $2 OR u.display_name ILIKE $2 OR u.new_api_user_id::text = $1)
             ORDER BY u.created_at DESC
             LIMIT $3 OFFSET $4`,
            [search, `%${search}%`, pageSize, (page - 1) * pageSize],
        );
        const newApiIds = result.rows.map((row) => Number(row.new_api_user_id));
        const balances = newApiIds.length
            ? await billingDb.query<{ id: string; quota: string }>(
                  "SELECT id, quota FROM users WHERE id = ANY($1::bigint[])",
                  [newApiIds],
              )
            : { rows: [] as Array<{ id: string; quota: string }> };
        const balanceMap = new Map(balances.rows.map((row) => [Number(row.id), quotaToDisplay(Number(row.quota))]));
        return {
            items: result.rows.map((row) => ({
                id: row.id,
                newApiUserId: Number(row.new_api_user_id),
                username: row.username,
                displayName: row.display_name || row.username,
                avatarUrl: row.avatar_url,
                status: row.status,
                inviteCode: row.invite_code,
                balance: balanceMap.get(Number(row.new_api_user_id)) || 0,
                works: Number(row.works),
                createdAt: row.created_at,
                lastLoginAt: row.last_login_at,
            })),
            total: Number(result.rows[0]?.total || 0),
            page,
            pageSize,
        };
    });

    app.patch("/api/admin/users/:id", { preHandler: requireAdmin }, async (request) => {
        const { id } = request.params as { id: string };
        const body = recordBody(request.body);
        const status = body.status === "banned" ? "banned" : body.status === "active" ? "active" : null;
        if (!status) throw new ApiError(400, "用户状态无效", "invalid_user_status");
        if (id === request.aikartUser!.id && status === "banned") {
            throw new ApiError(400, "不能封禁当前管理员账户", "cannot_ban_self");
        }
        const result = await appDb.query(
            "UPDATE aikart_users SET status = $2, updated_at = now() WHERE id = $1 RETURNING id",
            [id, status],
        );
        if (!result.rowCount) throw new ApiError(404, "用户不存在", "user_not_found");
        if (status === "banned") await appDb.query("DELETE FROM aikart_sessions WHERE user_id = $1", [id]);
        await audit(request.aikartUser!.id, `user.${status}`, "user", id, {});
        return { success: true, status };
    });

    app.get("/api/admin/works", { preHandler: requireAdmin }, async (request) => {
        const query = request.query as Record<string, unknown>;
        const page = integerValue(query.page, 1, 1, 100_000);
        const pageSize = integerValue(query.pageSize, 30, 1, 100);
        const status = ["saved", "published", "blocked", "deleted"].includes(String(query.status))
            ? String(query.status)
            : "";
        const result = await appDb.query<{
            id: string;
            title: string;
            access_type: string;
            price_quota: string;
            status: string;
            media_id: string;
            owner_name: string;
            owner_id: string;
            created_at: Date;
            published_at: Date | null;
            total: string;
        }>(
            `SELECT w.id, w.title, w.access_type, w.price_quota, w.status, w.media_id,
                    u.display_name AS owner_name, u.id AS owner_id, w.created_at, w.published_at,
                    count(*) OVER() AS total
             FROM aikart_works w
             JOIN aikart_users u ON u.id = w.owner_id
             WHERE ($1 = '' OR w.status = $1)
             ORDER BY w.created_at DESC
             LIMIT $2 OFFSET $3`,
            [status, pageSize, (page - 1) * pageSize],
        );
        return {
            items: result.rows.map((row) => ({
                id: row.id,
                title: row.title,
                accessType: row.access_type,
                price: quotaToDisplay(Number(row.price_quota)),
                status: row.status,
                owner: { id: row.owner_id, displayName: row.owner_name },
                mediaUrl: `/api/media/${row.media_id}/content`,
                createdAt: row.created_at,
                publishedAt: row.published_at,
            })),
            total: Number(result.rows[0]?.total || 0),
            page,
            pageSize,
        };
    });

    app.patch("/api/admin/works/:id", { preHandler: requireAdmin }, async (request) => {
        const { id } = request.params as { id: string };
        const body = recordBody(request.body);
        const action = body.action === "block" || body.action === "restore" || body.action === "delete" ? body.action : null;
        if (!action) throw new ApiError(400, "作品管理操作无效", "invalid_work_action");
        const status = action === "block" ? "blocked" : action === "delete" ? "deleted" : "published";
        const result = await appDb.query(
            `UPDATE aikart_works SET status = $2, updated_at = now(),
                published_at = CASE WHEN $2 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END
             WHERE id = $1 RETURNING id`,
            [id, status],
        );
        if (!result.rowCount) throw new ApiError(404, "作品不存在", "work_not_found");
        await audit(request.aikartUser!.id, `work.${action}`, "work", id, {});
        return { success: true, status };
    });

    app.get("/api/admin/actions", { preHandler: requireAdmin }, async () => {
        const result = await appDb.query<{
            id: string;
            action: string;
            target_type: string;
            target_id: string;
            detail: Record<string, unknown>;
            created_at: Date;
            admin_name: string;
        }>(
            `SELECT a.*, u.display_name AS admin_name
             FROM aikart_admin_actions a
             JOIN aikart_users u ON u.id = a.admin_user_id
             ORDER BY a.created_at DESC LIMIT 200`,
        );
        return {
            items: result.rows.map((row) => ({
                id: row.id,
                action: row.action,
                targetType: row.target_type,
                targetId: row.target_id,
                detail: row.detail,
                adminName: row.admin_name,
                createdAt: row.created_at,
            })),
        };
    });
}

async function audit(
    adminUserId: string,
    action: string,
    targetType: string,
    targetId: string,
    detail: unknown,
) {
    await appDb.query(
        `INSERT INTO aikart_admin_actions (id, admin_user_id, action, target_type, target_id, detail)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [randomUUID(), adminUserId, action, targetType, targetId, JSON.stringify(detail || {})],
    );
}
