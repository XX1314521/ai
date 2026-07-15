import {
    Aperture,
    Box,
    Camera,
    Check,
    ChevronDown,
    CircleUserRound,
    Copy,
    Download,
    FileDown,
    FileUp,
    Focus,
    Grid2X2,
    ImageIcon,
    Images,
    Lightbulb,
    LoaderCircle,
    Maximize2,
    Mic2,
    Minus,
    MousePointer2,
    Move3D,
    PackagePlus,
    PanelTop,
    Play,
    Plus,
    Redo2,
    RotateCcw,
    Save,
    Sparkles,
    SplitSquareVertical,
    Sun,
    Trash2,
    Type,
    Undo2,
    Upload,
    Video,
    WandSparkles,
    X,
    ZoomIn,
    ZoomOut,
} from "lucide-react";
import { App, Image, Modal, Tooltip } from "antd";
import { saveAs } from "file-saver";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { CanvasNodeCropDialog, type CanvasImageCropRect } from "@/components/canvas/canvas-node-crop-dialog";
import { CanvasNodeMaskEditDialog, type CanvasImageMaskEditPayload } from "@/components/canvas/canvas-node-mask-edit-dialog";
import { CanvasNodeSplitDialog, type CanvasImageSplitParams } from "@/components/canvas/canvas-node-split-dialog";
import { cropDataUrl, splitDataUrl } from "@/lib/canvas/canvas-image-data";
import { requestEdit, requestGeneration } from "@/services/api/image";
import { requestAudioGeneration, storeGeneratedAudio } from "@/services/api/audio";
import { requestVideoGeneration, storeGeneratedVideo } from "@/services/api/video";
import { resolveMediaUrl } from "@/services/file-storage";
import { resolveImageUrl, uploadImage } from "@/services/image-storage";
import { useAssetStore } from "@/stores/use-asset-store";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import {
    createShotsFromEpisode,
    useComicStore,
    type ComicCanvasNode,
    type ComicDirectorItem,
    type ComicDirectorScene,
    type ComicEpisode,
    type ComicPanorama,
    type ComicProjectState,
    type ComicShot,
    type ComicStage,
    type ComicVisualState,
} from "@/stores/use-comic-store";
import type { ReferenceImage } from "@/types/image";

type VisualStage = Extract<ComicStage, "storyboard" | "panorama" | "director">;
type PreviewImage = { url: string; title: string; downloadName: string } | null;
type ImageDialog = { type: "crop" | "mask" | "split"; shot: ComicShot } | null;

const visualStageMeta = {
    storyboard: { title: "AI 分镜画布", description: "拆分剧本、组织节点并生成连续分镜", icon: Grid2X2 },
    panorama: { title: "全景空间", description: "文生或图生全景，拖动查看并导入导演台", icon: Aperture },
    director: { title: "导演台", description: "布置人物、道具、场景、相机与灯光", icon: Move3D },
} satisfies Record<VisualStage, { title: string; description: string; icon: typeof Grid2X2 }>;

const shotSizes = ["大全景", "全景", "中景", "近景", "特写"];
const shotAngles = ["平视", "俯拍", "仰拍", "侧面", "过肩", "荷兰角"];
const shotMovements = ["固定", "推镜", "拉镜", "横移", "跟拍", "环绕", "手持"];
const frameOptions = ["16:9", "9:16", "1:1", "4:3", "21:9"];

export function ComicVisualWorkbench({ stage }: { stage: VisualStage }) {
    const meta = visualStageMeta[stage];
    const Icon = meta.icon;
    const episodes = useComicStore((state) => state.episodes);
    const selectedEpisodeId = useComicStore((state) => state.selectedEpisodeId);
    const selectEpisode = useComicStore((state) => state.selectEpisode);
    const setActiveStage = useComicStore((state) => state.setActiveStage);
    const projectName = useComicStore((state) => state.projectName);
    const replaceProject = useComicStore((state) => state.replaceProject);
    const importRef = useRef<HTMLInputElement>(null);
    const selectedEpisode = episodes.find((episode) => episode.id === selectedEpisodeId) || episodes[0];
    const { message } = App.useApp();

    const exportProject = () => {
        const state = useComicStore.getState();
        const payload = visualProjectPayload(state);
        saveAs(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }), `${safeName(projectName)}-漫剧项目.json`);
        message.success("漫剧项目已导出");
    };

    const importProject = async (files?: FileList | null) => {
        const file = files?.[0];
        if (!file) return;
        try {
            const parsed = JSON.parse(await file.text()) as Partial<ComicProjectState> & { kind?: string };
            if (parsed.kind !== "aikart-comic-project" || !Array.isArray(parsed.episodes)) throw new Error("不是有效的 AikArt 漫剧项目文件");
            replaceProject(parsed);
            message.success("项目已导入并自动保存");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "项目导入失败");
        } finally {
            if (importRef.current) importRef.current.value = "";
        }
    };

    return (
        <div className="comic-visual-workbench">
            <header className="comic-visual-header">
                <div className="comic-visual-title">
                    <span><Icon className="size-5" /></span>
                    <div><h2>{meta.title}</h2><p>{meta.description}</p></div>
                </div>
                <div className="comic-visual-header-actions">
                    <label className="comic-visual-episode-picker">
                        <select value={selectedEpisode?.id || ""} onChange={(event) => selectEpisode(event.target.value)}>
                            {episodes.map((episode) => <option key={episode.id} value={episode.id}>第 {episode.number} 集 · {episode.title}</option>)}
                        </select>
                        <ChevronDown className="size-4" />
                    </label>
                    <Tooltip title="导入项目"><button type="button" onClick={() => importRef.current?.click()}><FileUp className="size-4" /></button></Tooltip>
                    <Tooltip title="导出项目"><button type="button" onClick={exportProject}><FileDown className="size-4" /></button></Tooltip>
                    <input ref={importRef} hidden type="file" accept=".json,application/json" onChange={(event) => void importProject(event.target.files)} />
                </div>
            </header>

            <nav className="comic-visual-subnav">
                <button type="button" className={stage === "storyboard" ? "is-active" : ""} onClick={() => setActiveStage("storyboard")}><Grid2X2 className="size-4" /> 分镜画布</button>
                <button type="button" className={stage === "panorama" ? "is-active" : ""} onClick={() => setActiveStage("panorama")}><Aperture className="size-4" /> 全景空间</button>
                <button type="button" className={stage === "director" ? "is-active" : ""} onClick={() => setActiveStage("director")}><Move3D className="size-4" /> 导演台</button>
            </nav>

            {selectedEpisode ? (
                stage === "storyboard" ? <StoryboardWorkspace episode={selectedEpisode} /> : stage === "panorama" ? <PanoramaWorkspace episode={selectedEpisode} /> : <DirectorWorkspace episode={selectedEpisode} />
            ) : <div className="comic-visual-empty">请先创建分集规划</div>}
        </div>
    );
}

function StoryboardWorkspace({ episode }: { episode: ComicEpisode }) {
    const { message } = App.useApp();
    const effectiveConfig = useEffectiveConfig();
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const allShots = useComicStore((state) => state.shots);
    const allCanvasNodes = useComicStore((state) => state.canvasNodes);
    const allConnections = useComicStore((state) => state.canvasConnections);
    const selectedShotId = useComicStore((state) => state.selectedShotId);
    const selectedCanvasNodeId = useComicStore((state) => state.selectedCanvasNodeId);
    const viewport = useComicStore((state) => state.storyboardViewport);
    const promptPresets = useComicStore((state) => state.promptPresets);
    const setShots = useComicStore((state) => state.setShots);
    const addShot = useComicStore((state) => state.addShot);
    const updateShot = useComicStore((state) => state.updateShot);
    const removeShot = useComicStore((state) => state.removeShot);
    const duplicateShot = useComicStore((state) => state.duplicateShot);
    const selectShot = useComicStore((state) => state.selectShot);
    const addCanvasNode = useComicStore((state) => state.addCanvasNode);
    const updateCanvasNode = useComicStore((state) => state.updateCanvasNode);
    const removeCanvasNode = useComicStore((state) => state.removeCanvasNode);
    const selectCanvasNode = useComicStore((state) => state.selectCanvasNode);
    const addCanvasConnection = useComicStore((state) => state.addCanvasConnection);
    const setViewport = useComicStore((state) => state.setStoryboardViewport);
    const addAsset = useAssetStore((state) => state.addAsset);
    const canvasRef = useRef<HTMLDivElement>(null);
    const uploadRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<PreviewImage>(null);
    const [dialog, setDialog] = useState<ImageDialog>(null);
    const [miniMapOpen, setMiniMapOpen] = useState(true);
    const [connectingFrom, setConnectingFrom] = useState("");
    const historyRef = useRef<ComicVisualState[]>([]);
    const futureRef = useRef<ComicVisualState[]>([]);

    const shots = useMemo(
        () => allShots.filter((shot) => shot.episodeId === episode.id).sort((a, b) => a.order - b.order),
        [allShots, episode.id],
    );
    const canvasNodes = useMemo(
        () => allCanvasNodes.filter((node) => node.episodeId === episode.id),
        [allCanvasNodes, episode.id],
    );
    const connections = useMemo(
        () => allConnections.filter((connection) => connection.episodeId === episode.id),
        [allConnections, episode.id],
    );
    const selectedShot = shots.find((shot) => shot.id === selectedShotId) || null;
    const selectedNode = canvasNodes.find((node) => node.id === selectedCanvasNodeId) || null;
    const allCanvasItems = useMemo(() => [...shots.map(shotCanvasItem), ...canvasNodes.map(nodeCanvasItem)], [canvasNodes, shots]);

    useEffect(() => {
        void hydrateComicMedia(shots, canvasNodes, [], updateShot, updateCanvasNode, () => undefined);
    }, [canvasNodes, shots, updateCanvasNode, updateShot]);

    const checkpoint = useCallback(() => {
        historyRef.current = [...historyRef.current.slice(-29), visualSnapshot(useComicStore.getState())];
        futureRef.current = [];
    }, []);

    const undo = useCallback(() => {
        const previous = historyRef.current.pop();
        if (!previous) return message.info("没有可撤销的操作");
        futureRef.current.push(visualSnapshot(useComicStore.getState()));
        useComicStore.getState().replaceVisualState(previous);
    }, [message]);

    const redo = useCallback(() => {
        const next = futureRef.current.pop();
        if (!next) return message.info("没有可重做的操作");
        historyRef.current.push(visualSnapshot(useComicStore.getState()));
        useComicStore.getState().replaceVisualState(next);
    }, [message]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.matches("input,textarea,select,[contenteditable=true]")) return;
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
            if ((event.key === "Delete" || event.key === "Backspace") && (selectedShot || selectedNode)) {
                checkpoint();
                if (selectedShot) removeShot(selectedShot.id); else if (selectedNode) removeCanvasNode(selectedNode.id);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [checkpoint, redo, removeCanvasNode, removeShot, selectedNode, selectedShot, undo]);

    const generateShots = () => {
        checkpoint();
        const generated = createShotsFromEpisode(episode, useComicStore.getState().shots);
        setShots([...useComicStore.getState().shots.filter((shot) => shot.episodeId !== episode.id), ...generated]);
        if (generated[0]) selectShot(generated[0].id);
        message.success(`已从剧本拆分 ${generated.length} 个镜头`);
    };

    const addToolNode = (type: ComicCanvasNode["type"]) => {
        checkpoint();
        const center = screenCenterWorld(canvasRef.current, viewport);
        const sizes = type === "text" ? { width: 280, height: 190 } : type === "audio" ? { width: 300, height: 130 } : { width: 320, height: 260 };
        addCanvasNode({ episodeId: episode.id, type, title: typeLabel(type), content: type === "text" ? "输入提示词或文字内容" : "", prompt: "", position: center, ...sizes, status: "idle" });
    };

    const uploadImages = async (files?: FileList | null) => {
        const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
        if (!imageFiles.length) return;
        checkpoint();
        const center = screenCenterWorld(canvasRef.current, viewport);
        for (let index = 0; index < imageFiles.length; index += 1) {
            const stored = await uploadImage(imageFiles[index]);
            addCanvasNode({ episodeId: episode.id, type: "image", title: imageFiles[index].name, content: stored.url, storageKey: stored.storageKey, position: { x: center.x + index * 36, y: center.y + index * 36 }, width: 320, height: 260, status: "success" });
        }
        if (uploadRef.current) uploadRef.current.value = "";
        message.success(`已添加 ${imageFiles.length} 张图片`);
    };

    const generateShotImage = async (shot: ComicShot, overridePrompt?: string) => {
        const prompt = (overridePrompt || buildShotPrompt(shot)).trim();
        if (!prompt) return message.warning("请先填写镜头画面或提示词");
        const model = effectiveConfig.imageModel || effectiveConfig.model;
        if (!isAiConfigReady(effectiveConfig, model)) { openConfigDialog(true, "models"); return; }
        updateShot(shot.id, { status: "loading", error: undefined });
        try {
            const config = { ...effectiveConfig, model, imageModel: model, count: "1", size: useComicStore.getState().ratio };
            const references: ReferenceImage[] = shot.referenceImageUrl ? [{ id: `${shot.id}-ref`, name: "reference.png", type: "image/png", dataUrl: shot.referenceImageUrl, storageKey: shot.referenceStorageKey }] : [];
            const result = references.length ? await requestEdit(config, prompt, references).then((items) => items[0]) : await requestGeneration(config, prompt).then((items) => items[0]);
            const stored = await uploadImage(result.dataUrl);
            const previousHistory = shot.imageUrl ? [...shot.imageHistory, { id: nanoid(), imageUrl: shot.imageUrl, storageKey: shot.storageKey, prompt: shot.prompt || prompt, createdAt: Date.now() }] : shot.imageHistory;
            updateShot(shot.id, { imageUrl: stored.url, storageKey: stored.storageKey, prompt, status: "success", imageHistory: previousHistory.slice(-12) });
            message.success(`${shot.title} 已生成`);
        } catch (error) {
            updateShot(shot.id, { status: "error", error: error instanceof Error ? error.message : "生成失败" });
            message.error(error instanceof Error ? error.message : "生成失败");
        }
    };

    const generateNode = async (node: ComicCanvasNode) => {
        const prompt = (node.prompt || node.content).trim();
        if (!prompt) return message.warning("节点内容为空");
        updateCanvasNode(node.id, { status: "loading", error: undefined });
        try {
            if (node.type === "text") {
                const targetId = addCanvasNode({ episodeId: episode.id, type: "image", title: "AI 图片", content: "", prompt, position: { x: node.position.x + node.width + 90, y: node.position.y }, width: 320, height: 260, status: "loading" });
                addCanvasConnection(episode.id, node.id, targetId);
                const image = await requestGeneration({ ...effectiveConfig, count: "1" }, prompt).then((items) => items[0]);
                const stored = await uploadImage(image.dataUrl);
                updateCanvasNode(targetId, { content: stored.url, storageKey: stored.storageKey, status: "success" });
                updateCanvasNode(node.id, { status: "success" });
            } else if (node.type === "image") {
                const result = node.content ? await requestEdit(effectiveConfig, prompt, [{ id: node.id, name: `${node.title}.png`, type: "image/png", dataUrl: node.content, storageKey: node.storageKey }]).then((items) => items[0]) : await requestGeneration(effectiveConfig, prompt).then((items) => items[0]);
                const stored = await uploadImage(result.dataUrl);
                updateCanvasNode(node.id, { content: stored.url, storageKey: stored.storageKey, status: "success" });
            } else if (node.type === "video") {
                const stored = await storeGeneratedVideo(await requestVideoGeneration(effectiveConfig, prompt));
                updateCanvasNode(node.id, { content: stored.url, storageKey: stored.storageKey, status: "success" });
            } else if (node.type === "audio") {
                const stored = await storeGeneratedAudio(await requestAudioGeneration(effectiveConfig, prompt), effectiveConfig.audioFormat);
                updateCanvasNode(node.id, { content: stored.url, storageKey: stored.storageKey, status: "success" });
            }
        } catch (error) {
            updateCanvasNode(node.id, { status: "error", error: error instanceof Error ? error.message : "生成失败" });
            message.error(error instanceof Error ? error.message : "生成失败");
        }
    };

    const saveShotAsset = async (shot: ComicShot) => {
        if (!shot.imageUrl) return;
        const stored = shot.storageKey ? { url: shot.imageUrl, storageKey: shot.storageKey } : await uploadImage(shot.imageUrl);
        const meta = await uploadImage(stored.url);
        addAsset({ kind: "image", title: `${episode.title}-${shot.title}`, coverUrl: meta.url, tags: ["漫剧", "分镜"], source: "漫剧工作台", data: { dataUrl: meta.url, storageKey: meta.storageKey, width: meta.width, height: meta.height, bytes: meta.bytes, mimeType: meta.mimeType }, metadata: { episodeId: episode.id, shotId: shot.id, prompt: shot.prompt } });
        message.success("已加入我的素材");
    };

    const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if ((event.target as HTMLElement).closest("[data-comic-node]")) return;
        const start = { x: event.clientX, y: event.clientY, viewport };
        event.currentTarget.setPointerCapture(event.pointerId);
        const move = (moveEvent: PointerEvent) => setViewport({ ...viewport, x: start.viewport.x + moveEvent.clientX - start.x, y: start.viewport.y + moveEvent.clientY - start.y });
        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    };

    const moveItem = (id: string, kind: "shot" | "node", event: ReactPointerEvent) => {
        if ((event.target as HTMLElement).closest("button,input,textarea,select")) return;
        event.stopPropagation();
        const item = kind === "shot" ? shots.find((shot) => shot.id === id) : canvasNodes.find((node) => node.id === id);
        if (!item) return;
        checkpoint();
        const start = { x: event.clientX, y: event.clientY, position: item.position };
        const move = (moveEvent: PointerEvent) => {
            const position = { x: start.position.x + (moveEvent.clientX - start.x) / viewport.k, y: start.position.y + (moveEvent.clientY - start.y) / viewport.k };
            kind === "shot" ? updateShot(id, { position }) : updateCanvasNode(id, { position });
        };
        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    };

    const connectItem = (id: string) => {
        if (!connectingFrom) { setConnectingFrom(id); message.info("请选择要连接的目标节点"); return; }
        if (connectingFrom !== id) addCanvasConnection(episode.id, connectingFrom, id);
        setConnectingFrom("");
    };

    const confirmCrop = async (shot: ComicShot, crop: CanvasImageCropRect) => {
        const stored = await uploadImage(await cropDataUrl(shot.imageUrl, crop));
        checkpoint(); updateShot(shot.id, { imageUrl: stored.url, storageKey: stored.storageKey }); setDialog(null); message.success("裁剪完成");
    };

    const confirmMask = async (shot: ComicShot, payload: CanvasImageMaskEditPayload) => {
        updateShot(shot.id, { status: "loading" }); setDialog(null);
        try {
            const result = await requestEdit(effectiveConfig, payload.prompt, [{ id: shot.id, name: "shot.png", type: "image/png", dataUrl: shot.imageUrl, storageKey: shot.storageKey }], { id: `${shot.id}-mask`, name: "mask.png", type: "image/png", dataUrl: payload.maskDataUrl }).then((items) => items[0]);
            const stored = await uploadImage(result.dataUrl); updateShot(shot.id, { imageUrl: stored.url, storageKey: stored.storageKey, prompt: payload.prompt, status: "success" });
        } catch (error) { updateShot(shot.id, { status: "error", error: error instanceof Error ? error.message : "局部编辑失败" }); }
    };

    const confirmSplit = async (shot: ComicShot, params: CanvasImageSplitParams) => {
        const pieces = await splitDataUrl(shot.imageUrl, params); checkpoint();
        for (const piece of pieces) {
            const stored = await uploadImage(piece.dataUrl);
            addCanvasNode({ episodeId: episode.id, type: "image", title: `${shot.title}-${piece.row + 1}-${piece.column + 1}`, content: stored.url, storageKey: stored.storageKey, position: { x: shot.position.x + 350 + piece.column * 245, y: shot.position.y + piece.row * 215 }, width: 220, height: 180, status: "success" });
        }
        setDialog(null); message.success(`已切分为 ${pieces.length} 个图片节点`);
    };

    return (
        <div className="comic-storyboard-shell">
            <aside className="comic-storyboard-tools">
                <ToolButton icon={MousePointer2} label="选择" active />
                <ToolButton icon={Plus} label="镜头" onClick={() => { checkpoint(); addShot(episode.id); }} />
                <ToolButton icon={Type} label="文本" onClick={() => addToolNode("text")} />
                <ToolButton icon={ImageIcon} label="图片" onClick={() => addToolNode("image")} />
                <ToolButton icon={Video} label="视频" onClick={() => addToolNode("video")} />
                <ToolButton icon={Mic2} label="音频" onClick={() => addToolNode("audio")} />
                <ToolButton icon={Upload} label="上传" onClick={() => uploadRef.current?.click()} />
                <div className="comic-tool-divider" />
                <ToolButton icon={WandSparkles} label="拆分剧本" onClick={generateShots} />
                <input ref={uploadRef} hidden multiple type="file" accept="image/*" onChange={(event) => void uploadImages(event.target.files)} />
            </aside>

            <div className="comic-storyboard-canvas-wrap">
                <div className="comic-storyboard-toolbar">
                    <button type="button" onClick={undo}><Undo2 className="size-4" /> 撤销</button>
                    <button type="button" onClick={redo}><Redo2 className="size-4" /> 重做</button>
                    <span />
                    <button type="button" onClick={generateShots}><Sparkles className="size-4" /> 从剧本生成分镜</button>
                    <small>{shots.length} 个镜头 · {canvasNodes.length} 个素材节点</small>
                </div>
                <div
                    ref={canvasRef}
                    className="comic-storyboard-canvas"
                    onPointerDown={handleCanvasPointerDown}
                    onWheel={(event) => {
                        event.preventDefault();
                        const next = clamp(viewport.k * Math.pow(1.1, -event.deltaY / 100), 0.15, 2.5);
                        setViewport({ ...viewport, k: next });
                    }}
                >
                    <svg className="comic-canvas-connections" width="3200" height="2400" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.k})` }}>
                        {shots.slice(1).map((shot, index) => <ConnectionLine key={`shot-edge-${shot.id}`} from={shotCanvasItem(shots[index])} to={shotCanvasItem(shot)} />)}
                        {connections.map((connection) => {
                            const from = allCanvasItems.find((item) => item.id === connection.fromId);
                            const to = allCanvasItems.find((item) => item.id === connection.toId);
                            return from && to ? <ConnectionLine key={connection.id} from={from} to={to} accent /> : null;
                        })}
                    </svg>
                    <div className="comic-canvas-world" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.k})` }}>
                        {shots.map((shot) => (
                            <ShotNode
                                key={shot.id}
                                shot={shot}
                                selected={selectedShot?.id === shot.id}
                                connecting={connectingFrom === shot.id}
                                onSelect={() => selectShot(shot.id)}
                                onMove={(event) => moveItem(shot.id, "shot", event)}
                                onConnect={() => connectItem(shot.id)}
                                onGenerate={() => void generateShotImage(shot)}
                                onPreview={() => setPreview({ url: shot.imageUrl, title: shot.title, downloadName: `${safeName(episode.title)}-${safeName(shot.title)}.png` })}
                            />
                        ))}
                        {canvasNodes.map((node) => (
                            <GenericNode key={node.id} node={node} selected={selectedNode?.id === node.id} connecting={connectingFrom === node.id} onSelect={() => selectCanvasNode(node.id)} onMove={(event) => moveItem(node.id, "node", event)} onConnect={() => connectItem(node.id)} onGenerate={() => void generateNode(node)} onDelete={() => { checkpoint(); removeCanvasNode(node.id); }} />
                        ))}
                    </div>
                    <div className="comic-canvas-zoom">
                        <button type="button" onClick={() => setMiniMapOpen((value) => !value)} className={miniMapOpen ? "is-active" : ""}><PanelTop className="size-4" /></button>
                        <button type="button" onClick={() => setViewport({ x: 48, y: 48, k: 0.82 })}><Focus className="size-4" /></button>
                        <button type="button" onClick={() => setViewport({ ...viewport, k: clamp(viewport.k - 0.1, 0.15, 2.5) })}><ZoomOut className="size-4" /></button>
                        <b>{Math.round(viewport.k * 100)}%</b>
                        <button type="button" onClick={() => setViewport({ ...viewport, k: clamp(viewport.k + 0.1, 0.15, 2.5) })}><ZoomIn className="size-4" /></button>
                    </div>
                    {miniMapOpen ? <ComicMiniMap items={allCanvasItems} viewport={viewport} onChange={setViewport} /> : null}
                </div>
            </div>

            <aside className="comic-storyboard-inspector">
                {selectedShot ? (
                    <ShotInspector
                        shot={selectedShot}
                        presets={promptPresets}
                        onUpdate={(patch) => updateShot(selectedShot.id, patch)}
                        onGenerate={() => void generateShotImage(selectedShot)}
                        onDuplicate={() => { checkpoint(); duplicateShot(selectedShot.id); }}
                        onDelete={() => { checkpoint(); removeShot(selectedShot.id); }}
                        onPreview={() => setPreview({ url: selectedShot.imageUrl, title: selectedShot.title, downloadName: `${safeName(episode.title)}-${safeName(selectedShot.title)}.png` })}
                        onDownload={() => selectedShot.imageUrl && saveAs(selectedShot.imageUrl, `${safeName(episode.title)}-${safeName(selectedShot.title)}.png`)}
                        onAsset={() => void saveShotAsset(selectedShot)}
                        onCrop={() => setDialog({ type: "crop", shot: selectedShot })}
                        onMask={() => setDialog({ type: "mask", shot: selectedShot })}
                        onSplit={() => setDialog({ type: "split", shot: selectedShot })}
                    />
                ) : selectedNode ? <NodeInspector node={selectedNode} onUpdate={(patch) => updateCanvasNode(selectedNode.id, patch)} onGenerate={() => void generateNode(selectedNode)} /> : <InspectorEmpty />}
            </aside>

            <Modal open={Boolean(preview)} title={preview?.title} onCancel={() => setPreview(null)} width={1000} centered footer={preview ? <button className="comic-modal-download" type="button" onClick={() => saveAs(preview.url, preview.downloadName)}><Download className="size-4" /> 下载图片</button> : null}>
                {preview ? <Image src={preview.url} preview={false} className="comic-preview-image" /> : null}
            </Modal>
            <CanvasNodeCropDialog dataUrl={dialog?.shot.imageUrl || ""} open={dialog?.type === "crop"} onClose={() => setDialog(null)} onConfirm={(crop) => dialog?.shot && void confirmCrop(dialog.shot, crop)} />
            <CanvasNodeMaskEditDialog dataUrl={dialog?.shot.imageUrl || ""} open={dialog?.type === "mask"} onClose={() => setDialog(null)} onConfirm={(payload) => dialog?.shot && void confirmMask(dialog.shot, payload)} />
            <CanvasNodeSplitDialog dataUrl={dialog?.shot.imageUrl || ""} open={dialog?.type === "split"} onClose={() => setDialog(null)} onConfirm={(params) => dialog?.shot && void confirmSplit(dialog.shot, params)} />
        </div>
    );
}

function PanoramaWorkspace({ episode }: { episode: ComicEpisode }) {
    const { message } = App.useApp();
    const effectiveConfig = useEffectiveConfig();
    const allPanoramas = useComicStore((state) => state.panoramas);
    const upsertPanorama = useComicStore((state) => state.upsertPanorama);
    const updatePanorama = useComicStore((state) => state.updatePanorama);
    const upsertDirectorScene = useComicStore((state) => state.upsertDirectorScene);
    const setActiveStage = useComicStore((state) => state.setActiveStage);
    const directorScenes = useComicStore((state) => state.directorScenes);
    const [prompt, setPrompt] = useState(episode.summary);
    const [source, setSource] = useState<{ url: string; storageKey?: string } | null>(null);
    const panoramas = useMemo(
        () => allPanoramas.filter((item) => item.episodeId === episode.id),
        [allPanoramas, episode.id],
    );
    const [activeId, setActiveId] = useState(panoramas[0]?.id || "");
    const uploadRef = useRef<HTMLInputElement>(null);
    const active = panoramas.find((item) => item.id === activeId) || panoramas[0];

    useEffect(() => { if (active?.storageKey) void resolveImageUrl(active.storageKey, active.imageUrl).then((url) => url !== active.imageUrl && updatePanorama(active.id, { imageUrl: url })); }, [active, updatePanorama]);

    const uploadSource = async (files?: FileList | null) => {
        const file = files?.[0]; if (!file) return;
        const stored = await uploadImage(file); setSource({ url: stored.url, storageKey: stored.storageKey });
    };

    const generate = async () => {
        if (!prompt.trim()) return message.warning("请输入全景描述");
        const id = nanoid();
        const panorama: ComicPanorama = { id, episodeId: episode.id, prompt: prompt.trim(), imageUrl: "", sourceImageUrl: source?.url, sourceStorageKey: source?.storageKey, projection: "spherical", yaw: 0, pitch: 0, fov: 76, status: "loading" };
        upsertPanorama(panorama); setActiveId(id);
        try {
            const fullPrompt = `360 degree equirectangular panorama, seamless left and right edges, immersive environment, ${prompt.trim()}, no text, no watermark`;
            const result = source ? await requestEdit({ ...effectiveConfig, size: "2:1", count: "1" }, fullPrompt, [{ id: `${id}-source`, name: "source.png", type: "image/png", dataUrl: source.url, storageKey: source.storageKey }]).then((items) => items[0]) : await requestGeneration({ ...effectiveConfig, size: "2:1", count: "1" }, fullPrompt).then((items) => items[0]);
            const stored = await uploadImage(result.dataUrl); updatePanorama(id, { imageUrl: stored.url, storageKey: stored.storageKey, status: "success" }); message.success("全景图已生成");
        } catch (error) { updatePanorama(id, { status: "error", error: error instanceof Error ? error.message : "生成失败" }); message.error(error instanceof Error ? error.message : "生成失败"); }
    };

    const importDirector = () => {
        if (!active?.imageUrl) return;
        const current = directorScenes.find((scene) => scene.episodeId === episode.id) || defaultDirectorScene(episode.id);
        upsertDirectorScene({ ...current, mode: "panorama", backgroundPanoramaUrl: active.imageUrl, backgroundStorageKey: active.storageKey } as ComicDirectorScene & { backgroundPanoramaUrl?: string });
        setActiveStage("director"); message.success("已导入导演台全景背景");
    };

    return (
        <div className="comic-panorama-workspace">
            <aside className="comic-panorama-panel">
                <div><strong>全景生成</strong><small>创建可拖动查看的 360° 环境</small></div>
                <textarea rows={6} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="描述空间、时间、天气、光线和氛围…" />
                <button type="button" className="comic-panorama-source" onClick={() => uploadRef.current?.click()}>
                    {source ? <img src={source.url} alt="参考图" /> : <><Upload className="size-5" /><span>添加参考图（可选）</span></>}
                </button>
                <input ref={uploadRef} hidden type="file" accept="image/*" onChange={(event) => void uploadSource(event.target.files)} />
                <button type="button" className="comic-primary-action" onClick={() => void generate()}><WandSparkles className="size-4" /> 生成全景</button>
                <div className="comic-panorama-history">
                    <strong>全景记录</strong>
                    {panoramas.map((item) => <button type="button" key={item.id} className={active?.id === item.id ? "is-active" : ""} onClick={() => setActiveId(item.id)}>{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <LoaderCircle className="size-4 animate-spin" />}<span>{item.prompt}</span></button>)}
                </div>
            </aside>
            <section className="comic-panorama-viewer">
                {active?.imageUrl ? (
                    <>
                        <div className="comic-panorama-sphere" style={{ backgroundImage: `url(${active.imageUrl})`, backgroundPosition: `${50 + active.yaw / 3.6}% ${50 - active.pitch / 1.8}%`, backgroundSize: `${Math.max(100, 230 - active.fov)}% auto` }} onPointerDown={(event) => panoramaDrag(event, active, updatePanorama)}>
                            <div className="comic-panorama-reticle"><Plus className="size-5" /></div>
                            <span>拖动画面环视 · 滚轮控制视野</span>
                        </div>
                        <div className="comic-panorama-controls">
                            <button type="button" onClick={() => updatePanorama(active.id, { yaw: 0, pitch: 0, fov: 76 })}><Focus className="size-4" /> 重置视角</button>
                            <button type="button" onClick={() => saveAs(active.imageUrl, `${safeName(episode.title)}-全景.png`)}><Download className="size-4" /> 下载</button>
                            <button type="button" onClick={importDirector}><Move3D className="size-4" /> 导入导演台</button>
                        </div>
                    </>
                ) : active?.status === "loading" ? <div className="comic-panorama-loading"><LoaderCircle className="size-8 animate-spin" /><span>正在生成全景环境…</span></div> : <div className="comic-visual-empty"><Aperture className="size-10" /><span>生成或上传一张全景图开始空间预演</span></div>}
            </section>
        </div>
    );
}

function DirectorWorkspace({ episode }: { episode: ComicEpisode }) {
    const { message } = App.useApp();
    const scenes = useComicStore((state) => state.directorScenes);
    const upsertScene = useComicStore((state) => state.upsertDirectorScene);
    const addItem = useComicStore((state) => state.addDirectorItem);
    const updateItem = useComicStore((state) => state.updateDirectorItem);
    const removeItem = useComicStore((state) => state.removeDirectorItem);
    const updateShot = useComicStore((state) => state.updateShot);
    const addShot = useComicStore((state) => state.addShot);
    const [selectedItemId, setSelectedItemId] = useState("");
    const fallbackScene = useMemo(() => defaultDirectorScene(episode.id), [episode.id]);
    const scene = scenes.find((item) => item.episodeId === episode.id) || fallbackScene;
    const selectedItem = scene.items.find((item) => item.id === selectedItemId);
    const stageRef = useRef<HTMLDivElement>(null);

    useEffect(() => { if (!scenes.some((item) => item.episodeId === episode.id)) upsertScene(scene); }, [episode.id, scene, scenes, upsertScene]);
    useEffect(() => { if (scene.backgroundStorageKey && scene.backgroundImageUrl) void resolveImageUrl(scene.backgroundStorageKey, scene.backgroundImageUrl).then((url) => url !== scene.backgroundImageUrl && upsertScene({ ...scene, backgroundImageUrl: url })); }, [scene, upsertScene]);

    const patchScene = (patch: Partial<ComicDirectorScene>) => upsertScene({ ...scene, ...patch, camera: { ...scene.camera, ...patch.camera }, lighting: { ...scene.lighting, ...patch.lighting } });
    const addDirectorItem = (type: ComicDirectorItem["type"]) => { const id = addItem(episode.id, type); setSelectedItemId(id); };

    const moveDirectorItem = (item: ComicDirectorItem, event: ReactPointerEvent) => {
        event.stopPropagation(); const box = stageRef.current?.getBoundingClientRect(); if (!box) return;
        const move = (moveEvent: PointerEvent) => updateItem(episode.id, item.id, { x: clamp(((moveEvent.clientX - box.left) / box.width) * 100, 2, 98), y: clamp(((moveEvent.clientY - box.top) / box.height) * 100, 4, 96) });
        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
        window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    };

    const createSnapshot = async () => {
        const svg = directorSnapshotSvg(scene, stageRef.current?.clientWidth || 1280, stageRef.current?.clientHeight || 720);
        const stored = await uploadImage(new Blob([svg], { type: "image/svg+xml" }));
        const history = [...scene.snapshotHistory, { id: nanoid(), imageUrl: stored.url, storageKey: stored.storageKey, prompt: directorPrompt(scene), createdAt: Date.now() }].slice(-12);
        patchScene({ snapshotUrl: stored.url, snapshotStorageKey: stored.storageKey, snapshotHistory: history });
        message.success("导演台构图快照已保存");
    };

    const sendToShot = async () => {
        if (!scene.snapshotUrl) await createSnapshot();
        const latest = useComicStore.getState().directorScenes.find((item) => item.episodeId === episode.id) || scene;
        const id = addShot(episode.id);
        updateShot(id, { title: "导演台构图", description: directorPrompt(latest), prompt: directorPrompt(latest), referenceImageUrl: latest.snapshotUrl, referenceStorageKey: latest.snapshotStorageKey });
        useComicStore.getState().setActiveStage("storyboard"); message.success("已创建分镜镜头并附加导演台构图参考");
    };

    return (
        <div className="comic-director-workspace">
            <aside className="comic-director-library">
                <div><strong>场景元素</strong><small>点击添加到舞台，可直接拖动摆位</small></div>
                <button type="button" onClick={() => addDirectorItem("person")}><CircleUserRound className="size-5" /><span>人物</span></button>
                <button type="button" onClick={() => addDirectorItem("object")}><Box className="size-5" /><span>道具</span></button>
                <button type="button" onClick={() => addDirectorItem("scene")}><Images className="size-5" /><span>场景元素</span></button>
                <div className="comic-tool-divider" />
                <button type="button" className={scene.gridVisible ? "is-active" : ""} onClick={() => patchScene({ gridVisible: !scene.gridVisible })}><Grid2X2 className="size-5" /><span>地面网格</span></button>
                <button type="button" className={scene.lighting.enabled ? "is-active" : ""} onClick={() => patchScene({ lighting: { ...scene.lighting, enabled: !scene.lighting.enabled } })}><Sun className="size-5" /><span>主灯光</span></button>
            </aside>
            <section className="comic-director-stage-shell">
                <div className="comic-director-topbar">
                    <div><Camera className="size-4" /><b>{scene.camera.frame}</b><span>{scene.camera.fov}mm 视野</span></div>
                    <button type="button" onClick={() => void createSnapshot()}><Camera className="size-4" /> 保存快照</button>
                    <button type="button" className="is-primary" onClick={() => void sendToShot()}><Sparkles className="size-4" /> 作为分镜参考</button>
                </div>
                <div
                    ref={stageRef}
                    className={`comic-director-stage ${scene.gridVisible ? "has-grid" : ""}`}
                    style={{
                        backgroundImage: scene.backgroundImageUrl ? `linear-gradient(rgba(10,18,25,.18),rgba(10,18,25,.3)),url(${scene.backgroundImageUrl})` : undefined,
                        perspective: `${900 / scene.camera.zoom}px`,
                        filter: scene.lighting.enabled ? `brightness(${0.72 + scene.lighting.ambient + scene.lighting.intensity * 0.22})` : "brightness(.82)",
                    }}
                    onPointerDown={() => setSelectedItemId("")}
                >
                    <div className="comic-director-horizon" />
                    {scene.items.map((item) => <DirectorItem key={item.id} item={item} selected={item.id === selectedItemId} onSelect={() => setSelectedItemId(item.id)} onMove={(event) => moveDirectorItem(item, event)} />)}
                    <div className="comic-director-frame" data-frame={scene.camera.frame} />
                    {scene.lighting.enabled ? <div className="comic-director-light" style={{ left: `${50 + scene.lighting.yaw / 3.6}%`, background: scene.lighting.color, opacity: clamp(scene.lighting.intensity / 2, 0.2, 0.8) }} /> : null}
                </div>
            </section>
            <aside className="comic-director-inspector">
                <h3>{selectedItem ? "元素属性" : "相机与灯光"}</h3>
                {selectedItem ? (
                    <>
                        <InspectorField label="名称"><input value={selectedItem.label} onChange={(event) => updateItem(episode.id, selectedItem.id, { label: event.target.value })} /></InspectorField>
                        <InspectorField label="动作 / 关系"><textarea rows={3} value={selectedItem.action} onChange={(event) => updateItem(episode.id, selectedItem.id, { action: event.target.value })} /></InspectorField>
                        <RangeField label="旋转" value={selectedItem.rotation} min={-180} max={180} onChange={(value) => updateItem(episode.id, selectedItem.id, { rotation: value })} suffix="°" />
                        <RangeField label="缩放" value={selectedItem.scale} min={0.4} max={2.4} step={0.1} onChange={(value) => updateItem(episode.id, selectedItem.id, { scale: value })} suffix="x" />
                        <RangeField label="空间高度" value={selectedItem.z} min={-5} max={12} step={0.5} onChange={(value) => updateItem(episode.id, selectedItem.id, { z: value })} />
                        <button type="button" className="comic-danger-action" onClick={() => { removeItem(episode.id, selectedItem.id); setSelectedItemId(""); }}><Trash2 className="size-4" /> 删除元素</button>
                    </>
                ) : (
                    <>
                        <InspectorField label="画幅"><select value={scene.camera.frame} onChange={(event) => patchScene({ camera: { ...scene.camera, frame: event.target.value } })}>{frameOptions.map((item) => <option key={item}>{item}</option>)}</select></InspectorField>
                        <RangeField label="相机视野" value={scene.camera.fov} min={16} max={120} onChange={(value) => patchScene({ camera: { ...scene.camera, fov: value } })} suffix="mm" />
                        <RangeField label="视图缩放" value={scene.camera.zoom} min={0.5} max={2} step={0.1} onChange={(value) => patchScene({ camera: { ...scene.camera, zoom: value } })} suffix="x" />
                        <RangeField label="主灯强度" value={scene.lighting.intensity} min={0} max={2} step={0.05} onChange={(value) => patchScene({ lighting: { ...scene.lighting, intensity: value } })} />
                        <RangeField label="环境光" value={scene.lighting.ambient} min={0} max={1} step={0.05} onChange={(value) => patchScene({ lighting: { ...scene.lighting, ambient: value } })} />
                        <InspectorField label="基础提示词"><textarea rows={4} value={scene.basePrompt} onChange={(event) => patchScene({ basePrompt: event.target.value })} placeholder="补充场景气氛、风格与材质…" /></InspectorField>
                        <div className="comic-director-prompt"><Lightbulb className="size-4" /><span>{directorPrompt(scene)}</span></div>
                    </>
                )}
            </aside>
        </div>
    );
}

function ShotNode({ shot, selected, connecting, onSelect, onMove, onConnect, onGenerate, onPreview }: { shot: ComicShot; selected: boolean; connecting: boolean; onSelect: () => void; onMove: (event: ReactPointerEvent) => void; onConnect: () => void; onGenerate: () => void; onPreview: () => void }) {
    return (
        <article data-comic-node className={`comic-shot-node ${selected ? "is-selected" : ""} ${connecting ? "is-connecting" : ""}`} style={{ left: shot.position.x, top: shot.position.y }} onPointerDown={onMove} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
            <header><span>{String(shot.order).padStart(2, "0")}</span><strong>{shot.title}</strong><button type="button" title="连接节点" onClick={(event) => { event.stopPropagation(); onConnect(); }}><SplitSquareVertical className="size-4" /></button></header>
            <div className="comic-shot-image" onDoubleClick={shot.imageUrl ? onPreview : undefined}>
                {shot.status === "loading" ? <div><LoaderCircle className="size-6 animate-spin" /><span>生成中</span></div> : shot.imageUrl ? <img src={shot.imageUrl} alt={shot.title} /> : <div><ImageIcon className="size-7" /><span>暂无画面</span></div>}
                {shot.error ? <small>{shot.error}</small> : null}
            </div>
            <p>{shot.description}</p>
            <footer><span>{shot.camera.shotSize} · {shot.camera.angle}</span><button type="button" onClick={(event) => { event.stopPropagation(); onGenerate(); }}><Sparkles className="size-4" /> 生成</button></footer>
        </article>
    );
}

function GenericNode({ node, selected, connecting, onSelect, onMove, onConnect, onGenerate, onDelete }: { node: ComicCanvasNode; selected: boolean; connecting: boolean; onSelect: () => void; onMove: (event: ReactPointerEvent) => void; onConnect: () => void; onGenerate: () => void; onDelete: () => void }) {
    const Icon = node.type === "text" ? Type : node.type === "image" ? ImageIcon : node.type === "video" ? Video : node.type === "audio" ? Mic2 : Box;
    return (
        <article data-comic-node className={`comic-generic-node is-${node.type} ${selected ? "is-selected" : ""} ${connecting ? "is-connecting" : ""}`} style={{ left: node.position.x, top: node.position.y, width: node.width, minHeight: node.height }} onPointerDown={onMove} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
            <header><Icon className="size-4" /><strong>{node.title}</strong><button type="button" onClick={(event) => { event.stopPropagation(); onConnect(); }}><SplitSquareVertical className="size-4" /></button><button type="button" onClick={(event) => { event.stopPropagation(); onDelete(); }}><X className="size-4" /></button></header>
            {node.type === "text" ? <textarea value={node.content} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => useComicStore.getState().updateCanvasNode(node.id, { content: event.target.value })} /> : node.type === "image" && node.content ? <img src={node.content} alt="" /> : node.type === "video" && node.content ? <video src={node.content} controls onPointerDown={(event) => event.stopPropagation()} /> : node.type === "audio" && node.content ? <audio src={node.content} controls onPointerDown={(event) => event.stopPropagation()} /> : <div className="comic-node-placeholder">{node.status === "loading" ? <LoaderCircle className="size-6 animate-spin" /> : <Icon className="size-7" />}<span>{node.error || "输入提示词后生成"}</span></div>}
            <button type="button" className="comic-node-generate" onClick={(event) => { event.stopPropagation(); onGenerate(); }}>{node.status === "loading" ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} 运行节点</button>
        </article>
    );
}

function ShotInspector({ shot, presets, onUpdate, onGenerate, onDuplicate, onDelete, onPreview, onDownload, onAsset, onCrop, onMask, onSplit }: { shot: ComicShot; presets: ReturnType<typeof useComicStore.getState>["promptPresets"]; onUpdate: (patch: Partial<ComicShot>) => void; onGenerate: () => void; onDuplicate: () => void; onDelete: () => void; onPreview: () => void; onDownload: () => void; onAsset: () => void; onCrop: () => void; onMask: () => void; onSplit: () => void }) {
    return <div className="comic-shot-inspector-content">
        <header><div><span>镜头 {String(shot.order).padStart(2, "0")}</span><strong>{shot.title}</strong></div><button type="button" onClick={onDuplicate}><Copy className="size-4" /></button><button type="button" onClick={onDelete}><Trash2 className="size-4" /></button></header>
        <InspectorField label="镜头名称"><input value={shot.title} onChange={(event) => onUpdate({ title: event.target.value })} /></InspectorField>
        <InspectorField label="画面描述"><textarea rows={4} value={shot.description} onChange={(event) => onUpdate({ description: event.target.value })} /></InspectorField>
        <InspectorField label="对白 / 旁白"><textarea rows={3} value={shot.dialogue} onChange={(event) => onUpdate({ dialogue: event.target.value })} /></InspectorField>
        <div className="comic-inspector-grid">
            <InspectorField label="景别"><select value={shot.camera.shotSize} onChange={(event) => onUpdate({ camera: { ...shot.camera, shotSize: event.target.value } })}>{shotSizes.map((item) => <option key={item}>{item}</option>)}</select></InspectorField>
            <InspectorField label="角度"><select value={shot.camera.angle} onChange={(event) => onUpdate({ camera: { ...shot.camera, angle: event.target.value } })}>{shotAngles.map((item) => <option key={item}>{item}</option>)}</select></InspectorField>
            <InspectorField label="运镜"><select value={shot.camera.movement} onChange={(event) => onUpdate({ camera: { ...shot.camera, movement: event.target.value } })}>{shotMovements.map((item) => <option key={item}>{item}</option>)}</select></InspectorField>
            <InspectorField label="时长"><input type="number" min={1} max={30} value={shot.duration} onChange={(event) => onUpdate({ duration: Number(event.target.value) || 1 })} /></InspectorField>
        </div>
        <details className="comic-camera-details"><summary><Camera className="size-4" /> 摄像机控制</summary><RangeField label="焦距" value={shot.camera.focalLength} min={16} max={200} onChange={(value) => onUpdate({ camera: { ...shot.camera, focalLength: value } })} suffix="mm" /><RangeField label="光圈" value={shot.camera.aperture} min={1.2} max={16} step={0.1} onChange={(value) => onUpdate({ camera: { ...shot.camera, aperture: value } })} suffix="f" /></details>
        <InspectorField label="生图提示词"><textarea rows={5} value={shot.prompt} placeholder="默认会使用画面描述、镜头和项目风格" onChange={(event) => onUpdate({ prompt: event.target.value })} /></InspectorField>
        <div className="comic-preset-list">{presets.map((preset) => <button type="button" key={preset.id} onClick={() => onUpdate({ prompt: `${shot.prompt ? `${shot.prompt}, ` : ""}${preset.prompt}` })}>{preset.name}</button>)}</div>
        <InspectorField label="负面提示词"><textarea rows={2} value={shot.negativePrompt} onChange={(event) => onUpdate({ negativePrompt: event.target.value })} /></InspectorField>
        <button type="button" className="comic-primary-action" disabled={shot.status === "loading"} onClick={onGenerate}>{shot.status === "loading" ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} 生成分镜画面</button>
        {shot.imageUrl ? <><div className="comic-image-tools"><button type="button" onClick={onPreview}><Maximize2 className="size-4" />预览</button><button type="button" onClick={onDownload}><Download className="size-4" />下载</button><button type="button" onClick={onAsset}><PackagePlus className="size-4" />素材库</button><button type="button" onClick={onCrop}><Focus className="size-4" />裁剪</button><button type="button" onClick={onMask}><WandSparkles className="size-4" />局部编辑</button><button type="button" onClick={onSplit}><Grid2X2 className="size-4" />切分</button></div>{shot.imageHistory.length ? <details className="comic-shot-history"><summary>图片版本（{shot.imageHistory.length}）</summary><div>{shot.imageHistory.map((item) => <button type="button" key={item.id} onClick={() => onUpdate({ imageUrl: item.imageUrl, storageKey: item.storageKey, prompt: item.prompt })}><img src={item.imageUrl} alt="历史版本" /></button>)}</div></details> : null}</> : null}
    </div>;
}

function NodeInspector({ node, onUpdate, onGenerate }: { node: ComicCanvasNode; onUpdate: (patch: Partial<ComicCanvasNode>) => void; onGenerate: () => void }) {
    return <div className="comic-shot-inspector-content"><header><div><span>素材节点</span><strong>{node.title}</strong></div></header><InspectorField label="节点名称"><input value={node.title} onChange={(event) => onUpdate({ title: event.target.value })} /></InspectorField><InspectorField label="生成指令"><textarea rows={7} value={node.prompt || ""} onChange={(event) => onUpdate({ prompt: event.target.value })} placeholder="输入图片、视频或音频生成指令…" /></InspectorField><button type="button" className="comic-primary-action" onClick={onGenerate}><Play className="size-4" /> 运行节点</button>{node.error ? <p className="comic-node-error">{node.error}</p> : null}</div>;
}

function InspectorEmpty() { return <div className="comic-inspector-empty"><MousePointer2 className="size-8" /><strong>选择一个镜头或节点</strong><span>这里会显示可编辑参数和实际工具</span></div>; }

function ToolButton({ icon: Icon, label, active, onClick }: { icon: typeof Plus; label: string; active?: boolean; onClick?: () => void }) { return <Tooltip placement="right" title={label}><button type="button" className={active ? "is-active" : ""} onClick={onClick}><Icon className="size-5" /><span>{label}</span></button></Tooltip>; }
function InspectorField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="comic-inspector-field"><span>{label}</span>{children}</label>; }
function RangeField({ label, value, min, max, step = 1, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void }) { return <label className="comic-range-field"><span>{label}<b>{Number.isInteger(value) ? value : value.toFixed(1)}{suffix}</b></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>; }

function ConnectionLine({ from, to, accent }: { from: CanvasItem; to: CanvasItem; accent?: boolean }) {
    const x1 = from.position.x + from.width; const y1 = from.position.y + from.height / 2; const x2 = to.position.x; const y2 = to.position.y + to.height / 2; const bend = Math.max(80, Math.abs(x2 - x1) * 0.42);
    return <path d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`} fill="none" stroke={accent ? "#27a6bb" : "#a7bdc8"} strokeWidth={accent ? 3 : 2} opacity={0.78} />;
}

type CanvasItem = { id: string; position: { x: number; y: number }; width: number; height: number };
function shotCanvasItem(shot: ComicShot): CanvasItem { return { id: shot.id, position: shot.position, width: 310, height: 340 }; }
function nodeCanvasItem(node: ComicCanvasNode): CanvasItem { return { id: node.id, position: node.position, width: node.width, height: node.height }; }

function ComicMiniMap({ items, viewport, onChange }: { items: CanvasItem[]; viewport: { x: number; y: number; k: number }; onChange: (viewport: { x: number; y: number; k: number }) => void }) {
    const bounds = canvasBounds(items); const scale = Math.min(190 / bounds.width, 120 / bounds.height);
    return <div className="comic-mini-map" onPointerDown={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const worldX = bounds.x + ((event.clientX - rect.left) / rect.width) * bounds.width; const worldY = bounds.y + ((event.clientY - rect.top) / rect.height) * bounds.height; onChange({ ...viewport, x: rect.width * 2 - worldX * viewport.k, y: rect.height * 2 - worldY * viewport.k }); }}>{items.map((item) => <i key={item.id} style={{ left: (item.position.x - bounds.x) * scale, top: (item.position.y - bounds.y) * scale, width: Math.max(5, item.width * scale), height: Math.max(4, item.height * scale) }} />)}</div>;
}

function DirectorItem({ item, selected, onSelect, onMove }: { item: ComicDirectorItem; selected: boolean; onSelect: () => void; onMove: (event: ReactPointerEvent) => void }) {
    const Icon = item.type === "person" ? CircleUserRound : item.type === "object" ? Box : Images;
    return <button type="button" className={`comic-director-item is-${item.type} ${selected ? "is-selected" : ""}`} style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%,-50%) translateY(${-item.z * 3}px) rotate(${item.rotation}deg) scale(${item.scale})`, color: item.color }} onPointerDown={onMove} onClick={(event) => { event.stopPropagation(); onSelect(); }}><Icon /><span>{item.label}</span>{item.action ? <small>{item.action}</small> : null}</button>;
}

function panoramaDrag(event: ReactPointerEvent<HTMLDivElement>, panorama: ComicPanorama, update: (id: string, patch: Partial<ComicPanorama>) => void) {
    const start = { x: event.clientX, y: event.clientY, yaw: panorama.yaw, pitch: panorama.pitch };
    const move = (moveEvent: PointerEvent) => update(panorama.id, { yaw: start.yaw - (moveEvent.clientX - start.x) * 0.25, pitch: clamp(start.pitch + (moveEvent.clientY - start.y) * 0.18, -80, 80) });
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
}

function buildShotPrompt(shot: ComicShot) { return [shot.prompt || shot.description, shot.dialogue && `dialogue context: ${shot.dialogue}`, `${shot.camera.shotSize}, ${shot.camera.angle}, ${shot.camera.movement}`, `${shot.camera.focalLength}mm lens, f/${shot.camera.aperture}`, "cinematic storyboard, coherent character design", shot.negativePrompt && `avoid: ${shot.negativePrompt}`].filter(Boolean).join(", "); }
function directorPrompt(scene: ComicDirectorScene) { return [scene.basePrompt, ...scene.items.map((item) => `${item.label}${item.action ? ` ${item.action}` : ""}, position ${Math.round(item.x)}%/${Math.round(item.y)}%`), `${scene.camera.frame} composition, ${scene.camera.fov}mm lens`, scene.lighting.enabled ? `main light intensity ${scene.lighting.intensity.toFixed(1)}, ambient ${scene.lighting.ambient.toFixed(1)}` : "natural ambient light"].filter(Boolean).join("; "); }

function defaultDirectorScene(episodeId: string): ComicDirectorScene { return { episodeId, mode: "flat", items: [], camera: { yaw: 0, pitch: 16, zoom: 1, fov: 50, frame: "16:9" }, lighting: { enabled: true, intensity: 1, yaw: -35, color: "#fff1d6", ambient: 0.45 }, gridVisible: true, basePrompt: "", snapshotHistory: [] }; }

function directorSnapshotSvg(scene: ComicDirectorScene, width: number, height: number) {
    const items = scene.items.map((item) => `<g transform="translate(${(item.x / 100) * width} ${(item.y / 100) * height - item.z * 3}) rotate(${item.rotation}) scale(${item.scale})"><circle r="28" fill="${item.color}" fill-opacity=".9"/><text y="52" text-anchor="middle" fill="white" font-size="15" font-family="sans-serif">${escapeXml(item.label)}</text></g>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="bg" x2="0" y2="1"><stop stop-color="#31414d"/><stop offset="1" stop-color="#101820"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/><path d="M0 ${height * .62}H${width}V${height}H0Z" fill="#17252d"/><g opacity=".25" stroke="#88a9b6">${Array.from({ length: 12 }, (_, i) => `<path d="M${(i / 11) * width} ${height}L${width / 2} ${height * .62}"/>`).join("")}</g>${items}<rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="white" stroke-opacity=".5" stroke-width="2"/><text x="36" y="52" fill="white" font-size="18" font-family="sans-serif">AikArt Director · ${escapeXml(scene.camera.frame)}</text></svg>`;
}

async function hydrateComicMedia(shots: ComicShot[], nodes: ComicCanvasNode[], panoramas: ComicPanorama[], updateShot: (id: string, patch: Partial<ComicShot>) => void, updateNode: (id: string, patch: Partial<ComicCanvasNode>) => void, updatePanorama: (id: string, patch: Partial<ComicPanorama>) => void) {
    await Promise.all([
        ...shots.filter((shot) => shot.storageKey).map(async (shot) => { const url = await resolveImageUrl(shot.storageKey, shot.imageUrl); if (url && url !== shot.imageUrl) updateShot(shot.id, { imageUrl: url }); }),
        ...nodes.filter((node) => node.storageKey).map(async (node) => { const url = node.type === "video" || node.type === "audio" ? await resolveMediaUrl(node.storageKey, node.content) : await resolveImageUrl(node.storageKey, node.content); if (url && url !== node.content) updateNode(node.id, { content: url }); }),
        ...panoramas.filter((item) => item.storageKey).map(async (item) => { const url = await resolveImageUrl(item.storageKey, item.imageUrl); if (url && url !== item.imageUrl) updatePanorama(item.id, { imageUrl: url }); }),
    ]);
}

function visualSnapshot(state: ComicProjectState): ComicVisualState { return structuredClone({ shots: state.shots, canvasNodes: state.canvasNodes, canvasConnections: state.canvasConnections, panoramas: state.panoramas, directorScenes: state.directorScenes, promptPresets: state.promptPresets, selectedShotId: state.selectedShotId, selectedCanvasNodeId: state.selectedCanvasNodeId, storyboardViewport: state.storyboardViewport }); }
function visualProjectPayload(state: ComicProjectState) { return { kind: "aikart-comic-project", version: 2, exportedAt: new Date().toISOString(), ...state }; }
function typeLabel(type: ComicCanvasNode["type"]) { return type === "text" ? "AI 文本" : type === "image" ? "AI 图片" : type === "video" ? "AI 视频" : type === "audio" ? "AI 音频" : "分组"; }
function screenCenterWorld(element: HTMLElement | null, viewport: { x: number; y: number; k: number }) { return { x: ((element?.clientWidth || 900) / 2 - viewport.x) / viewport.k - 150, y: ((element?.clientHeight || 600) / 2 - viewport.y) / viewport.k - 120 }; }
function canvasBounds(items: CanvasItem[]) { if (!items.length) return { x: 0, y: 0, width: 1600, height: 1000 }; const minX = Math.min(...items.map((item) => item.position.x)) - 100; const minY = Math.min(...items.map((item) => item.position.y)) - 100; const maxX = Math.max(...items.map((item) => item.position.x + item.width)) + 100; const maxY = Math.max(...items.map((item) => item.position.y + item.height)) + 100; return { x: minX, y: minY, width: Math.max(600, maxX - minX), height: Math.max(400, maxY - minY) }; }
function safeName(value: string) { return value.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80) || "AikArt"; }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function escapeXml(value: string) { return value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] || char); }
