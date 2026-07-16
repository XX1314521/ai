import { App, Button, Input, Segmented, Select, Skeleton } from "antd";
import { Copy, ImagePlus, Images, LockKeyhole, Search, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { PublishWorkDialog } from "@/components/showcase/publish-work-dialog";
import { useCopyText } from "@/hooks/use-copy-text";
import { ApiClientError, apiFetch } from "@/lib/api-client";
import { useAuthStore } from "@/stores/use-auth-store";
import type { ShowcaseWork } from "@/types/platform";
import "./showcase.css";

type ShowcaseResponse = { items: ShowcaseWork[]; total: number; settings: { platformFeePercent: number; inviteCommissionOfFeePercent: number; minPrice: number } };
const walletUrl = "https://ai.ikui.cn/wallet";

export default function ShowcasePage() {
    const { message, modal } = App.useApp();
    const copyText = useCopyText();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useAuthStore((state) => state.user);
    const setBalance = useAuthStore((state) => state.setBalance);
    const interactive = useDesktopWorkActions();
    const [items, setItems] = useState<ShowcaseWork[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState("");
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
            setItems(result.items);
            setTotal(result.total);
            setActiveId("");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取作品失败");
        } finally {
            setLoading(false);
        }
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
    const markUnlocked = (id: string) => {
        setItems((current) => current.map((item) => item.id === id ? { ...item, purchased: true, canAccessPrompt: true } : item));
    };
    const showRechargeConfirm = () => {
        modal.confirm({
            className: "aikart-purchase-confirm",
            title: "爱坤Ai余额不足",
            content: "当前余额无法完成解锁，是否前往爱坤Ai充值？",
            okText: "前往充值",
            cancelText: "暂不充值",
            centered: true,
            onOk: () => window.location.assign(walletUrl),
        });
    };
    const confirmPurchase = (work: ShowcaseWork) => {
        modal.confirm({
            className: "aikart-purchase-confirm",
            title: "解锁作品提示词",
            icon: <WalletCards className="mr-2 inline size-5 text-emerald-500" />,
            content: <div className="aikart-purchase-summary"><p>是否支付 <strong>{formatPrice(work.price)}</strong> 爱坤Ai余额解锁提示词？</p><span>支付成功后可立即复制，并会永久加入“已购项目”。</span></div>,
            okText: `支付 ${formatPrice(work.price)}`,
            cancelText: "取消",
            centered: true,
            onOk: async () => {
                try {
                    const result = await apiFetch<{ prompt: string; balance: number }>(`/api/works/${work.id}/purchase`, { method: "POST" });
                    setBalance(result.balance);
                    markUnlocked(work.id);
                    copyText(result.prompt, "支付成功，提示词已复制");
                } catch (error) {
                    if (error instanceof ApiClientError && error.code === "insufficient_balance") {
                        window.setTimeout(showRechargeConfirm, 0);
                        return;
                    }
                    message.error(error instanceof Error ? error.message : "支付失败");
                    throw error;
                }
            },
        });
    };
    const copyPrompt = async (work: ShowcaseWork) => {
        if (!interactive) return;
        if (!requireLogin()) return;
        if (work.accessType === "paid" && !work.canAccessPrompt) {
            confirmPurchase(work);
            return;
        }
        try {
            const result = await apiFetch<{ prompt: string }>(`/api/works/${work.id}/prompt`);
            copyText(result.prompt, "提示词已复制");
        } catch (error) {
            if (error instanceof ApiClientError && error.code === "purchase_required") {
                confirmPurchase({ ...work, canAccessPrompt: false });
                return;
            }
            message.error(error instanceof Error ? error.message : "复制提示词失败");
        }
    };

    const areaTitle = area === "paid" ? "付费灵感" : area === "mine" ? "我的作品" : "免费灵感";
    const emptyText = area === "mine" ? "还没有保存或发布作品" : "这个分区暂时没有作品";
    const segments = useMemo(() => [{ label: "免费区", value: "free" }, { label: "付费区", value: "paid" }, ...(user ? [{ label: "我的作品", value: "mine" }] : [])], [user]);

    return <main className="showcase-page" onClick={() => interactive && setActiveId("")}>
        <section className="showcase-intro">
            <span className="showcase-eyebrow">VISUAL ATLAS</span>
            <h1>{areaTitle}</h1>
            <p>{area === "paid" ? "解锁创作者的完整提示词" : area === "mine" ? "管理已保存和已发布的作品" : "探索社区公开分享的视觉作品"}</p>
            <div className="showcase-controls">
                <Segmented value={area} options={segments} onChange={(value) => updateQuery({ area: String(value) })} />
                <Input prefix={<Search className="size-4" />} value={search} allowClear placeholder="搜索作品或作者" onChange={(event) => setSearch(event.target.value)} onPressEnter={() => updateQuery({ search })} />
                <Select value={sort} options={[{ label: "最新发布", value: "latest" }, { label: "热门作品", value: "popular" }]} onChange={(value) => updateQuery({ sort: value })} />
                {user && interactive ? <Button className="showcase-desktop-action" type="primary" icon={<ImagePlus className="size-4" />} onClick={(event) => { event.stopPropagation(); setPublishing(true); }}>发布作品</Button> : null}
            </div>
            <small>{total} 件作品</small>
        </section>

        {loading ? <div className="showcase-loading"><Skeleton active paragraph={{ rows: 8 }} /></div> : items.length ? <section className="showcase-masonry">{items.map((work, index) => <WorkCard key={work.id} work={work} eager={index < 8} interactive={interactive} active={activeId === work.id} onActivate={() => setActiveId((current) => current === work.id ? "" : work.id)} onCopy={() => void copyPrompt(work)} />)}</section> : <section className="showcase-empty"><span><Images className="size-8" /></span><h2>{emptyText}</h2>{user && interactive ? <Button icon={<ImagePlus className="size-4" />} onClick={(event) => { event.stopPropagation(); setPublishing(true); }}>发布第一件作品</Button> : !user ? <Button onClick={() => navigate("/login?returnTo=/showcase")}>登录后发布</Button> : null}</section>}

        <PublishWorkDialog open={publishing} onClose={() => setPublishing(false)} onPublished={() => void load()} />
    </main>;
}

function WorkCard({ work, eager, interactive, active, onActivate, onCopy }: { work: ShowcaseWork; eager: boolean; interactive: boolean; active: boolean; onActivate: () => void; onCopy: () => void }) {
    const paidLocked = work.accessType === "paid" && !work.canAccessPrompt;
    const activate = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        if (interactive) onActivate();
    };
    return <article
        className={`showcase-work-card${active ? " is-active" : ""}${interactive ? " is-interactive" : " is-view-only"}`}
        tabIndex={interactive ? 0 : undefined}
        onClick={activate}
        onKeyDown={(event) => { if (interactive && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onActivate(); } }}
        onContextMenu={(event) => event.preventDefault()}
    >
        <div className="showcase-work-image">
            <img src={work.media.url} alt={work.title} loading={eager ? "eager" : "lazy"} draggable={false} onDragStart={(event) => event.preventDefault()} />
            <span className={`showcase-access-badge ${work.accessType}`}>{work.accessType === "paid" ? <><LockKeyhole className="size-3" />{formatPrice(work.price)}</> : work.accessType === "free" ? "免费" : "私密"}</span>
            {!interactive ? <span className="showcase-mobile-shield" aria-hidden="true" /> : null}
        </div>
        {interactive ? <div className="showcase-work-overlay">
            <div className="showcase-work-copy"><small>{work.owner.displayName}</small><strong>{work.title}</strong><p>{work.description || "创作者暂未填写作品说明"}</p></div>
            <button type="button" onClick={(event) => { event.stopPropagation(); onCopy(); }}>{paidLocked ? <LockKeyhole className="size-4" /> : <Copy className="size-4" />}{paidLocked ? "提示词未解锁" : "复制提示词"}</button>
        </div> : null}
    </article>;
}

function useDesktopWorkActions() {
    const query = "(min-width: 1025px) and (hover: hover) and (pointer: fine)";
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
    useEffect(() => {
        const media = window.matchMedia(query);
        const update = () => setMatches(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);
    return matches;
}

function formatPrice(value: number) {
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }).format(value);
}
