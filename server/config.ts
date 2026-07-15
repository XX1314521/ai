import { createHash } from "node:crypto";

function required(name: string) {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
}

function numberValue(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) ? value : fallback;
}

const nodeEnv = process.env.NODE_ENV || "development";
const sessionSecret = process.env.SESSION_SECRET?.trim() || (nodeEnv === "production" ? required("SESSION_SECRET") : "aikart-local-session-secret");
const contentEncryptionKey =
    process.env.CONTENT_ENCRYPTION_KEY?.trim() ||
    (nodeEnv === "production"
        ? required("CONTENT_ENCRYPTION_KEY")
        : createHash("sha256").update(`${sessionSecret}:content`).digest("hex"));

export const config = {
    nodeEnv,
    isProduction: nodeEnv === "production",
    host: process.env.API_HOST || "0.0.0.0",
    port: numberValue("API_PORT", 4000),
    publicOrigin: (process.env.PUBLIC_ORIGIN || "http://127.0.0.1:3000").replace(/\/$/, ""),
    databaseUrl: process.env.DATABASE_URL || "postgresql://aikart:aikart@127.0.0.1:5433/aikart",
    billingDatabaseUrl: process.env.BILLING_DATABASE_URL || "",
    newApiBaseUrl: "https://ai.ikui.cn",
    newApiQuotaPerUnit: Math.max(1, Math.floor(numberValue("NEW_API_QUOTA_PER_UNIT", 500_000))),
    platformAdminUserId: Math.max(1, Math.floor(numberValue("PLATFORM_ADMIN_NEW_API_USER_ID", 1))),
    sessionSecret,
    contentEncryptionKey,
    sessionDays: Math.max(1, Math.floor(numberValue("SESSION_DAYS", 30))),
    draftRetentionDays: Math.max(1, Math.floor(numberValue("DRAFT_RETENTION_DAYS", 7))),
    cleanupIntervalMinutes: Math.max(5, Math.floor(numberValue("CLEANUP_INTERVAL_MINUTES", 360))),
    maxUploadBytes: Math.max(1, Math.floor(numberValue("MAX_UPLOAD_MB", 100))) * 1024 * 1024,
    minioEndpoint: process.env.MINIO_ENDPOINT || "http://127.0.0.1:9000",
    minioRegion: process.env.MINIO_REGION || "us-east-1",
    minioBucket: process.env.MINIO_BUCKET || "aikart-media",
    minioAccessKey: process.env.MINIO_ACCESS_KEY || (nodeEnv === "production" ? required("MINIO_ACCESS_KEY") : "aikart"),
    minioSecretKey: process.env.MINIO_SECRET_KEY || (nodeEnv === "production" ? required("MINIO_SECRET_KEY") : "aikart-local-secret"),
};

if (config.isProduction && !config.billingDatabaseUrl) {
    throw new Error("BILLING_DATABASE_URL is required in production so balances stay synchronized with 爱坤Ai");
}

if (config.isProduction && (config.sessionSecret.length < 32 || config.contentEncryptionKey.length < 32)) {
    throw new Error("SESSION_SECRET and CONTENT_ENCRYPTION_KEY must contain at least 32 characters");
}
