import { App, Modal, Tooltip } from "antd";
import { Database, FilePlus2, Settings2 } from "lucide-react";
import { useEffect } from "react";

import { AppConfigModal } from "@/components/layout/app-config-modal";
import { useComicStore, type ComicStage } from "@/stores/use-comic-store";
import { useConfigStore } from "@/stores/use-config-store";
import { ComicVisualWorkbench } from "./comic-visual-workbench";

type DesktopStage = Extract<ComicStage, "storyboard" | "panorama" | "director">;

const desktopStages = new Set<ComicStage>(["storyboard", "panorama", "director"]);

export function ComicDesktopApp() {
    const { message } = App.useApp();
    const projectName = useComicStore((state) => state.projectName);
    const activeStage = useComicStore((state) => state.activeStage);
    const setActiveStage = useComicStore((state) => state.setActiveStage);
    const resetProject = useComicStore((state) => state.resetProject);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const desktopStage: DesktopStage = desktopStages.has(activeStage) ? activeStage as DesktopStage : "storyboard";

    useEffect(() => {
        document.documentElement.dataset.appSurface = "desktop";
        return () => { delete document.documentElement.dataset.appSurface; };
    }, []);

    useEffect(() => {
        if (activeStage !== desktopStage) setActiveStage(desktopStage);
    }, [activeStage, desktopStage, setActiveStage]);

    const createProject = () => {
        Modal.confirm({
            title: "新建漫剧分镜项目",
            content: "当前项目已经保存在本机。新建后仍可通过之前导出的项目文件恢复。",
            okText: "新建项目",
            cancelText: "取消",
            centered: true,
            onOk: () => {
                resetProject();
                setActiveStage("storyboard");
                message.success("已创建新的本地分镜项目");
            },
        });
    };

    return (
        <div className="comic-desktop-app">
            <header className="comic-desktop-titlebar">
                <div className="comic-desktop-brand">
                    <img src="./logo.svg" alt="" />
                    <div>
                        <strong>AikArt Storyboard</strong>
                        <span>{projectName}</span>
                    </div>
                </div>
                <div className="comic-desktop-status"><Database className="size-3.5" /> 本地自动保存</div>
                <div className="comic-desktop-actions">
                    <Tooltip title="新建本地项目">
                        <button type="button" onClick={createProject} aria-label="新建本地项目"><FilePlus2 className="size-4" /></button>
                    </Tooltip>
                    <Tooltip title="配置模型与渠道">
                        <button type="button" onClick={() => openConfigDialog(false, "channels")} aria-label="配置模型与渠道"><Settings2 className="size-4" /></button>
                    </Tooltip>
                </div>
            </header>
            <main className="comic-desktop-main">
                <ComicVisualWorkbench stage={desktopStage} />
            </main>
            <AppConfigModal />
        </div>
    );
}
