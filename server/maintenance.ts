import { appDb } from "./db.js";
import { asErrorMessage } from "./errors.js";
import { settlePurchase } from "./settlement.js";
import { deleteMedia } from "./storage.js";

export async function cleanupExpiredData(limit = 200) {
    const expired = await appDb.query<{ id: string; object_key: string }>(
        `UPDATE aikart_media SET deleted_at = now()
         WHERE id IN (
            SELECT id FROM aikart_media
            WHERE retention = 'draft' AND expires_at <= now() AND deleted_at IS NULL
            ORDER BY expires_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
         )
         RETURNING id, object_key`,
        [limit],
    );
    for (const media of expired.rows) {
        await deleteMedia(media.object_key).catch(() => undefined);
    }
    const sessions = await appDb.query("DELETE FROM aikart_sessions WHERE expires_at <= now()");
    return { media: expired.rowCount || 0, sessions: sessions.rowCount || 0 };
}

export async function reconcilePendingPurchases(limit = 50) {
    const pending = await appDb.query<{
        id: string;
        price_quota: string;
        buyer_new_api_user_id: string;
        seller_new_api_user_id: string;
        inviter_new_api_user_id: string | null;
    }>(
        `SELECT p.id, p.price_quota,
                buyer.new_api_user_id AS buyer_new_api_user_id,
                seller.new_api_user_id AS seller_new_api_user_id,
                inviter.new_api_user_id AS inviter_new_api_user_id
         FROM aikart_purchases p
         JOIN aikart_users buyer ON buyer.id = p.buyer_id
         JOIN aikart_users seller ON seller.id = p.seller_id
         LEFT JOIN aikart_users inviter ON inviter.id = p.inviter_id
         WHERE p.status = 'pending' AND p.created_at < now() - interval '30 seconds'
         ORDER BY p.created_at ASC LIMIT $1`,
        [limit],
    );

    let completed = 0;
    for (const purchase of pending.rows) {
        try {
            const settlement = await settlePurchase({
                purchaseId: purchase.id,
                buyerNewApiUserId: Number(purchase.buyer_new_api_user_id),
                sellerNewApiUserId: Number(purchase.seller_new_api_user_id),
                inviterNewApiUserId: purchase.inviter_new_api_user_id
                    ? Number(purchase.inviter_new_api_user_id)
                    : null,
                priceQuota: Number(purchase.price_quota),
            });
            await appDb.query(
                `UPDATE aikart_purchases SET
                    platform_fee_quota = $2,
                    invite_commission_quota = $3,
                    seller_income_quota = $4,
                    status = 'completed', completed_at = now(), error = NULL
                 WHERE id = $1 AND status = 'pending'`,
                [
                    purchase.id,
                    settlement.platformFeeQuota,
                    settlement.inviteCommissionQuota,
                    settlement.sellerIncomeQuota,
                ],
            );
            completed += 1;
        } catch (error) {
            await appDb.query(
                "UPDATE aikart_purchases SET status = 'failed', error = $2 WHERE id = $1 AND status = 'pending'",
                [purchase.id, asErrorMessage(error).slice(0, 1_000)],
            );
        }
    }
    return { pending: pending.rowCount || 0, completed };
}

export function startMaintenanceJobs(intervalMinutes: number, log: { info: (value: unknown) => void; error: (value: unknown) => void }) {
    let running = false;
    const run = async () => {
        if (running) return;
        running = true;
        try {
            const [cleanup, reconciliation] = await Promise.all([
                cleanupExpiredData(),
                reconcilePendingPurchases(),
            ]);
            if (cleanup.media || cleanup.sessions || reconciliation.pending) {
                log.info({ cleanup, reconciliation, message: "AikArt maintenance completed" });
            }
        } catch (error) {
            log.error({ error, message: "AikArt maintenance failed" });
        } finally {
            running = false;
        }
    };
    const timer = setInterval(() => void run(), intervalMinutes * 60_000);
    timer.unref();
    void run();
    return () => clearInterval(timer);
}
