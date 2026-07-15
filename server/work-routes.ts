import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";

import { authenticateRequest, requireAuth } from "./auth.js";
import { config } from "./config.js";
import { decryptText, encryptText } from "./crypto.js";
import { appDb } from "./db.js";
import { ApiError, asErrorMessage } from "./errors.js";
import { integerValue, recordBody, safeJsonObject, textValue } from "./http.js";
import { displayToQuota, getBillingUser, quotaToDisplay } from "./new-api.js";
import { settlePurchase } from "./settlement.js";
import { getPlatformSettings } from "./settings.js";

type WorkAccess = "private" | "free" | "paid";
type WorkStatus = "saved" | "published" | "blocked" | "deleted";

type WorkRow = {
    id: string;
    owner_id: string;
    media_id: string;
    title: string;
    description: string;
    prompt_ciphertext: string;
    access_type: WorkAccess;
    price_quota: string;
    status: WorkStatus;
    metadata: Record<string, unknown>;
    view_count: string;
    copy_count: string;
    download_count: string;
    created_at: Date;
    updated_at: Date;
    published_at: Date | null;
};

type WorkViewRow = WorkRow & {
    owner_username: string;
    owner_display_name: string;
    owner_avatar_url: string;
    media_filename: string;
    media_mime_type: string;
    media_width: number | null;
    media_height: number | null;
    is_purchased: boolean;
    total?: string;
};

const workViewSelect = `
    SELECT w.*,
           u.username AS owner_username,
           u.display_name AS owner_display_name,
           u.avatar_url AS owner_avatar_url,
           m.filename AS media_filename,
           m.mime_type AS media_mime_type,
           m.width AS media_width,
           m.height AS media_height,
           EXISTS (
               SELECT 1 FROM aikart_purchases p
               WHERE p.work_id = w.id AND p.buyer_id = $1::uuid AND p.status = 'completed'
           ) AS is_purchased`;

export async function registerWorkRoutes(app: FastifyInstance) {
    app.get("/api/works", async (request) => {
        const user = await authenticateRequest(request);
        const query = request.query as Record<string, unknown>;
        const area = ["all", "free", "paid", "mine"].includes(String(query.area)) ? String(query.area) : "all";
        if (area === "mine" && !user) throw new ApiError(401, "请先登录 AikArt", "authentication_required");
        const page = integerValue(query.page, 1, 1, 100_000);
        const pageSize = integerValue(query.pageSize, 30, 1, 60);
        const search = textValue(query.search, "搜索词", { max: 100 });
        const sort = query.sort === "popular" ? "popular" : "latest";

        const values: unknown[] = [user?.id || null];
        const conditions: string[] = [];
        if (area === "mine") {
            values.push(user!.id);
            conditions.push(`w.owner_id = $${values.length}::uuid`, "w.status <> 'deleted'");
        } else {
            conditions.push("w.status = 'published'", "w.access_type IN ('free', 'paid')");
            if (area === "free" || area === "paid") {
                values.push(area);
                conditions.push(`w.access_type = $${values.length}`);
            }
        }
        if (search) {
            values.push(`%${search}%`);
            conditions.push(`(w.title ILIKE $${values.length} OR w.description ILIKE $${values.length} OR u.display_name ILIKE $${values.length})`);
        }
        values.push(pageSize, (page - 1) * pageSize);
        const limitIndex = values.length - 1;
        const offsetIndex = values.length;
        const orderBy = sort === "popular" ? "(w.view_count + w.copy_count * 4) DESC, w.published_at DESC NULLS LAST" : "COALESCE(w.published_at, w.created_at) DESC";
        const result = await appDb.query<WorkViewRow>(
            `${workViewSelect}, count(*) OVER() AS total
             FROM aikart_works w
             JOIN aikart_users u ON u.id = w.owner_id
             JOIN aikart_media m ON m.id = w.media_id AND m.deleted_at IS NULL
             WHERE ${conditions.join(" AND ")}
             ORDER BY ${orderBy}
             LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
            values,
        );
        const settings = await getPlatformSettings();
        return {
            items: result.rows.map((row) => publicWork(row, user?.id, user?.role === "admin")),
            total: Number(result.rows[0]?.total || 0),
            page,
            pageSize,
            settings: publicSettings(settings),
        };
    });

    app.get("/api/works/stats/mine", { preHandler: requireAuth }, async (request) => {
        const result = await appDb.query<{
            works: string;
            published: string;
            sales: string;
            income_quota: string;
        }>(
            `SELECT
                (SELECT count(*) FROM aikart_works WHERE owner_id = $1 AND status <> 'deleted') AS works,
                (SELECT count(*) FROM aikart_works WHERE owner_id = $1 AND status = 'published') AS published,
                (SELECT count(*) FROM aikart_purchases WHERE seller_id = $1 AND status = 'completed') AS sales,
                (SELECT COALESCE(sum(seller_income_quota), 0) FROM aikart_purchases WHERE seller_id = $1 AND status = 'completed') AS income_quota`,
            [request.aikartUser!.id],
        );
        const row = result.rows[0];
        return {
            works: Number(row.works),
            published: Number(row.published),
            sales: Number(row.sales),
            income: quotaToDisplay(Number(row.income_quota)),
        };
    });

    app.post("/api/works", { preHandler: requireAuth }, async (request) => {
        const body = recordBody(request.body);
        const mediaId = textValue(body.mediaId, "素材", { required: true, max: 100 });
        const title = textValue(body.title, "作品标题", { required: true, max: 120 });
        const description = textValue(body.description, "作品说明", { max: 2_000 });
        const prompt = textValue(body.prompt, "提示词", { max: 50_000 });
        const accessType = parseAccess(body.accessType);
        if (accessType !== "private" && !prompt) {
            throw new ApiError(400, "公开作品必须填写提示词", "prompt_required");
        }
        const priceQuota = await validatePrice(accessType, body.price);
        const metadata = publicWorkMetadata(safeJsonObject(body.metadata));
        const media = await appDb.query<{ id: string; retention: string; mime_type: string }>(
            "SELECT id, retention, mime_type FROM aikart_media WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL",
            [mediaId, request.aikartUser!.id],
        );
        if (!media.rows[0]) throw new ApiError(404, "素材不存在或不属于当前用户", "media_not_found");
        if (!media.rows[0].mime_type.startsWith("image/")) {
            throw new ApiError(400, "作品展示目前仅支持图片", "unsupported_work_media");
        }

        const id = randomUUID();
        const status: WorkStatus = accessType === "private" ? "saved" : "published";
        const result = await appDb.query<WorkRow>(
            `INSERT INTO aikart_works
                (id, owner_id, media_id, title, description, prompt_ciphertext, access_type, price_quota,
                 status, metadata, published_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb,
                     CASE WHEN $9 = 'published' THEN now() ELSE NULL END)
             RETURNING *`,
            [
                id,
                request.aikartUser!.id,
                mediaId,
                title,
                description,
                encryptText(prompt, config.contentEncryptionKey),
                accessType,
                priceQuota,
                status,
                JSON.stringify(metadata),
            ],
        );
        await keepMedia(mediaId, status === "published" ? "published" : "saved");
        return { work: ownWork(result.rows[0]) };
    });

    app.get("/api/works/:id", async (request) => {
        const user = await authenticateRequest(request);
        const { id } = request.params as { id: string };
        const result = await appDb.query<WorkViewRow>(
            `${workViewSelect}
             FROM aikart_works w
             JOIN aikart_users u ON u.id = w.owner_id
             JOIN aikart_media m ON m.id = w.media_id AND m.deleted_at IS NULL
             WHERE w.id = $2 AND (w.status = 'published' OR w.owner_id = $1::uuid OR $3::boolean)
             LIMIT 1`,
            [user?.id || null, id, user?.role === "admin"],
        );
        const work = result.rows[0];
        if (!work || work.status === "deleted") throw new ApiError(404, "作品不存在", "work_not_found");
        if (work.status === "blocked" && user?.id !== work.owner_id && user?.role !== "admin") {
            throw new ApiError(404, "作品不存在", "work_not_found");
        }
        if (user?.id !== work.owner_id) {
            await appDb.query("UPDATE aikart_works SET view_count = view_count + 1 WHERE id = $1", [id]);
            work.view_count = String(Number(work.view_count) + 1);
        }
        return { work: publicWork(work, user?.id, user?.role === "admin") };
    });

    app.patch("/api/works/:id", { preHandler: requireAuth }, async (request) => {
        const { id } = request.params as { id: string };
        const body = recordBody(request.body);
        const currentResult = await appDb.query<WorkRow>(
            "SELECT * FROM aikart_works WHERE id = $1 AND owner_id = $2 AND status <> 'deleted'",
            [id, request.aikartUser!.id],
        );
        const current = currentResult.rows[0];
        if (!current) throw new ApiError(404, "作品不存在", "work_not_found");
        if (current.status === "blocked") throw new ApiError(403, "作品已被管理员封禁，无法修改", "work_blocked");

        const title = body.title === undefined ? current.title : textValue(body.title, "作品标题", { required: true, max: 120 });
        const description = body.description === undefined ? current.description : textValue(body.description, "作品说明", { max: 2_000 });
        const prompt = body.prompt === undefined ? null : textValue(body.prompt, "提示词", { max: 50_000 });
        const accessType = body.accessType === undefined ? current.access_type : parseAccess(body.accessType);
        const nextPromptExists = prompt === null ? Boolean(decryptText(current.prompt_ciphertext, config.contentEncryptionKey)) : Boolean(prompt);
        if (accessType !== "private" && !nextPromptExists) throw new ApiError(400, "公开作品必须填写提示词", "prompt_required");
        const priceQuota = body.price === undefined && accessType === current.access_type ? Number(current.price_quota) : await validatePrice(accessType, body.price);
        const status: WorkStatus = accessType === "private" ? "saved" : "published";
        const metadata = body.metadata === undefined ? current.metadata : publicWorkMetadata(safeJsonObject(body.metadata));
        const updated = await appDb.query<WorkRow>(
            `UPDATE aikart_works SET
                title = $3,
                description = $4,
                prompt_ciphertext = COALESCE($5, prompt_ciphertext),
                access_type = $6,
                price_quota = $7,
                status = $8,
                metadata = $9::jsonb,
                published_at = CASE WHEN $8 = 'published' THEN COALESCE(published_at, now()) ELSE NULL END,
                updated_at = now()
             WHERE id = $1 AND owner_id = $2
             RETURNING *`,
            [
                id,
                request.aikartUser!.id,
                title,
                description,
                prompt === null ? null : encryptText(prompt, config.contentEncryptionKey),
                accessType,
                priceQuota,
                status,
                JSON.stringify(metadata),
            ],
        );
        await keepMedia(current.media_id, status === "published" ? "published" : "saved");
        return { work: ownWork(updated.rows[0]) };
    });

    app.delete("/api/works/:id", { preHandler: requireAuth }, async (request) => {
        const { id } = request.params as { id: string };
        const result = await appDb.query(
            `UPDATE aikart_works SET status = 'deleted', updated_at = now()
             WHERE id = $1 AND (owner_id = $2 OR $3::boolean) AND status <> 'deleted'
             RETURNING id`,
            [id, request.aikartUser!.id, request.aikartUser!.role === "admin"],
        );
        if (!result.rowCount) throw new ApiError(404, "作品不存在", "work_not_found");
        return { success: true };
    });

    app.get("/api/works/:id/prompt", { preHandler: requireAuth }, async (request) => {
        const user = request.aikartUser!;
        const { id } = request.params as { id: string };
        const access = await promptAccess(id, user?.id, user?.role === "admin");
        if (!access.allowed) {
            throw new ApiError(402, "该提示词需要付费解锁", "purchase_required");
        }
        await appDb.query("UPDATE aikart_works SET copy_count = copy_count + 1 WHERE id = $1", [id]);
        return { prompt: decryptText(access.promptCiphertext, config.contentEncryptionKey) };
    });

    app.post("/api/works/:id/purchase", { preHandler: requireAuth }, async (request) => {
        const { id: workId } = request.params as { id: string };
        const workResult = await appDb.query<{
            id: string;
            owner_id: string;
            access_type: WorkAccess;
            price_quota: string;
            prompt_ciphertext: string;
            seller_new_api_user_id: string;
            inviter_id: string | null;
            inviter_new_api_user_id: string | null;
        }>(
            `SELECT w.id, w.owner_id, w.access_type, w.price_quota, w.prompt_ciphertext,
                    seller.new_api_user_id AS seller_new_api_user_id,
                    buyer.invited_by_user_id AS inviter_id,
                    inviter.new_api_user_id AS inviter_new_api_user_id
             FROM aikart_works w
             JOIN aikart_users seller ON seller.id = w.owner_id
             JOIN aikart_users buyer ON buyer.id = $2
             LEFT JOIN aikart_users inviter ON inviter.id = buyer.invited_by_user_id
             WHERE w.id = $1 AND w.status = 'published'`,
            [workId, request.aikartUser!.id],
        );
        const work = workResult.rows[0];
        if (!work) throw new ApiError(404, "作品不存在", "work_not_found");
        if (work.owner_id === request.aikartUser!.id || work.access_type === "free") {
            return {
                prompt: decryptText(work.prompt_ciphertext, config.contentEncryptionKey),
                purchased: false,
                balance: quotaToDisplay(request.aikartUser!.quota),
            };
        }
        if (work.access_type !== "paid" || Number(work.price_quota) <= 0) {
            throw new ApiError(409, "该作品不可购买", "work_not_purchasable");
        }

        const purchaseId = randomUUID();
        const purchase = await appDb.query<{ id: string; status: string }>(
            `INSERT INTO aikart_purchases
                (id, work_id, buyer_id, seller_id, inviter_id, price_quota, platform_fee_quota,
                 invite_commission_quota, seller_income_quota, status)
             VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0, 'pending')
             ON CONFLICT (buyer_id, work_id) DO UPDATE SET
                status = CASE WHEN aikart_purchases.status = 'completed' THEN 'completed' ELSE 'pending' END,
                error = NULL
             RETURNING id, status`,
            [
                purchaseId,
                workId,
                request.aikartUser!.id,
                work.owner_id,
                work.inviter_id,
                Number(work.price_quota),
            ],
        );
        const row = purchase.rows[0];
        if (row.status !== "completed") {
            try {
                const settlement = await settlePurchase({
                    purchaseId: row.id,
                    buyerNewApiUserId: request.aikartUser!.newApiUserId,
                    sellerNewApiUserId: Number(work.seller_new_api_user_id),
                    inviterNewApiUserId: work.inviter_new_api_user_id ? Number(work.inviter_new_api_user_id) : null,
                    priceQuota: Number(work.price_quota),
                });
                await appDb.query(
                    `UPDATE aikart_purchases SET
                        platform_fee_quota = $2,
                        invite_commission_quota = $3,
                        seller_income_quota = $4,
                        status = 'completed',
                        completed_at = now(),
                        error = NULL
                     WHERE id = $1`,
                    [
                        row.id,
                        settlement.platformFeeQuota,
                        settlement.inviteCommissionQuota,
                        settlement.sellerIncomeQuota,
                    ],
                );
            } catch (error) {
                await appDb.query("UPDATE aikart_purchases SET status = 'failed', error = $2 WHERE id = $1", [
                    row.id,
                    asErrorMessage(error).slice(0, 1_000),
                ]);
                throw error;
            }
        }

        await appDb.query("UPDATE aikart_works SET copy_count = copy_count + 1 WHERE id = $1", [workId]);
        const billingUser = await getBillingUser(request.aikartUser!.newApiUserId);
        return {
            prompt: decryptText(work.prompt_ciphertext, config.contentEncryptionKey),
            purchased: true,
            balance: quotaToDisplay(Number(billingUser?.quota) || 0),
        };
    });

    app.get("/api/purchases", { preHandler: requireAuth }, async (request) => {
        const result = await appDb.query<{
            id: string;
            work_id: string;
            title: string;
            price_quota: string;
            status: string;
            created_at: Date;
            completed_at: Date | null;
        }>(
            `SELECT p.id, p.work_id, w.title, p.price_quota, p.status, p.created_at, p.completed_at
             FROM aikart_purchases p
             JOIN aikart_works w ON w.id = p.work_id
             WHERE p.buyer_id = $1
             ORDER BY p.created_at DESC
             LIMIT 100`,
            [request.aikartUser!.id],
        );
        return {
            items: result.rows.map((row) => ({
                id: row.id,
                workId: row.work_id,
                title: row.title,
                price: quotaToDisplay(Number(row.price_quota)),
                status: row.status,
                createdAt: row.created_at,
                completedAt: row.completed_at,
            })),
        };
    });
}

async function promptAccess(workId: string, userId?: string, admin = false) {
    const result = await appDb.query<{
        prompt_ciphertext: string;
        access_type: WorkAccess;
        owner_id: string;
        purchased: boolean;
    }>(
        `SELECT w.prompt_ciphertext, w.access_type, w.owner_id,
                EXISTS (
                    SELECT 1 FROM aikart_purchases p
                    WHERE p.work_id = w.id AND p.buyer_id = $2::uuid AND p.status = 'completed'
                ) AS purchased
         FROM aikart_works w
         WHERE w.id = $1 AND w.status <> 'deleted'
           AND (w.status = 'published' OR w.owner_id = $2::uuid OR $3::boolean)`,
        [workId, userId || null, admin],
    );
    const row = result.rows[0];
    if (!row) throw new ApiError(404, "作品不存在", "work_not_found");
    return {
        promptCiphertext: row.prompt_ciphertext,
        allowed: admin || row.access_type === "free" || row.owner_id === userId || row.purchased,
    };
}

async function validatePrice(accessType: WorkAccess, value: unknown) {
    if (accessType !== "paid") return 0;
    const settings = await getPlatformSettings();
    const priceQuota = displayToQuota(value);
    const minQuota = displayToQuota(settings.minPriceDisplay);
    if (priceQuota < minQuota) {
        throw new ApiError(400, `付费作品最低价格为 ${settings.minPriceDisplay}`, "price_below_minimum");
    }
    return priceQuota;
}

function parseAccess(value: unknown): WorkAccess {
    if (value === "private" || value === "free" || value === "paid") return value;
    throw new ApiError(400, "作品权限必须是私密、免费或付费", "invalid_access_type");
}

async function keepMedia(mediaId: string, retention: "saved" | "published") {
    await appDb.query(
        `UPDATE aikart_media SET
            retention = CASE WHEN retention = 'permanent' THEN retention ELSE $2 END,
            expires_at = NULL
         WHERE id = $1 AND deleted_at IS NULL`,
        [mediaId, retention],
    );
}

function publicWork(row: WorkViewRow, userId?: string, admin = false) {
    const isOwner = row.owner_id === userId;
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        accessType: row.access_type,
        price: quotaToDisplay(Number(row.price_quota)),
        status: row.status,
        metadata: row.metadata || {},
        owner: {
            id: row.owner_id,
            username: row.owner_username,
            displayName: row.owner_display_name || row.owner_username,
            avatarUrl: row.owner_avatar_url,
        },
        media: {
            id: row.media_id,
            filename: row.media_filename,
            mimeType: row.media_mime_type,
            width: row.media_width,
            height: row.media_height,
            url: `/api/media/${row.media_id}/content`,
            downloadUrl: `/api/media/${row.media_id}/download`,
        },
        isOwner,
        purchased: row.is_purchased,
        canAccessPrompt: admin || isOwner || row.access_type === "free" || row.is_purchased,
        stats: {
            views: Number(row.view_count),
            copies: Number(row.copy_count),
            downloads: Number(row.download_count),
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        publishedAt: row.published_at,
    };
}

function ownWork(row: WorkRow) {
    return {
        id: row.id,
        mediaId: row.media_id,
        title: row.title,
        description: row.description,
        accessType: row.access_type,
        price: quotaToDisplay(Number(row.price_quota)),
        status: row.status,
        metadata: row.metadata || {},
        createdAt: row.created_at,
        publishedAt: row.published_at,
    };
}

function publicSettings(settings: Awaited<ReturnType<typeof getPlatformSettings>>) {
    return {
        platformFeePercent: settings.platformFeeBps / 100,
        inviteCommissionOfFeePercent: settings.inviteCommissionBps / 100,
        minPrice: settings.minPriceDisplay,
    };
}

function publicWorkMetadata(value: Record<string, unknown>) {
    const allowed = ["source", "model", "size", "quality", "platform", "materialType", "language", "category", "style"];
    return Object.fromEntries(
        allowed.flatMap((key) => {
            const item = value[key];
            return typeof item === "string" || typeof item === "number" || typeof item === "boolean"
                ? [[key, item] as const]
                : [];
        }),
    );
}
