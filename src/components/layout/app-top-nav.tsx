import { Bot, Menu } from "lucide-react";
import { Button, Tooltip } from "antd";
import { Link, useLocation } from "react-router-dom";

import { navigationTools, type NavigationToolSlug } from "@/constant/navigation-tools";
import { AppConfigModal } from "@/components/layout/app-config-modal";
import { MobileNavDrawer } from "@/components/layout/mobile-nav-drawer";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useAgentStore } from "@/stores/use-agent-store";
import { useConfigStore } from "@/stores/use-config-store";

export function AppTopNav() {
    const { pathname } = useLocation();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const autoConnectRef = useRef(false);
    const agentToken = useAgentStore((state) => state.token);
    const agentEnabled = useAgentStore((state) => state.enabled);
    const agentConnected = useAgentStore((state) => state.connected);
    const connectAgent = useAgentStore((state) => state.connectAgent);
    const togglePanel = useAgentStore((state) => state.togglePanel);
    const panelOpen = useAgentStore((state) => state.panelOpen);
    const hideHeader = /^\/canvas\/[^/]+/.test(pathname);
    const slug = pathname.split("/").filter(Boolean)[0];
    const activeToolSlug = pathname === "/" ? "canvas" : navigationTools.some((tool) => tool.slug === slug) ? (slug as NavigationToolSlug) : undefined;

    useEffect(() => {
        if (autoConnectRef.current || agentEnabled || agentConnected || !agentToken.trim()) return;
        autoConnectRef.current = true;
        connectAgent();
    }, [agentConnected, agentEnabled, agentToken, connectAgent]);

    return (
        <>
            {!hideHeader ? (
                <header className="app-top-nav sticky top-0 z-20 h-[92px] shrink-0 border-0 bg-transparent">
                    <div className="app-nav-inner mx-auto flex h-full max-w-[1920px] items-stretch justify-between gap-5 px-7 sm:px-14">
                        <div className="flex min-w-0 items-center">
                            <Link to="/" className="app-brand flex h-full shrink-0 items-center gap-2 text-sm font-semibold leading-none tracking-tight text-[#11172c] transition hover:opacity-70">
                                <span
                                    className="size-5 shrink-0 bg-current"
                                    style={{
                                        mask: "url(/logo.svg) center / contain no-repeat",
                                        WebkitMask: "url(/logo.svg) center / contain no-repeat",
                                    }}
                                />
                                <span className="text-base font-medium">爱坤Ai画布</span>
                            </Link>

                            <button
                                type="button"
                                className="ml-3 inline-flex size-8 shrink-0 items-center justify-center text-stone-600 transition hover:text-stone-950 md:hidden dark:text-stone-300 dark:hover:text-white"
                                onClick={() => setMobileNavOpen(true)}
                                aria-label="打开导航菜单"
                                title="导航菜单"
                            >
                                <Menu className="size-5" />
                            </button>

                            <nav className="app-main-nav hide-scrollbar ml-20 hidden h-16 min-w-0 items-center gap-1 overflow-x-auto rounded-full border border-white/80 bg-white/75 px-2 shadow-[0_10px_30px_rgba(56,75,105,.08)] md:flex">
                                {navigationTools.map((tool) => {
                                    const Icon = tool.icon;
                                    const active = tool.slug === activeToolSlug;
                                    return (
                                        <Link
                                            key={tool.slug}
                                            to={`/${tool.slug}`}
                                            className={cn(
                                                "app-nav-link relative flex h-12 shrink-0 items-center gap-2 rounded-full px-5 text-sm leading-6 transition",
                                                active
                                                    ? "app-nav-link-active font-semibold text-stone-950"
                                                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-950",
                                            )}
                                        >
                                            <Icon className="size-4" />
                                            <span className="truncate">{tool.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>

                        <div className="app-nav-actions my-auto flex h-12 min-w-0 items-center justify-end gap-2 justify-self-end whitespace-nowrap rounded-xl border border-white/90 bg-white/70 px-2 shadow-[0_8px_24px_rgba(56,75,105,.06)]">
                            <CodexStatusButton />
                            <Tooltip title={panelOpen ? "收起 Agent" : "打开 Agent"}>
                                <Button type="text" shape="circle" className="!h-8 !w-8 !min-w-8" icon={<Bot className="size-4" />} onClick={togglePanel} aria-label="打开 Agent" />
                            </Tooltip>
                            <UserStatusActions />
                            <Button type="primary" className="app-workbench-button !h-10 !rounded-lg !px-5" onClick={() => window.location.assign("/canvas")}>进入工作台</Button>
                        </div>
                    </div>
                </header>
            ) : null}

            <MobileNavDrawer open={mobileNavOpen} activeToolSlug={activeToolSlug} onClose={() => setMobileNavOpen(false)} />
            <AppConfigModal />
        </>
    );
}

function CodexStatusButton() {
    const connected = useAgentStore((state) => state.connected);
    const enabled = useAgentStore((state) => state.enabled);
    const activity = useAgentStore((state) => state.activity);
    const connectError = useAgentStore((state) => state.connectError);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const color = connectError ? "#dc2626" : connected ? "#16a34a" : enabled ? "#d97706" : "currentColor";
    const title = connectError || (connected ? activity || "Codex 已连接" : enabled ? "Codex 连接中" : "Codex 未连接");
    return (
        <Tooltip title={title}>
            <Button type="text" shape="circle" className="relative !h-8 !w-8 !min-w-8" onClick={() => openConfigDialog(false, "codex")} aria-label="Codex 连接状态">
                <span className="mx-auto block size-4" style={{ background: color, WebkitMask: "url(/icons/openai.svg) center / contain no-repeat", mask: "url(/icons/openai.svg) center / contain no-repeat" }} />
                <span className="absolute right-1 top-1 size-2 rounded-full border border-background" style={{ background: color }} />
            </Button>
        </Tooltip>
    );
}
