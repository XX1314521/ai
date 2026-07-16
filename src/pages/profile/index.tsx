import { App, Avatar, Button, Empty, Skeleton, Tag } from "antd";
import { Copy, FolderHeart, Gift, KeyRound, LibraryBig, ReceiptText, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AikartTokenPicker } from "@/components/account/aikart-token-picker";
import { useCopyText } from "@/hooks/use-copy-text";
import { apiFetch } from "@/lib/api-client";
import AccountPage from "@/pages/account";
import AssetsPage from "@/pages/assets";
import { useAuthStore } from "@/stores/use-auth-store";
import "./profile.css";

type ProfileSection = "overview" | "assets" | "purchases" | "account";

type PurchasedItem = {
    id: string;
    workId: string;
    title: string;
    description: string;
    price: number;
    completedAt: string;
    owner: { username: string; displayName: string; avatarUrl: string };
    media: { id: string; url: string; mimeType: string; width: number | null; height: number | null };
};

const sections: Array<{ key: ProfileSection; label: string; description: string; icon: typeof UserRound }> = [
    { key: "overview", label: "个人资料", description: "账户和令牌", icon: UserRound },
    { key: "assets", label: "我的素材", description: "永久保存内容", icon: FolderHeart },
    { key: "purchases", label: "已购项目", description: "已解锁提示词", icon: ReceiptText },
    { key: "account", label: "账户与邀请", description: "余额和佣金", icon: Gift },
];

export default function ProfilePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const requested = searchParams.get("section");
    const active: ProfileSection = sections.some((item) => item.key === requested) ? requested as ProfileSection : "overview";

    return (
        <main className="aikart-profile-page">
            <header className="aikart-profile-heading">
                <div><span>PROFILE</span><h1>个人资料</h1><p>集中管理爱坤Ai账户、素材、令牌和已购内容</p></div>
            </header>
            <div className="aikart-profile-layout">
                <nav className="aikart-profile-nav" aria-label="个人资料导航">
                    {sections.map((item) => {
                        const Icon = item.icon;
                        return <button key={item.key} type="button" className={active === item.key ? "is-active" : ""} onClick={() => setSearchParams(item.key === "overview" ? {} : { section: item.key })}><Icon className="size-4" /><span><strong>{item.label}</strong><small>{item.description}</small></span></button>;
                    })}
                </nav>
                <section className="aikart-profile-content">
                    {active === "overview" ? <ProfileOverview /> : null}
                    {active === "assets" ? <AssetsPage embedded /> : null}
                    {active === "purchases" ? <PurchasedProjects /> : null}
                    {active === "account" ? <AccountPage embedded /> : null}
                </section>
            </div>
        </main>
    );
}

function ProfileOverview() {
    const user = useAuthStore((state) => state.user)!;
    return <div className="aikart-profile-overview">
        <section className="aikart-profile-identity">
            <Avatar size={68} src={user.avatarUrl || undefined} icon={<UserRound className="size-7" />} />
            <div className="aikart-profile-name"><span>爱坤Ai账户</span><h2>{user.displayName}</h2><p>@{user.username}</p></div>
            <div className="aikart-profile-balance"><WalletCards className="size-5" /><span>可用余额</span><strong>{formatAmount(user.balance)}</strong></div>
        </section>
        <section className="aikart-profile-facts">
            <div><ShieldCheck className="size-4" /><span>账户权限</span><strong>{user.role === "admin" ? "管理员" : "普通用户"}</strong></div>
            <div><KeyRound className="size-4" /><span>当前令牌</span><strong>{user.apiKeyHint || "未配置"}</strong></div>
            <div><LibraryBig className="size-4" /><span>临时结果保留</span><strong>{user.retentionDays} 天</strong></div>
        </section>
        <div className="aikart-profile-section-heading"><div><h2>访问令牌</h2><p>从你在爱坤Ai创建的可用令牌中选择；切换后所有工作台立即使用新令牌。</p></div></div>
        <AikartTokenPicker />
        <aside className="aikart-profile-retention"><ShieldCheck className="size-5" /><div><strong>你的长期内容不会被自动清理</strong><p>手动上传的素材永久保存，已保存、已发布和已购买的作品持续保留；只有未保存且未发布的生成结果会在 {user.retentionDays} 天后清理。</p></div></aside>
    </div>;
}

function PurchasedProjects() {
    const { message } = App.useApp();
    const copyText = useCopyText();
    const [items, setItems] = useState<PurchasedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [copyingId, setCopyingId] = useState("");
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const result = await apiFetch<{ items: PurchasedItem[] }>("/api/purchases");
            setItems(result.items);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取已购项目失败");
        } finally {
            setLoading(false);
        }
    }, [message]);
    useEffect(() => { void load(); }, [load]);

    const copyPrompt = async (item: PurchasedItem) => {
        setCopyingId(item.id);
        try {
            const result = await apiFetch<{ prompt: string }>(`/api/works/${item.workId}/prompt`);
            copyText(result.prompt, "提示词已复制");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取提示词失败");
        } finally {
            setCopyingId("");
        }
    };

    return <div className="aikart-purchases-page">
        <header className="aikart-profile-section-heading"><div><span>PURCHASED</span><h2>已购项目</h2><p>成功解锁的付费作品会永久显示在这里，提示词可随时复制。</p></div><Tag>{items.length} 件</Tag></header>
        {loading ? <Skeleton active paragraph={{ rows: 7 }} /> : items.length ? <div className="aikart-purchase-grid">{items.map((item) => <article key={item.id} className="aikart-purchase-card">
            <div className="aikart-purchase-media"><img src={item.media.url} alt={item.title} loading="lazy" draggable={false} /></div>
            <div className="aikart-purchase-copy"><div className="aikart-purchase-owner"><Avatar size={24} src={item.owner.avatarUrl || undefined}>{item.owner.displayName.slice(0, 1)}</Avatar><span>{item.owner.displayName}</span><small>@{item.owner.username}</small></div><h3>{item.title}</h3><p>{item.description || "创作者暂未填写作品说明"}</p><footer><span>{formatAmount(item.price)} 余额 · {new Date(item.completedAt).toLocaleDateString("zh-CN")}</span><Button type="primary" icon={<Copy className="size-4" />} loading={copyingId === item.id} onClick={() => void copyPrompt(item)}>复制提示词</Button></footer></div>
        </article>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有已购项目" />}
    </div>;
}

function formatAmount(value: number) {
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }).format(value);
}
