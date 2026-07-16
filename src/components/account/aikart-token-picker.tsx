import { App, Button, Select } from "antd";
import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/use-auth-store";
import type { PlatformUser } from "@/types/platform";

type UserToken = {
    id: string;
    name: string;
    hint: string;
    selected: boolean;
    createdAt: string | null;
    lastUsedAt: string | null;
    expiresAt: string | null;
    unlimited: boolean;
    remainingBalance: number;
    group: string;
};

type TokenResponse = {
    items: UserToken[];
    selectedTokenId: string | null;
};

export function AikartTokenPicker({ variant = "panel", className, value, onChange }: { variant?: "panel" | "field"; className?: string; value?: string; onChange?: (tokenId: string) => void }) {
    const { message } = App.useApp();
    const user = useAuthStore((state) => state.user);
    const setUser = useAuthStore((state) => state.setUser);
    const [items, setItems] = useState<UserToken[]>([]);
    const controlledField = variant === "field" && Boolean(onChange);
    const [selectedId, setSelectedId] = useState<string | null>(value || user?.selectedTokenId || null);
    const [loading, setLoading] = useState(false);
    const [switching, setSwitching] = useState(false);

    const load = useCallback(async (showSuccess = false) => {
        setLoading(true);
        try {
            const result = await apiFetch<TokenResponse>("/api/account/tokens");
            setItems(result.items);
            setSelectedId(value || result.selectedTokenId || result.items.find((item) => item.selected)?.id || null);
            if (showSuccess) message.success("令牌列表已刷新");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "读取爱坤Ai令牌失败");
        } finally {
            setLoading(false);
        }
    }, [message, value]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (value) setSelectedId(value);
        else if (user?.selectedTokenId) setSelectedId(user.selectedTokenId);
    }, [user?.selectedTokenId, value]);

    const selectToken = async (tokenId: string) => {
        if (controlledField) {
            if (value === tokenId) return;
            setSelectedId(tokenId);
            onChange?.(tokenId);
            message.success("该渠道访问令牌已更新");
            return;
        }
        if (tokenId === selectedId) return;
        setSwitching(true);
        try {
            const result = await apiFetch<{ user: PlatformUser }>("/api/account/token", {
                method: "PUT",
                body: JSON.stringify({ tokenId }),
            });
            setSelectedId(tokenId);
            setItems((current) => current.map((item) => ({ ...item, selected: item.id === tokenId })));
            setUser(result.user);
            message.success("当前访问令牌已切换");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "切换令牌失败");
        } finally {
            setSwitching(false);
        }
    };

    const selected = items.find((item) => item.id === selectedId);
    const control = <div className="aikart-token-picker-control">
        <Select
            value={selectedId || undefined}
            loading={loading || switching}
            disabled={!items.length && !loading}
            placeholder={loading ? "正在读取令牌" : "暂无可用令牌"}
            options={items.map((item) => ({
                value: item.id,
                label: `${item.name}  ${item.hint}`,
            }))}
            onChange={(value) => void selectToken(value)}
            popupMatchSelectWidth={variant === "field" ? 420 : 360}
        />
        <Button
            aria-label="刷新令牌列表"
            title="刷新令牌列表"
            icon={<RefreshCw className="size-4" />}
            loading={loading}
            onClick={() => void load(true)}
        />
    </div>;
    if (variant === "field") {
        return <div className={cn("aikart-token-field", className)}>
            {control}
            {selected ? <small><ShieldCheck className="size-3.5" />当前使用 {selected.name} · {selected.hint}</small> : null}
        </div>;
    }
    return (
        <section className={cn("aikart-token-picker", className)}>
            <div className="aikart-token-picker-copy">
                <span className="aikart-token-picker-icon"><KeyRound className="size-4" /></span>
                <div>
                    <strong>爱坤Ai访问令牌</strong>
                    <p>选择你在爱坤Ai配置的令牌，完整密钥只保存在 AikArt 服务端。</p>
                </div>
            </div>
            {control}
            {selected ? <small><ShieldCheck className="size-3.5" />当前使用 {selected.name} · {selected.hint}</small> : null}
        </section>
    );
}
