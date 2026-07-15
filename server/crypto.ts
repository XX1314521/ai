import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

function keyFromSecret(secret: string) {
    return createHash("sha256").update(secret).digest();
}

export function encryptText(value: string, secret: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptText(value: string, secret: string) {
    const [version, ivText, tagText, encryptedText] = value.split(".");
    if (version !== "v1" || !ivText || !tagText || !encryptedText) throw new Error("Unsupported encrypted value");
    const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(secret), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}

export function randomToken(bytes = 32) {
    return randomBytes(bytes).toString("base64url");
}

export function hashToken(value: string) {
    return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
}

export function maskApiKey(value: string) {
    const normalized = value.replace(/^sk-/, "");
    return `sk-${"*".repeat(8)}${normalized.slice(-4)}`;
}
