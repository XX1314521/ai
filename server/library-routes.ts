import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";

import { requireAuth } from "./auth.js";
import { config } from "./config.js";
import { decryptText, encryptText } from "./crypto.js";
import { appDb } from "./db.js";
import { ApiError } from "./errors.js";
import { integerValue, recordBody, safeJsonObject, textValue } from "./http.js";

type LibraryRow = {
    id: string;
    owner_id: string;
    kind: "text" | "image" | "video";
    title: string;
    media_id: string | null;
    content_ciphertext: string | null;
    tags: unknown;
    note: string;
    source: string;
    metadata: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
    media_mime_type: string | null;
    media_bytes: string | null;
    media_width: number | null;
    media_height: number | null;
};

export async function registerLibraryRoutes(app: FastifyInstance) {
    app.get("/api/library", { preHandler: requireAuth }, async (request) => {
        const query = request.query as Record<string, unknown>;
        const page = integerValue(query.page, 1, 1, 100_000);
        const pageSize = integerValue(query.pageSize, 100, 1, 200);
        const result = await appDb.query<LibraryRow & { total: string }>(
            `${librarySelect}, count(*) OVER() AS total
             FROM aikart_library_items i
             LEFT JOIN aikart_media m ON m.id = i.media_id AND m.deleted_at IS NULL
             WHERE i.owner_id = $1 AND i.deleted_at IS NULL
             ORDER BY i.created_at DESC
             LIMIT $2 OFFSET $3`,
            [request.aikartUser!.id, pageSize, (page - 1) * pageSize],
        );
        return {
            items: result.rows.map(publicLibraryItem),
            total: Number(result.rows[0]?.total || 0),
            page,
            pageSize,
        };
    });

    app.post("/api/library", { preHandler: requireAuth }, async (request) => {
        const input = parseLibraryInput(request.body);
        await validateOwnedMedia(input.kind, input.mediaId, request.aikartUser!.id);
        const id = randomUUID();
        const result = await appDb.query<LibraryRow>(
            `INSERT INTO aikart_library_items
                (id, owner_id, kind, title, media_id, content_ciphertext, tags, note, source, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::jsonb)
             RETURNING *, NULL::text AS media_mime_type, NULL::bigint AS media_bytes,
                       NULL::integer AS media_width, NULL::integer AS media_height`,
            [
                id,
                request.aikartUser!.id,
                input.kind,
                input.title,
                input.mediaId,
                input.kind === "text" ? encryptText(input.content, config.contentEncryptionKey) : null,
                JSON.stringify(input.tags),
                input.note,
                input.source,
                JSON.stringify(input.metadata),
            ],
        );
        if (input.mediaId) {
            await appDb.query(
                `UPDATE aikart_media SET retention = CASE WHEN source = 'upload' THEN 'permanent' ELSE 'saved' END,
                        expires_at = NULL WHERE id = $1`,
                [input.mediaId],
            );
        }
        return { item: { ...publicLibraryItem(result.rows[0]), media: input.mediaId ? { id: input.mediaId, url: `/api/media/${input.mediaId}/content`, downloadUrl: `/api/media/${input.mediaId}/download` } : null } };
    });

    app.patch("/api/library/:id", { preHandler: requireAuth }, async (request) => {
        const { id } = request.params as { id: string };
        const current = await appDb.query<LibraryRow>(
            `${librarySelect}
             FROM aikart_library_items i
             LEFT JOIN aikart_media m ON m.id = i.media_id AND m.deleted_at IS NULL
             WHERE i.id = $1 AND i.owner_id = $2 AND i.deleted_at IS NULL`,
            [id, request.aikartUser!.id],
        );
        if (!current.rows[0]) throw new ApiError(404, "素材不存在", "library_item_not_found");
        const body = recordBody(request.body);
        const row = current.rows[0];
        const title = body.title === undefined ? row.title : textValue(body.title, "素材标题", { required: true, max: 160 });
        const note = body.note === undefined ? row.note : textValue(body.note, "备注", { max: 2_000 });
        const source = body.source === undefined ? row.source : textValue(body.source, "来源", { max: 160 });
        const tags = body.tags === undefined ? parseTags(row.tags) : parseTags(body.tags);
        const metadata = body.metadata === undefined ? row.metadata : safeJsonObject(body.metadata);
        const content = body.content === undefined ? null : textValue(body.content, "文本内容", { max: 100_000 });
        await appDb.query(
            `UPDATE aikart_library_items SET title = $3, note = $4, source = $5, tags = $6::jsonb,
                    metadata = $7::jsonb,
                    content_ciphertext = CASE WHEN $8::text IS NULL THEN content_ciphertext ELSE $8 END,
                    updated_at = now()
             WHERE id = $1 AND owner_id = $2`,
            [
                id,
                request.aikartUser!.id,
                title,
                note,
                source,
                JSON.stringify(tags),
                JSON.stringify(metadata),
                content === null ? null : encryptText(content, config.contentEncryptionKey),
            ],
        );
        return { success: true };
    });

    app.delete("/api/library/:id", { preHandler: requireAuth }, async (request) => {
        const { id } = request.params as { id: string };
        const result = await appDb.query(
            "UPDATE aikart_library_items SET deleted_at = now(), updated_at = now() WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL RETURNING id",
            [id, request.aikartUser!.id],
        );
        if (!result.rowCount) throw new ApiError(404, "素材不存在", "library_item_not_found");
        return { success: true };
    });
}

const librarySelect = `SELECT i.*,
    m.mime_type AS media_mime_type,
    m.bytes AS media_bytes,
    m.width AS media_width,
    m.height AS media_height`;

function parseLibraryInput(value: unknown) {
    const body = recordBody(value);
    const kind = body.kind === "text" || body.kind === "image" || body.kind === "video" ? body.kind : null;
    if (!kind) throw new ApiError(400, "素材类型无效", "invalid_library_kind");
    const title = textValue(body.title, "素材标题", { required: true, max: 160 });
    const mediaId = textValue(body.mediaId, "媒体 ID", { max: 100 }) || null;
    const content = textValue(body.content, "文本内容", { max: 100_000 });
    if (kind === "text" && !content) throw new ApiError(400, "文本素材内容不能为空", "content_required");
    if (kind !== "text" && !mediaId) throw new ApiError(400, "图片或视频素材必须关联文件", "media_required");
    return {
        kind,
        title,
        mediaId,
        content,
        tags: parseTags(body.tags),
        note: textValue(body.note, "备注", { max: 2_000 }),
        source: textValue(body.source, "来源", { max: 160 }),
        metadata: safeJsonObject(body.metadata),
    };
}

async function validateOwnedMedia(kind: string, mediaId: string | null, ownerId: string) {
    if (kind === "text") return;
    const result = await appDb.query("SELECT 1 FROM aikart_media WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL", [mediaId, ownerId]);
    if (!result.rowCount) throw new ApiError(404, "关联媒体不存在", "media_not_found");
}

function parseTags(value: unknown) {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean))).slice(0, 30);
}

function publicLibraryItem(row: LibraryRow) {
    const media = row.media_id ? {
        id: row.media_id,
        url: `/api/media/${row.media_id}/content`,
        downloadUrl: `/api/media/${row.media_id}/download`,
        mimeType: row.media_mime_type,
        bytes: Number(row.media_bytes || 0),
        width: row.media_width,
        height: row.media_height,
    } : null;
    return {
        id: row.id,
        kind: row.kind,
        title: row.title,
        content: row.content_ciphertext ? decryptText(row.content_ciphertext, config.contentEncryptionKey) : "",
        tags: parseTags(row.tags),
        note: row.note,
        source: row.source,
        metadata: row.metadata || {},
        media,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
