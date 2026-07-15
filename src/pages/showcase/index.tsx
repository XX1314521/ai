import { App, Avatar, Button, Input, Modal, Segmented, Select, Skeleton } from "antd";
import { Copy, Download, Eye, ImagePlus, Images, LockKeyhole, Search, Sparkles, WalletCards, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { PublishWorkDialog } from "@/components/showcase/publish-work-dialog";
import { apiFetch } from "@/lib/api-client";
import { useAuthStore } from "@/stores/use-auth-store";
import type { ShowcaseWork } from "@/types/platform";
import "./showcase.css";

type ShowcaseResponse = { items: ShowcaseWork[]; total: number; settings: { platformFeePercent: number; inviteCommissionOfFeePercent: number; minPrice: number } };

export default function ShowcasePage() {
    const { message, modal } = App.useApp();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useAuthStore((state) => state.user);
    const setBalance = useAuthStore((state) => state.setBalance);
    const [items, setItems] = useState<ShowcaseWork[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<ShowcaseWork | null>(null);
    const [publishing, setPublishing] = useState(false);
    const [search, setSearch] = useState(searchParams.get("search") || "");
    const area = searchParams.get("area") === "paid" || searchParams.get("area") === "mine" ? searchParams.get("area")! : "free";
    const sort = searchParams.get("sort") === "popular" ? "popular" : "latest";

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ area, sort, pageSize: "60" });
            if (searchParams.get("search")) params.set("search", searchParams.get("search")!);
            const result = await apiFetch<ShowcaseResponse>(`/api/works?${params}`);
            setItems(result.items); setTotal(result.total);
        } catch (error) { message.error(error instanceof Error ? error.message : "读取作品失败"); }
        finally { setLoading(false); }
    }, [area, message, searchParams, sort]);
    useEffect(() => { void load(); }, [load]);

    const updateQuery = (patch: Record<string, string>) => {
        const next = new URLSearchParams(searchParams);
        Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
        setSearchParams(next);
    };
    const requireLogin = () => {
        if (user) return true;
        navigate(`/login?returnTo=${encodeURIComponent(`/showcase?${searchParams}`)}`);
        return false;
    };
    const copyPrompt = async (work: ShowcaseWork) => {
        if (!work.canAccessPrompt && work.accessType === "paid") {
            if (!requireLogin()) return;
            modal.confirm({
                className: "aikart-purchase-confirm",
                title: "解锁作品提示词",
                icon: <WalletCards className="mr-2 inline size-5 text-emerald-400" />,
                content: <div className="aikart-purchase-summary"><p>确认支付 <strong>{formatPrice(work.price)}</strong> 爱坤Ai余额？</p><span>支付成功后提示词会自动复制，作者收到扣除平台手续费后的余额。</span></div>,
                okText: `支付 ${formatPrice(work.price)}`,
                cancelText: "取消",
                centered: true,
                onOk: async () => {
                    try {
                        const result = await apiFetch<{ prompt: string; balance: number }>(`/api/works/${work.id}/purchase`, { method: "POST" });
                        await navigator.clipboard.writeText(result.prompt);
                        setBalance(result.balance);
                        markUnlocked(work.id);
                        message.success("支付成功，提示词已复制");
                    } catch (error) {
                        message.error(error instanceof Error ? error.message : "支付失败");
                        throw error;
                    }
                },
            });
            return;
        }
        if (!requireLogin()) return;
        try {
            const result = await apiFetch<{ prompt: string }>(`/api/works/${work.id}/prompt`);
            await navigator.clipboard.writeText(result.prompt);
            message.success("提示词已复制");
        } catch (error) { message.error(error instanceof Error ? error.message : "复制提示词失败"); }
    };
    const markUnlocked = (id: string) => {
        setItems((current) => current.map((item) => item.id === id ? { ...item, purchased: true, canAccessPrompt: true } : item));
        setSelected((current) => current?.id === id ? { ...current, purchased: true, canAccessPrompt: true } : current);
    };

    const areaTitle = area === "paid" ? "付费灵感" : area === "mine" ? "我的作品" : "免费灵感";
    const emptyText = area === "mine" ? "还没有保存或发布作品" : "这个分区暂时没有作品";
    const segments = useMemo(() => [{ label: "免费区", value: "free" }, { label: "付费区", value: "paid" }, ...(user ? [{ label: "我的作品", value: "mine" }] : [])], [user]);

    return <main className="showcase-page">
        <section className="showcase-intro">
            <span className="showcase-eyebrow">VISUAL ATLAS</span>
            <h1>{areaTitle}</h1>
            <p>{area === "paid" ? "解锁创作者的完整提示词" : area === "mine" ? "管理已保存和已发布的作品" : "探索社区公开分享的视觉作品"}</p>
            <div className="showcase-controls">
                <Segmented value={area} options={segments} onChange={(value) => updateQuery({ area: String(value) })} />
                <Input prefix={<Search className="size-4" />} value={search} allowClear placeholder="搜索作品或作者" onChange={(event) => setSearch(event.target.value)} onPressEnter={() => updateQuery({ search })} />
                <Select value={sort} options={[{ label: "最新发布", value: "latest" }, { label: "热门作品", value: "popular" }]} onChange={(value) => updateQuery({ sort: value })} />
                {user ? <Button type="primary" icon={<ImagePlus className="size-4" />} onClick={() => setPublishing(true)}>发布作品</Button> : null}
            </div>
            <small>{total} 件作品</small>
        </section>

        {loading ? <div className="showcase-loading"><Skeleton active paragraph={{ rows: 8 }} /></div> : items.length ? <section className="showcase-masonry">{items.map((work, index) => <WorkCard key={work.id} work={work} eager={index < 8} onPreview={() => setSelected(work)} onCopy={() => void copyPrompt(work)} />)}</section> : <section className="showcase-empty"><span><Images className="size-8" /></span><h2>{emptyText}</h2>{user ? <Button icon={<ImagePlus className="size-4" />} onClick={() => setPublishing(true)}>发布第一件作品</Button> : <Button onClick={() => navigate("/login?returnTo=/showcase")}>登录后发布</Button>}</section>}

        <Modal className="showcase-preview-modal" open={Boolean(selected)} centered width={1100} footer={null} closeIcon={<X className="size-5" />} onCancel={() => setSelected(null)} destroyOnHidden>
            {selected ? <div className="showcase-preview-layout"><div className="showcase-preview-image"><img src={selected.media.url} alt={selected.title} /></div><aside><div className="showcase-preview-author"><Avatar src={selected.owner.avatarUrl || undefined}>{selected.owner.displayName.slice(0,1)}</Avatar><span><strong>{selected.owner.displayName}</strong><small>@{selected.owner.username}</small></span></div><h2>{selected.title}</h2><p>{selected.description || "创作者暂未填写作品说明"}</p><div className="showcase-preview-meta"><span><Eye className="size-4" />{selected.stats.views}</span><span><Copy className="size-4" />{selected.stats.copies}</span><span>{new Date(selected.publishedAt || selected.createdAt).toLocaleDateString("zh-CN")}</span></div><div className="showcase-preview-actions"><Button type="primary" size="large" icon={selected.accessType === "paid" && !selected.canAccessPrompt ? <LockKeyhole className="size-4" /> : <Copy className="size-4" />} onClick={() => void copyPrompt(selected)}>{selected.accessType === "paid" && !selected.canAccessPrompt ? `${formatPrice(selected.price)} 解锁提示词` : "复制提示词"}</Button><Button size="large" icon={<Download className="size-4" />} href={selected.media.downloadUrl}>下载图片</Button></div></aside></div> : null}
        </Modal>
        <PublishWorkDialog open={publishing} onClose={() => setPublishing(false)} onPublished={() => void load()} />
    </main>;
}

function WorkCard({ work, eager, onPreview, onCopy }: { work: ShowcaseWork; eager: boolean; onPreview: () => void; onCopy: () => void }) {
    const paidLocked = work.accessType === "paid" && !work.canAccessPrompt;
    return <article className="showcase-work-card"><button type="button" className="showcase-work-image" onClick={onPreview}><img src={work.media.url} alt={work.title} loading={eager ? "eager" : "lazy"} /><span className={`showcase-access-badge ${work.accessType}`}>{work.accessType === "paid" ? <><LockKeyhole className="size-3" />{formatPrice(work.price)}</> : work.accessType === "free" ? "FREE" : "PRIVATE"}</span><span className="showcase-view-hint"><Eye className="size-4" />预览</span></button><div className="showcase-work-overlay"><div><strong>{work.title}</strong><span>{work.owner.displayName}</span></div><button type="button" onClick={(event) => { event.stopPropagation(); onCopy(); }}>{paidLocked ? <LockKeyhole className="size-4" /> : <Copy className="size-4" />}{paidLocked ? "付费复制" : "复制提示词"}</button></div></article>;
}

function formatPrice(value: number) { return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }).format(value); }
