import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

import { config } from "./config.js";
import { billingDb, withTransaction } from "./db.js";
import { ApiError } from "./errors.js";
import { getPlatformSettings } from "./settings.js";

type SettlementInput = {
    purchaseId: string;
    buyerNewApiUserId: number;
    sellerNewApiUserId: number;
    inviterNewApiUserId?: number | null;
    priceQuota: number;
};

export type SettlementResult = {
    priceQuota: number;
    platformFeeQuota: number;
    inviteCommissionQuota: number;
    sellerIncomeQuota: number;
    platformIncomeQuota: number;
};

export async function settlePurchase(input: SettlementInput): Promise<SettlementResult> {
    if (!Number.isSafeInteger(input.priceQuota) || input.priceQuota <= 0) {
        throw new ApiError(400, "交易价格无效", "invalid_purchase_price");
    }

    const settings = await getPlatformSettings();
    const platformFeeQuota = Math.floor((input.priceQuota * settings.platformFeeBps) / 10_000);
    const sellerIncomeQuota = input.priceQuota - platformFeeQuota;
    const eligibleInviter =
        input.inviterNewApiUserId && input.inviterNewApiUserId !== input.buyerNewApiUserId
            ? input.inviterNewApiUserId
            : null;
    const inviteCommissionQuota = eligibleInviter
        ? Math.floor((platformFeeQuota * settings.inviteCommissionBps) / 10_000)
        : 0;
    const platformIncomeQuota = platformFeeQuota - inviteCommissionQuota;
    const result = {
        priceQuota: input.priceQuota,
        platformFeeQuota,
        inviteCommissionQuota,
        sellerIncomeQuota,
        platformIncomeQuota,
    };

    return withTransaction(billingDb, async (client) => {
        // The purchase id is also the idempotency key. The advisory lock closes
        // the race where two requests check before either settlement is inserted.
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [input.purchaseId]);
        const existing = await client.query<{
            price_quota: string;
            seller_income_quota: string;
            platform_income_quota: string;
            invite_commission_quota: string;
        }>(
            `SELECT price_quota, seller_income_quota, platform_income_quota, invite_commission_quota
             FROM aikart_balance_settlements WHERE purchase_id = $1`,
            [input.purchaseId],
        );
        if (existing.rows[0]) {
            return {
                priceQuota: Number(existing.rows[0].price_quota),
                platformFeeQuota:
                    Number(existing.rows[0].platform_income_quota) + Number(existing.rows[0].invite_commission_quota),
                inviteCommissionQuota: Number(existing.rows[0].invite_commission_quota),
                sellerIncomeQuota: Number(existing.rows[0].seller_income_quota),
                platformIncomeQuota: Number(existing.rows[0].platform_income_quota),
            };
        }

        const ids = Array.from(
            new Set(
                [
                    input.buyerNewApiUserId,
                    input.sellerNewApiUserId,
                    config.platformAdminUserId,
                    eligibleInviter,
                ].filter((id): id is number => Boolean(id)),
            ),
        ).sort((a, b) => a - b);
        const users = await client.query<{ id: string; quota: string; status: number }>(
            "SELECT id, quota, status FROM users WHERE id = ANY($1::bigint[]) ORDER BY id FOR UPDATE",
            [ids],
        );
        const byId = new Map(users.rows.map((row) => [Number(row.id), row]));
        for (const id of ids) {
            if (!byId.has(id)) {
                throw new ApiError(409, `爱坤Ai用户 ${id} 不存在`, "billing_user_missing");
            }
        }

        const buyer = byId.get(input.buyerNewApiUserId)!;
        if (Number(buyer.status) !== 1) {
            throw new ApiError(403, "买家爱坤Ai账户不可用", "buyer_disabled");
        }
        if (Number(buyer.quota) < input.priceQuota) {
            throw new ApiError(402, "爱坤Ai余额不足", "insufficient_balance");
        }

        const deltas = new Map<number, number>();
        addDelta(deltas, input.buyerNewApiUserId, -input.priceQuota);
        addDelta(deltas, input.sellerNewApiUserId, sellerIncomeQuota);
        addDelta(deltas, config.platformAdminUserId, platformIncomeQuota);
        if (eligibleInviter) addDelta(deltas, eligibleInviter, inviteCommissionQuota);

        for (const [userId, delta] of deltas) {
            if (delta) await client.query("UPDATE users SET quota = quota + $1 WHERE id = $2", [delta, userId]);
        }
        await recordSettlement(client, input, eligibleInviter, result);
        return result;
    });
}

async function recordSettlement(
    client: PoolClient,
    input: SettlementInput,
    inviterId: number | null,
    result: SettlementResult,
) {
    await client.query(
        `INSERT INTO aikart_balance_settlements
            (id, purchase_id, buyer_new_api_user_id, seller_new_api_user_id, inviter_new_api_user_id,
             admin_new_api_user_id, price_quota, seller_income_quota, platform_income_quota, invite_commission_quota)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
            randomUUID(),
            input.purchaseId,
            input.buyerNewApiUserId,
            input.sellerNewApiUserId,
            inviterId,
            config.platformAdminUserId,
            result.priceQuota,
            result.sellerIncomeQuota,
            result.platformIncomeQuota,
            result.inviteCommissionQuota,
        ],
    );
}

function addDelta(deltas: Map<number, number>, userId: number, delta: number) {
    deltas.set(userId, (deltas.get(userId) || 0) + delta);
}
