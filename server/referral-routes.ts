import type { FastifyInstance } from "fastify";

import { publicUser, requireAuth } from "./auth.js";
import { appDb } from "./db.js";
import { quotaToDisplay } from "./new-api.js";
import { getPlatformSettings } from "./settings.js";

export async function registerReferralRoutes(app: FastifyInstance) {
    app.get("/api/referrals/me", { preHandler: requireAuth }, async (request) => {
        const user = request.aikartUser!;
        const [summaryResult, recentResult, inviterResult, settings] = await Promise.all([
            appDb.query<{
                invited_count: string;
                commission_quota: string;
                commission_orders: string;
            }>(
                `SELECT
                    (SELECT count(*) FROM aikart_users WHERE invited_by_user_id = $1) AS invited_count,
                    (SELECT COALESCE(sum(invite_commission_quota), 0) FROM aikart_purchases WHERE inviter_id = $1 AND status = 'completed') AS commission_quota,
                    (SELECT count(*) FROM aikart_purchases WHERE inviter_id = $1 AND status = 'completed') AS commission_orders`,
                [user.id],
            ),
            appDb.query<{
                id: string;
                title: string;
                buyer_name: string;
                invite_commission_quota: string;
                completed_at: Date;
            }>(
                `SELECT p.id, w.title, buyer.display_name AS buyer_name,
                        p.invite_commission_quota, p.completed_at
                 FROM aikart_purchases p
                 JOIN aikart_works w ON w.id = p.work_id
                 JOIN aikart_users buyer ON buyer.id = p.buyer_id
                 WHERE p.inviter_id = $1 AND p.status = 'completed'
                 ORDER BY p.completed_at DESC
                 LIMIT 50`,
                [user.id],
            ),
            user.invitedByUserId
                ? appDb.query<{ id: string; display_name: string; username: string }>(
                      "SELECT id, display_name, username FROM aikart_users WHERE id = $1",
                      [user.invitedByUserId],
                  )
                : Promise.resolve({ rows: [] as Array<{ id: string; display_name: string; username: string }> }),
            getPlatformSettings(),
        ]);
        const summary = summaryResult.rows[0];
        const inviter = inviterResult.rows[0];
        return {
            inviteCode: user.inviteCode,
            inviteLink: publicUser(user).inviteLink,
            invitedCount: Number(summary.invited_count),
            commissionOrders: Number(summary.commission_orders),
            commissionEarned: quotaToDisplay(Number(summary.commission_quota)),
            commissionPercentOfPlatformFee: settings.inviteCommissionBps / 100,
            inviter: inviter
                ? { id: inviter.id, displayName: inviter.display_name || inviter.username }
                : null,
            recent: recentResult.rows.map((row) => ({
                id: row.id,
                workTitle: row.title,
                buyerName: row.buyer_name,
                commission: quotaToDisplay(Number(row.invite_commission_quota)),
                completedAt: row.completed_at,
            })),
        };
    });
}
