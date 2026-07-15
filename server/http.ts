import { ApiError } from "./errors.js";

export function recordBody(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new ApiError(400, "请求内容格式不正确", "invalid_body");
    }
    return value as Record<string, unknown>;
}

export function textValue(value: unknown, label: string, options: { required?: boolean; max?: number } = {}) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (options.required && !normalized) {
        throw new ApiError(400, `请填写${label}`, "missing_field");
    }
    if (normalized.length > (options.max ?? 10_000)) {
        throw new ApiError(400, `${label}内容过长`, "field_too_long");
    }
    return normalized;
}

export function integerValue(value: unknown, fallback: number, min: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(parsed)));
}

export function booleanValue(value: unknown) {
    return value === true || value === "true" || value === "1" || value === 1;
}

export function safeJsonObject(value: unknown, maxBytes = 20_000) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized, "utf8") > maxBytes) {
        throw new ApiError(400, "附加信息内容过大", "metadata_too_large");
    }
    return value as Record<string, unknown>;
}
