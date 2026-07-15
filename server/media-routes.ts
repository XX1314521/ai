import { randomUUID } from "node:crypto";
import { extname } from "node:path";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { authenticateRequest, requireAuth } from "./auth.js";
import { config } from "./config.js";
import { appDb } from "./db.js";
import { ApiError } from "./errors.js";
import { integerValue } from "./http.js";
import { deleteMedia, getMedia, putMedia } from "./storage.js";

type MediaRow = {
    id: string;
    owner_id: string;
    object_key: string;
    filename: string;
    mime_type: string;
    bytes: string;
    width: number | null;
    height: number | null;
    source: "upload" | "generated";
    retention: "draft" | "saved" | "published" | "permanent";
    expires_at: Date | null;
    created_at: Date;
    deleted_at: Date | null;
};

export async function registerMediaRoutes(app: FastifyInstance) {
    app.post("/api/media", { preHandler: requireAuth }, async (request) => {
        const query = request.query as Record<string, unknown>;
        const source = query.source === "generated" ? "generated" : "upload";
        const part = await request.file({ limits: { fileSize: config.maxUploadBytes, files: 1 } });
        if (!part) throw new ApiError(400, "请选择要上传的文件", "file_required");
        if (!isAllowedMime(part.mimetype)) {
            throw new ApiError(415, "仅支持图片、视频和音频文件", "unsupported_media_type");
        }
        const body = await part.toBuffer();
        if (!body.length) throw new ApiError(400, "上传文件为空", "empty_file");

        const id = randomUUID();
        const objectKey = objectKeyFor(request.aikartUser!.id, id, part.filename, part.mimetype);
        const filename = cleanFilename(part.filename || `media-${id}`);
        const retention = source === "upload" ? "permanent" : "draft";
        const expiresAt = source === "generated" ? new Date(Date.now() + config.draftRetentionDays * 86_400_000) : null;
        const width = integerValue(query.width, 0, 0, 100_000) || null;
        const height = integerValue(query.height, 0, 0, 100_000) || null;

        await putMedia(objectKey, body, part.mimetype);
        try {
            const inserted = await appDb.query<MediaRow>(
                `INSERT INTO aikart_media
                    (id, owner_id, object_key, filename, mime_type, bytes, width, height, source, retention, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 RETURNING *`,
                [
                    id,
                    request.aikartUser!.id,
                    objectKey,
                    filename,
                    part.mimetype,
                    body.length,
                    width,
                    height,
                    source,
                    retention,
                    expiresAt,
                ],
            );
            return { media: publicMedia(inserted.rows[0]) };
        } catch (error) {
            await deleteMedia(objectKey).catch(() => undefined);
            throw error;
        }
    });

    app.get("/api/media", { preHandler: requireAuth }, async (request) => {
        const query = request.query as Record<string, unknown>;
        const page = integerValue(query.page, 1, 1, 100_000);
        const pageSize = integerValue(query.pageSize, 30, 1, 100);
        const result = await appDb.query<MediaRow & { total: string }>(
            `SELECT m.*, count(*) OVER() AS total
             FROM aikart_media m
             WHERE m.owner_id = $1 AND m.deleted_at IS NULL
             ORDER BY m.created_at DESC
             LIMIT $2 OFFSET $3`,
            [request.aikartUser!.id, pageSize, (page - 1) * pageSize],
        );
        return {
            items: result.rows.map(publicMedia),
            total: Number(result.rows[0]?.total || 0),
            page,
            pageSize,
        };
    });

    app.get("/api/media/:id/content", async (request, reply) => streamMedia(request, reply, false));
    app.get("/api/media/:id/download", async (request, reply) => streamMedia(request, reply, true));

    app.patch("/api/media/:id/save", { preHandler: requireAuth }, async (request) => {
        const { id } = request.params as { id: string };
        const result = await appDb.query<MediaRow>(
            `UPDATE aikart_media
             SET retention = CASE WHEN retention = 'permanent' THEN retention ELSE 'saved' END, expires_at = NULL
             WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
             RETURNING *`,
            [id, request.aikartUser!.id],
        );
        if (!result.rows[0]) throw new ApiError(404, "素材不存在", "media_not_found");
        return { media: publicMedia(result.rows[0]) };
    });

    app.delete("/api/media/:id", { preHandler: requireAuth }, async (request) => {
        const { id } = request.params as { id: string };
        const found = await appDb.query<MediaRow>(
            `SELECT m.* FROM aikart_media m
             WHERE m.id = $1 AND m.deleted_at IS NULL
               AND (m.owner_id = $2 OR $3::boolean)`,
            [id, request.aikartUser!.id, request.aikartUser!.role === "admin"],
        );
        const media = found.rows[0];
        if (!media) throw new ApiError(404, "素材不存在", "media_not_found");
        const used = await appDb.query(
            "SELECT 1 FROM aikart_works WHERE media_id = $1 AND status IN ('saved', 'published', 'blocked') LIMIT 1",
            [id],
        );
        if (used.rowCount) throw new ApiError(409, "该素材已用于作品，请先删除对应作品", "media_in_use");
        await appDb.query("UPDATE aikart_media SET deleted_at = now() WHERE id = $1", [id]);
        await deleteMedia(media.object_key).catch(() => undefined);
        return { success: true };
    });
}

async function streamMedia(request: FastifyRequest, reply: FastifyReply, download: boolean) {
    const { id } = request.params as { id: string };
    const user = await authenticateRequest(request);
    const result = await appDb.query<MediaRow & { is_public: boolean }>(
        `SELECT m.*,
            EXISTS (
                SELECT 1 FROM aikart_works w
                WHERE w.media_id = m.id AND w.status = 'published' AND w.access_type IN ('free', 'paid')
            ) AS is_public
         FROM aikart_media m
         WHERE m.id = $1 AND m.deleted_at IS NULL`,
        [id],
    );
    const media = result.rows[0];
    if (!media) throw new ApiError(404, "素材不存在", "media_not_found");
    const allowed = media.is_public || user?.id === media.owner_id || user?.role === "admin";
    if (!allowed) throw new ApiError(403, "无权访问该素材", "media_forbidden");

    const object = await getMedia(media.object_key);
    if (!object.body) throw new ApiError(404, "素材文件不存在", "media_object_missing");
    reply.type(object.contentType || media.mime_type);
    reply.header("Cache-Control", media.is_public ? "public, max-age=3600" : "private, max-age=300");
    reply.header("Content-Disposition", `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(media.filename)}`);
    if (object.contentLength !== undefined) reply.header("Content-Length", String(object.contentLength));
    if (download) {
        await appDb.query(
            "UPDATE aikart_works SET download_count = download_count + 1 WHERE media_id = $1 AND status = 'published'",
            [id],
        );
    }
    return reply.send(object.body);
}

function publicMedia(row: MediaRow) {
    return {
        id: row.id,
        filename: row.filename,
        mimeType: row.mime_type,
        bytes: Number(row.bytes),
        width: row.width,
        height: row.height,
        source: row.source,
        retention: row.retention,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        url: `/api/media/${row.id}/content`,
        downloadUrl: `/api/media/${row.id}/download`,
    };
}

function isAllowedMime(value: string) {
    return /^(image|video|audio)\//i.test(value);
}

function cleanFilename(value: string) {
    return value.replace(/[\x00-\x1f<>:"/\\|?*]+/g, "-").slice(0, 180) || "media";
}

function objectKeyFor(ownerId: string, id: string, filename: string, mimeType: string) {
    const date = new Date().toISOString().slice(0, 10);
    const rawExtension = extname(filename).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 10);
    const extension = rawExtension || extensionForMime(mimeType);
    return `${ownerId}/${date}/${id}${extension}`;
}

function extensionForMime(mimeType: string) {
    const subtype = mimeType.split("/")[1]?.split(";")[0]?.replace(/[^a-zA-Z0-9]/g, "") || "bin";
    return `.${subtype === "jpeg" ? "jpg" : subtype}`;
}
