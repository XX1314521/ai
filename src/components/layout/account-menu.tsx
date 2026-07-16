import { Avatar, Button, Dropdown, type MenuProps } from "antd";
import { LogIn, LogOut, Settings2, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/stores/use-auth-store";
import { useConfigStore } from "@/stores/use-config-store";

export function AccountMenu() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAuthStore((state) => state.user);
    const status = useAuthStore((state) => state.status);
    const logout = useAuthStore((state) => state.logout);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    if (!user) {
        return (
            <Button
                type="text"
                loading={status === "loading"}
                icon={<LogIn className="size-4" />}
                onClick={() => navigate(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`)}
            >
                登录
            </Button>
        );
    }

    const items: MenuProps["items"] = [
        {
            key: "identity",
            disabled: true,
            label: <div className="min-w-44 py-1"><div className="font-semibold text-slate-900">{user.displayName}</div><div className="mt-0.5 text-xs text-slate-500">@{user.username}</div></div>,
        },
        { type: "divider" },
        { key: "balance", icon: <WalletCards className="size-4" />, label: `余额 ${formatBalance(user.balance)}` },
        { key: "profile", icon: <UserRound className="size-4" />, label: "个人资料" },
        { key: "config", icon: <Settings2 className="size-4" />, label: "模型配置" },
        ...(user.role === "admin" ? [{ key: "admin", icon: <ShieldCheck className="size-4" />, label: "后台管理" }] : []),
        { type: "divider" },
        { key: "logout", icon: <LogOut className="size-4" />, label: "退出登录", danger: true },
    ];
    const onClick: MenuProps["onClick"] = async ({ key }) => {
        if (key === "profile" || key === "balance") navigate("/profile");
        if (key === "config") openConfigDialog(false, "channels");
        if (key === "admin") navigate("/admin");
        if (key === "logout") {
            await logout();
            navigate("/login", { replace: true });
        }
    };
    return (
        <Dropdown menu={{ items, onClick }} placement="bottomRight" trigger={["click"]}>
            <button type="button" className="aikart-account-trigger" aria-label="账户菜单">
                <Avatar size={30} src={user.avatarUrl || undefined} icon={<UserRound className="size-4" />} />
                <span>{formatBalance(user.balance)}</span>
            </button>
        </Dropdown>
    );
}

function formatBalance(value: number) {
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }).format(value);
}
