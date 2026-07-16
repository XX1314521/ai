import cookie from "@fastify/cookie";
import httpProxy from "@fastify/http-proxy";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";

import { registerAdminRoutes } from "./admin-routes.js";
import { registerAuthRoutes } from "./auth-routes.js";
import { requireAuth } from "./auth.js";
import { config } from "./config.js";
import { appDb, billingDb } from "./db.js";
import { ApiError } from "./errors.js";
import { registerMediaRoutes } from "./media-routes.js";
import { registerLibraryRoutes } from "./library-routes.js";
import { getUserToken } from "./new-api.js";
import { registerReferralRoutes } from "./referral-routes.js";
import { registerWorkRoutes } from "./work-routes.js";

export async function buildApp() {
    const app = Fastify({
        logger: {
            level: config.nodeEnv === "test" ? "silent" : config.isProduction ? "info" : "debug",
        },
        trustProxy: true,
        bodyLimit: Math.max(config.maxUploadBytes, 10 * 1024 * 1024),
        requestTimeout: 15 * 60_000,
    });

    await app.register(cookie, { secret: config.sessionSecret });
    await app.register(rateLimit, {
        max: 600,
        timeWindow: "1 minute",
        allowList: ["127.0.0.1", "::1"],
    });
    app.decorateRequest("aikartUser", null);

    app.addHook("onRequest", async (request) => {
        request.aikartUser = null;
        const origin = request.headers.origin;
        if (
            config.isProduction &&
            origin &&
            origin !== config.publicOrigin &&
            request.method !== "GET" &&
            request.method !== "HEAD" &&
            request.method !== "OPTIONS"
        ) {
            throw new ApiError(403, "请求来源不受信任", "invalid_origin");
        }
    });
    app.addHook("onSend", async (_request, reply, payload) => {
        reply.header("X-Content-Type-Options", "nosniff");
        reply.header("X-Frame-Options", "SAMEORIGIN");
        reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
        reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        return payload;
    });

    app.setNotFoundHandler(async (_request, reply) => {
        return reply.code(404).send({ error: { code: "not_found", message: "接口不存在" } });
    });
    app.setErrorHandler(async (error, _request, reply) => {
        if (error instanceof ApiError) {
            return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
        }
        const candidate = error as { statusCode?: unknown; code?: unknown; message?: unknown };
        const statusCode =
            typeof candidate.statusCode === "number" && candidate.statusCode >= 400 ? candidate.statusCode : 500;
        if (statusCode >= 500) app.log.error(error);
        const message =
            statusCode >= 500 && config.isProduction
                ? "服务器处理请求失败"
                : typeof candidate.message === "string"
                  ? candidate.message
                  : "服务器处理请求失败";
        const code = typeof candidate.code === "string" ? candidate.code : "server_error";
        return reply.code(statusCode).send({ error: { code, message } });
    });

    app.get("/healthz", async () => ({ status: "ok" }));
    app.get("/api/health", async () => {
        await Promise.all([appDb.query("SELECT 1"), billingDb.query("SELECT 1")]);
        return { status: "ok", retentionDays: config.draftRetentionDays };
    });

    await registerAuthRoutes(app);
    await app.register(async (mediaApp) => {
        await mediaApp.register(multipart, {
            limits: { fileSize: config.maxUploadBytes, files: 1, fields: 20 },
        });
        await registerMediaRoutes(mediaApp);
    });
    await registerLibraryRoutes(app);
    await registerWorkRoutes(app);
    await registerReferralRoutes(app);
    await registerAdminRoutes(app);

    await app.register(httpProxy, {
        upstream: config.newApiBaseUrl,
        prefix: "/api/ai",
        rewritePrefix: "",
        preHandler: async (request) => {
            await requireAuth(request);
            const rawTokenId = request.headers["x-aikart-token-id"];
            const tokenId = Array.isArray(rawTokenId) ? rawTokenId[0] : rawTokenId;
            if (!tokenId) return;
            if (!/^\d+$/.test(tokenId)) {
                throw new ApiError(400, "渠道令牌格式不正确", "invalid_channel_token_id");
            }
            const token = await getUserToken(request.aikartUser!.newApiUserId, tokenId);
            if (!token) {
                throw new ApiError(403, "渠道令牌不存在、已禁用或不属于当前用户", "channel_token_forbidden");
            }
            request.aikartUser!.apiKey = token.key;
        },
        replyOptions: {
            rewriteRequestHeaders: (request, headers) => {
                const next = { ...headers } as Record<string, string | string[] | undefined>;
                delete next.cookie;
                delete next.host;
                delete next["x-aikart-token-id"];
                next.authorization = `Bearer ${request.aikartUser!.apiKey}`;
                next["x-goog-api-key"] = request.aikartUser!.apiKey;
                return next;
            },
        },
    });

    return app;
}
