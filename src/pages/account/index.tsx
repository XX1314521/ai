import { App, Button, Skeleton, Table, Tag } from "antd";
import { Copy, Gift, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";
import { useAuthStore } from "@/stores/use-auth-store";

type ReferralData = {
    inviteCode: string;
    inviteLink: string;
    invitedCount: number;
    commissionOrders: number;
    commissionEarned: number;
    commissionPercentOfPlatformFee: number;
    inviter: { id: string; displayName: string } | null;
    recent: Array<{ id: string; workTitle: string; buyerName: string; commission: number; completedAt: string }>;
};

export default function AccountPage() {
    const { message } = App.useApp();
    const user = useAuthStore((state) => state.user)!;
    const refresh = useAuthStore((state) => state.refresh);
    const [data, setData] = useState<ReferralData | null>(null);
    const [loading, setLoading] = useState(true);
    const load = async () => {
        setLoading(true);
        try {
            const result = await apiFetch<ReferralData>("/api/referrals/me");
            setData(result);
            await refresh();
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取账户信息失败");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { void load(); }, []);
    const copy = async (value: string) => {
        await navigator.clipboard.writeText(value);
        message.success("已复制");
    };

    return (
        <main className="aikart-account-page h-full overflow-y-auto">
            <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
                <header className="aikart-page-heading"><div><span>ACCOUNT</span><h1>账户与邀请</h1><p>余额与爱坤Ai实时同步</p></div><Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void load()}>刷新</Button></header>
                {loading && !data ? <Skeleton active /> : <>
                    <section className="aikart-metric-grid">
                        <article><WalletCards /><span>可用余额</span><strong>{formatAmount(user.balance)}</strong><small>爱坤Ai余额单位</small></article>
                        <article><Gift /><span>已邀请用户</span><strong>{data?.invitedCount || 0}</strong><small>成功绑定邀请关系</small></article>
                        <article><ShieldCheck /><span>邀请佣金</span><strong>{formatAmount(data?.commissionEarned || 0)}</strong><small>平台手续费的 {data?.commissionPercentOfPlatformFee || 0}%</small></article>
                    </section>
                    <section className="aikart-account-section">
                        <div className="aikart-section-title"><div><h2>我的邀请码</h2><p>受邀用户首次登录时填写即可绑定</p></div>{data?.inviter ? <Tag>邀请人：{data.inviter.displayName}</Tag> : null}</div>
                        <div className="aikart-invite-row"><code>{data?.inviteCode}</code><Button icon={<Copy className="size-4" />} onClick={() => void copy(data?.inviteCode || "")}>复制邀请码</Button></div>
                        <div className="aikart-invite-row"><code>{data?.inviteLink}</code><Button type="primary" icon={<Copy className="size-4" />} onClick={() => void copy(data?.inviteLink || "")}>复制邀请链接</Button></div>
                    </section>
                    <section className="aikart-account-section">
                        <div className="aikart-section-title"><div><h2>佣金记录</h2><p>佣金从平台手续费中支付，不会额外向买家收费</p></div><Tag color="green">{data?.commissionOrders || 0} 笔</Tag></div>
                        <Table rowKey="id" pagination={false} dataSource={data?.recent || []} locale={{ emptyText: "暂无佣金记录" }} columns={[
                            { title: "作品", dataIndex: "workTitle" },
                            { title: "购买用户", dataIndex: "buyerName", width: 160 },
                            { title: "佣金", dataIndex: "commission", width: 140, render: (value: number) => formatAmount(value) },
                            { title: "时间", dataIndex: "completedAt", width: 190, render: (value: string) => new Date(value).toLocaleString("zh-CN") },
                        ]} />
                    </section>
                    <section className="aikart-key-strip"><ShieldCheck className="size-5" /><div><strong>服务端托管密钥</strong><span>{user.apiKeyHint}</span></div><small>完整 Key 不会发送到浏览器</small></section>
                </>}
            </div>
        </main>
    );
}

function formatAmount(value: number) {
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }).format(value);
}
