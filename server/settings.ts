import { appDb } from "./db.js";
import { ApiError } from "./errors.js";

export type PlatformSettings = {
    platformFeeBps: number;
    inviteCommissionBps: number;
    minPriceDisplay: number;
};

export async function getPlatformSettings(): Promise<PlatformSettings> {
    const result = await appDb.query<{ key: string; value: unknown }>(
        "SELECT key, value FROM aikart_settings WHERE key = ANY($1::text[])",
        [["platform_fee_bps", "invite_commission_bps", "min_price_display"]],
    );
    const values = new Map(result.rows.map((row) => [row.key, Number(row.value)]));
    return {
        platformFeeBps: clampInteger(values.get("platform_fee_bps") ?? 1000, 0, 10_000),
        inviteCommissionBps: clampInteger(values.get("invite_commission_bps") ?? 3000, 0, 10_000),
        minPriceDisplay: Math.max(0.1, values.get("min_price_display") || 0.1),
    };
}

export async function updatePlatformSettings(input: Partial<PlatformSettings>) {
    validatePercent(input.platformFeeBps, "平台手续费比例", "invalid_platform_fee");
    validatePercent(input.inviteCommissionBps, "邀请佣金比例", "invalid_commission");
    if (input.minPriceDisplay !== undefined && (!Number.isFinite(Number(input.minPriceDisplay)) || Number(input.minPriceDisplay) < 0.1)) {
        throw new ApiError(400, "最低价格不能低于 0.1", "invalid_minimum_price");
    }

    const current = await getPlatformSettings();
    const next = {
        platformFeeBps: input.platformFeeBps === undefined ? current.platformFeeBps : Math.round(Number(input.platformFeeBps)),
        inviteCommissionBps:
            input.inviteCommissionBps === undefined ? current.inviteCommissionBps : Math.round(Number(input.inviteCommissionBps)),
        minPriceDisplay: input.minPriceDisplay === undefined ? current.minPriceDisplay : Number(input.minPriceDisplay),
    };
    await Promise.all([
        setSetting("platform_fee_bps", next.platformFeeBps),
        setSetting("invite_commission_bps", next.inviteCommissionBps),
        setSetting("min_price_display", next.minPriceDisplay),
    ]);
    return next;
}

async function setSetting(key: string, value: number) {
    await appDb.query(
        `INSERT INTO aikart_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, JSON.stringify(value)],
    );
}

function validatePercent(value: number | undefined, label: string, code: string) {
    if (value === undefined) return;
    const normalized = Number(value);
    if (!Number.isFinite(normalized) || normalized < 0 || normalized > 10_000) {
        throw new ApiError(400, `${label}必须在 0% 到 100% 之间`, code);
    }
}

function clampInteger(value: number, min: number, max: number) {
    const normalized = Math.round(Number(value));
    return Math.max(min, Math.min(max, Number.isFinite(normalized) ? normalized : min));
}
