import {
    ArrowUp,
    Bot,
    Check,
    ChevronDown,
    Clapperboard,
    Copy,
    Download,
    FileInput,
    FileText,
    Film,
    GitBranch,
    Layers3,
    LoaderCircle,
    MessageSquareText,
    Minus,
    PanelRightClose,
    PanelRightOpen,
    PenLine,
    Plus,
    RotateCcw,
    Send,
    Sparkles,
    Trash2,
    WandSparkles,
} from "lucide-react";
import { App, Tooltip } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

import { ModelPicker } from "@/components/model-picker";
import { requestImageQuestion } from "@/services/api/image";
import { useComicStore, createComicEpisodes, createLocalEpisodeScript, type ComicEpisode, type ComicStage } from "@/stores/use-comic-store";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import "./comic.css";

type WebComicStage = Extract<ComicStage, "source" | "outline" | "episodes" | "script">;

const stages: Array<{ key: WebComicStage; label: string; shortLabel: string; icon: typeof FileInput }> = [
    { key: "source", label: "导入素材", shortLabel: "导入", icon: FileInput },
    { key: "outline", label: "故事骨架", shortLabel: "骨架", icon: GitBranch },
    { key: "episodes", label: "分集规划", shortLabel: "分集", icon: Layers3 },
    { key: "script", label: "单集剧本", shortLabel: "剧本", icon: FileText },
];

const webStageKeys = new Set<ComicStage>(stages.map((stage) => stage.key));

const styleOptions = ["电影叙事", "悬疑紧张", "热血成长", "轻喜节奏", "情感现实", "自定义"];
const ratioOptions = ["横屏 16:9", "竖屏 9:16", "方形 1:1", "经典 4:3"];

export default function ComicPage() {
    const { message } = App.useApp();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const effectiveConfig = useEffectiveConfig();
    const config = useConfigStore((state) => state.config);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);

    const projectName = useComicStore((state) => state.projectName);
    const ratio = useComicStore((state) => state.ratio);
    const style = useComicStore((state) => state.style);
    const episodeCount = useComicStore((state) => state.episodeCount);
    const source = useComicStore((state) => state.source);
    const premise = useComicStore((state) => state.premise);
    const outline = useComicStore((state) => state.outline);
    const characters = useComicStore((state) => state.characters);
    const episodes = useComicStore((state) => state.episodes);
    const selectedEpisodeId = useComicStore((state) => state.selectedEpisodeId);
    const activeStage = useComicStore((state) => state.activeStage);
    const messages = useComicStore((state) => state.messages);
    const setProjectField = useComicStore((state) => state.setProjectField);
    const setEpisodeCount = useComicStore((state) => state.setEpisodeCount);
    const setActiveStage = useComicStore((state) => state.setActiveStage);
    const setEpisodes = useComicStore((state) => state.setEpisodes);
    const updateEpisode = useComicStore((state) => state.updateEpisode);
    const selectEpisode = useComicStore((state) => state.selectEpisode);
    const addCharacter = useComicStore((state) => state.addCharacter);
    const updateCharacter = useComicStore((state) => state.updateCharacter);
    const removeCharacter = useComicStore((state) => state.removeCharacter);
    const addMessage = useComicStore((state) => state.addMessage);
    const clearMessages = useComicStore((state) => state.clearMessages);
    const replaceProject = useComicStore((state) => state.replaceProject);
    const resetProject = useComicStore((state) => state.resetProject);

    const [runningAction, setRunningAction] = useState("");
    const [autoStep, setAutoStep] = useState("");
    const [assistantInput, setAssistantInput] = useState("");
    const [assistantRunning, setAssistantRunning] = useState(false);
    const [assistantOpen, setAssistantOpen] = useState(true);
    const [expandedEpisodes, setExpandedEpisodes] = useState<string[]>(() => episodes.slice(0, 2).map((episode) => episode.id));
    const webActiveStage: WebComicStage = webStageKeys.has(activeStage) ? activeStage as WebComicStage : "script";

    const textModel = effectiveConfig.textModel || effectiveConfig.model;
    const aiReady = isAiConfigReady(effectiveConfig, textModel);
    const selectedEpisode = useMemo(() => episodes.find((episode) => episode.id === selectedEpisodeId) || episodes[0], [episodes, selectedEpisodeId]);
    const completedScripts = episodes.filter((episode) => episode.script.trim()).length;

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [messages, assistantRunning]);

    useEffect(() => {
        if (activeStage !== webActiveStage) setActiveStage(webActiveStage);
    }, [activeStage, setActiveStage, webActiveStage]);

    const askModel = async (system: string, prompt: string) => {
        const requestConfig = { ...effectiveConfig, model: textModel, textModel };
        return requestImageQuestion(
            requestConfig,
            [
                { role: "system", content: system },
                { role: "user", content: prompt },
            ],
            () => undefined,
        );
    };

    const importSourceFile = async (files?: FileList | null) => {
        const file = files?.[0];
        if (!file) return;
        try {
            const content = await file.text();
            if (!content.trim()) throw new Error("文件内容为空");
            setProjectField("source", content.slice(0, 50_000));
            if (projectName === "未命名漫剧") setProjectField("projectName", file.name.replace(/\.[^.]+$/, "") || projectName);
            setActiveStage("source");
            message.success("故事素材已导入");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "素材导入失败");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const generateOutline = async () => {
        if (!source.trim()) {
            message.warning("请先输入或导入故事素材");
            setActiveStage("source");
            return;
        }
        setRunningAction("outline");
        try {
            if (aiReady) {
                const answer = await askModel(
                    "你是专业漫剧编剧，擅长把故事素材提炼为可连载的故事骨架。只输出合法 JSON。",
                    [
                        `项目：${projectName}`,
                        `类型风格：${style}`,
                        `原始素材：${source}`,
                        "返回格式：{\"premise\":\"一句话故事\",\"outline\":\"完整故事骨架\",\"characters\":[{\"name\":\"姓名\",\"role\":\"角色定位\",\"description\":\"人物设定\"}]}。不要输出 Markdown。",
                    ].join("\n"),
                );
                const parsed = parseJsonObject(answer) as GeneratedOutline | null;
                if (!parsed?.premise || !parsed.outline) throw new Error("模型返回的故事骨架格式不完整");
                replaceProject({
                    premise: String(parsed.premise),
                    outline: String(parsed.outline),
                    characters: normalizeCharacters(parsed.characters, characters),
                    activeStage: "outline",
                });
            } else {
                const local = localOutline(source, style);
                replaceProject({ ...local, activeStage: "outline" });
                message.info("当前未配置文本模型，已生成本地故事骨架");
            }
            setActiveStage("outline");
            message.success("故事骨架已生成");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "故事骨架生成失败");
        } finally {
            setRunningAction("");
        }
    };

    const generateEpisodePlan = async () => {
        if (!outline.trim() && !source.trim()) {
            message.warning("请先补充故事素材或故事骨架");
            return;
        }
        setRunningAction("episodes");
        try {
            let nextEpisodes = createComicEpisodes(episodeCount, episodes);
            if (aiReady) {
                const answer = await askModel(
                    "你是专业漫剧分集策划，擅长设计连续冲突和集尾钩子。只输出合法 JSON。",
                    [
                        `项目：${projectName}；风格：${style}；比例：${ratio}`,
                        `一句话故事：${premise}`,
                        `故事骨架：${outline || source}`,
                        `请规划 ${episodeCount} 集，每集包含 title、summary、hook。`,
                        "返回格式：{\"episodes\":[{\"title\":\"集名\",\"summary\":\"本集情节\",\"hook\":\"集尾钩子\"}]}。不要输出 Markdown。",
                    ].join("\n"),
                );
                const parsed = parseJsonObject(answer) as { episodes?: Array<Partial<ComicEpisode>> } | null;
                nextEpisodes = normalizeEpisodes(parsed?.episodes, episodeCount, episodes);
            }
            setEpisodes(nextEpisodes);
            setExpandedEpisodes(nextEpisodes.slice(0, 2).map((episode) => episode.id));
            setActiveStage("episodes");
            message.success(`已生成 ${nextEpisodes.length} 集分集规划`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "分集规划生成失败");
        } finally {
            setRunningAction("");
        }
    };

    const generateAll = async () => {
        if (!source.trim()) {
            setActiveStage("source");
            message.warning("请先输入或导入故事素材");
            return;
        }
        setRunningAction("auto");
        setAutoStep("正在理解故事素材");
        try {
            let nextPremise = premise;
            let nextOutline = outline;
            let nextCharacters = characters;
            let nextEpisodes = createComicEpisodes(episodeCount, episodes);

            if (aiReady) {
                const answer = await askModel(
                    "你是 AikArt 漫剧总编剧，负责从素材中完成故事骨架和分集规划。必须只输出合法 JSON。",
                    [
                        `项目名称：${projectName}`,
                        `画面比例：${ratio}`,
                        `写作风格：${style}`,
                        `目标集数：${episodeCount}`,
                        `故事素材：${source}`,
                        "请输出 premise、outline、characters、episodes。episodes 必须包含指定集数，每项包含 title、summary、hook。",
                        "JSON 格式：{\"premise\":\"\",\"outline\":\"\",\"characters\":[{\"name\":\"\",\"role\":\"\",\"description\":\"\"}],\"episodes\":[{\"title\":\"\",\"summary\":\"\",\"hook\":\"\"}]}。",
                    ].join("\n"),
                );
                const parsed = parseJsonObject(answer) as GeneratedProject | null;
                if (!parsed?.premise || !parsed.outline) throw new Error("模型返回的项目格式不完整");
                nextPremise = String(parsed.premise);
                nextOutline = String(parsed.outline);
                nextCharacters = normalizeCharacters(parsed.characters, characters);
                nextEpisodes = normalizeEpisodes(parsed.episodes, episodeCount, episodes);
            } else {
                const local = localOutline(source, style);
                nextPremise = local.premise;
                nextOutline = local.outline;
                setAutoStep("正在创建角色与故事骨架");
                await wait(260);
                setAutoStep("正在拆解分集冲突");
                await wait(260);
            }

            setAutoStep("正在整理创作项目");
            replaceProject({
                premise: nextPremise,
                outline: nextOutline,
                characters: nextCharacters,
                episodes: nextEpisodes,
                episodeCount: nextEpisodes.length,
                selectedEpisodeId: nextEpisodes[0]?.id || "",
                activeStage: "episodes",
            });
            setExpandedEpisodes(nextEpisodes.slice(0, 2).map((episode) => episode.id));
            if (!aiReady) message.info("当前未配置文本模型，已使用本地创作模板");
            message.success("故事骨架与分集规划已完成");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "全自动生成失败");
        } finally {
            setRunningAction("");
            setAutoStep("");
        }
    };

    const generateScript = async (episode: ComicEpisode) => {
        setRunningAction(`script:${episode.id}`);
        try {
            let script = createLocalEpisodeScript(episode.number, episode.title, episode.summary, episode.hook);
            if (aiReady) {
                const answer = await askModel(
                    "你是专业漫剧编剧。根据项目上下文写单集可拍摄剧本，只返回剧本正文，不要解释或 Markdown 代码块。",
                    buildEpisodeContext(episode, { projectName, ratio, style, premise, outline, characters }),
                );
                script = cleanModelText(answer);
                if (!script) throw new Error("模型没有返回有效剧本");
            }
            updateEpisode(episode.id, { script });
            selectEpisode(episode.id);
            setActiveStage("script");
            message.success(`第 ${episode.number} 集剧本已生成`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "剧本生成失败");
        } finally {
            setRunningAction("");
        }
    };

    const optimizeScript = async (episode: ComicEpisode) => {
        if (!episode.script.trim()) {
            await generateScript(episode);
            return;
        }
        setRunningAction(`optimize:${episode.id}`);
        try {
            let script = optimizeLocalScript(episode.script);
            if (aiReady) {
                const answer = await askModel(
                    "你是专业漫剧剧本编辑。强化冲突、节奏、镜头可视性和人物对白，保留剧情事实。只返回优化后的完整剧本正文。",
                    `${buildEpisodeContext(episode, { projectName, ratio, style, premise, outline, characters })}\n\n待优化剧本：\n${episode.script}`,
                );
                script = cleanModelText(answer);
                if (!script) throw new Error("模型没有返回有效剧本");
            }
            updateEpisode(episode.id, { script });
            selectEpisode(episode.id);
            setActiveStage("script");
            message.success(`第 ${episode.number} 集剧本已优化`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "剧本优化失败");
        } finally {
            setRunningAction("");
        }
    };

    const sendAssistantMessage = async (preset?: string) => {
        const prompt = (preset || assistantInput).trim();
        if (!prompt || assistantRunning) return;
        addMessage({ role: "user", content: prompt });
        setAssistantInput("");
        setAssistantRunning(true);
        try {
            const context = selectedEpisode ? buildEpisodeContext(selectedEpisode, { projectName, ratio, style, premise, outline, characters }) : `项目：${projectName}\n骨架：${outline}`;
            let result = "";
            if (aiReady) {
                const target = webActiveStage === "source" ? "原始故事素材" : webActiveStage === "outline" ? "故事骨架" : webActiveStage === "episodes" ? "当前分集规划" : "当前单集剧本";
                result = cleanModelText(
                    await askModel(
                        `你是漫剧创作助手。请按用户要求直接改写${target}，保持项目设定一致。只返回修改后的内容；如果修改分集规划，返回 {\"title\":\"\",\"summary\":\"\",\"hook\":\"\"} JSON。`,
                        `${context}\n\n用户调整要求：${prompt}\n\n当前内容：\n${activeContent(webActiveStage, { source, outline, selectedEpisode })}`,
                    ),
                );
            }

            if (webActiveStage === "source") {
                const next = result || `${source.trim()}\n\n补充创作要求：${prompt}`;
                setProjectField("source", next);
                addMessage({ role: "assistant", content: "已按要求更新故事素材，新的内容已同步到中间编辑区。" });
            } else if (webActiveStage === "outline") {
                const next = result || `${outline.trim()}\n\n调整方向：${prompt}`;
                setProjectField("outline", next);
                addMessage({ role: "assistant", content: "故事骨架已更新，人物与后续分集可以继续沿用这次调整。" });
            } else if (webActiveStage === "episodes" && selectedEpisode) {
                const parsed = parseJsonObject(result) as Partial<ComicEpisode> | null;
                updateEpisode(selectedEpisode.id, parsed ? {
                    title: String(parsed.title || selectedEpisode.title),
                    summary: String(parsed.summary || selectedEpisode.summary),
                    hook: String(parsed.hook || selectedEpisode.hook),
                } : { summary: `${selectedEpisode.summary}\n调整方向：${prompt}` });
                addMessage({ role: "assistant", content: `已更新第 ${selectedEpisode.number} 集的情节和集尾钩子。` });
            } else if (selectedEpisode) {
                const next = result || `${selectedEpisode.script || createLocalEpisodeScript(selectedEpisode.number, selectedEpisode.title, selectedEpisode.summary, selectedEpisode.hook)}\n\n【调整】${prompt}`;
                updateEpisode(selectedEpisode.id, { script: next });
                addMessage({ role: "assistant", content: `已按要求改写第 ${selectedEpisode.number} 集剧本，可在中间编辑区继续修改。` });
            }
            if (!aiReady) message.info("当前未配置文本模型，已应用本地调整");
        } catch (error) {
            addMessage({ role: "assistant", content: error instanceof Error ? `调整失败：${error.message}` : "调整失败，请稍后重试。" });
        } finally {
            setAssistantRunning(false);
        }
    };

    const copyScript = async (episode: ComicEpisode) => {
        if (!episode.script.trim()) {
            message.warning("当前分集还没有剧本");
            return;
        }
        await navigator.clipboard.writeText(episode.script);
        message.success("剧本已复制");
    };

    const downloadScript = (episode: ComicEpisode) => {
        if (!episode.script.trim()) {
            message.warning("当前分集还没有剧本");
            return;
        }
        const blob = new Blob([episode.script], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${projectName}-第${episode.number}集-${episode.title}.txt`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const exportForDesktop = (episode: ComicEpisode) => {
        const script = episode.script || createLocalEpisodeScript(episode.number, episode.title, episode.summary, episode.hook);
        const state = useComicStore.getState();
        const payload = {
            kind: "aikart-comic-project",
            version: 2,
            exportedAt: new Date().toISOString(),
            ...state,
            episodes: state.episodes.map((item) => item.id === episode.id ? { ...item, script } : item),
            selectedEpisodeId: episode.id,
            activeStage: "storyboard" as const,
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${safeFileName(projectName)}-第${episode.number}集.aikart.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        message.success("桌面端项目已导出，请在 AikArt Storyboard 中导入");
    };

    const confirmReset = () => {
        resetProject();
        setExpandedEpisodes([]);
        message.success("已新建漫剧项目");
    };

    return (
        <main className="comic-page">
            <div className="comic-workspace-grid">
                <aside className="comic-settings comic-panel">
                    <header className="comic-settings-header">
                        <div>
                            <span className="comic-kicker"><Clapperboard className="size-4" /> 漫剧项目</span>
                            <h1>项目设置</h1>
                        </div>
                        <Tooltip title="新建项目">
                            <button type="button" className="comic-icon-button" onClick={confirmReset}><RotateCcw className="size-4" /></button>
                        </Tooltip>
                    </header>

                    <label className="comic-field">
                        <span>项目名称</span>
                        <input value={projectName} maxLength={36} onChange={(event) => setProjectField("projectName", event.target.value)} />
                    </label>

                    <label className="comic-field">
                        <span>画面比例</span>
                        <span className="comic-native-select">
                            <select value={ratio} onChange={(event) => setProjectField("ratio", event.target.value.replace(/^[^ ]+ /, ""))}>
                                {ratioOptions.map((option) => <option key={option} value={option.replace(/^[^ ]+ /, "")}>{option}</option>)}
                            </select>
                            <ChevronDown className="size-4" />
                        </span>
                    </label>

                    <section className="comic-setting-section">
                        <span className="comic-setting-label">写作风格</span>
                        <div className="comic-style-grid">
                            {styleOptions.map((option) => (
                                <button type="button" key={option} className={style === option ? "is-active" : ""} onClick={() => setProjectField("style", option)}>{option}</button>
                            ))}
                        </div>
                    </section>

                    <section className="comic-setting-section comic-count-setting">
                        <div>
                            <span className="comic-setting-label">当前制作</span>
                            <strong>分集剧本</strong>
                        </div>
                        <div className="comic-stepper" aria-label="分集数量">
                            <button type="button" disabled={episodeCount <= 1} onClick={() => setEpisodeCount(episodeCount - 1)}><Minus className="size-4" /></button>
                            <span><b>{episodeCount}</b><small>集</small></span>
                            <button type="button" disabled={episodeCount >= 30} onClick={() => setEpisodeCount(episodeCount + 1)}><Plus className="size-4" /></button>
                        </div>
                    </section>

                    <section className="comic-progress-section">
                        <div className="comic-progress-heading">
                            <span className="comic-setting-label">创作进度</span>
                            <small>{completedScripts}/{episodeCount} 集剧本</small>
                        </div>
                        <div className="comic-progress-list">
                            {stages.map((stage, index) => {
                                const complete = stageComplete(stage.key, { source, premise, outline, episodes });
                                const active = webActiveStage === stage.key;
                                const Icon = stage.icon;
                                return (
                                    <button type="button" key={stage.key} className={`${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`} onClick={() => setActiveStage(stage.key)}>
                                        <span className="comic-progress-dot">{complete ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}</span>
                                        <span><strong>{stage.label}</strong><small>{index === 3 ? `${completedScripts} 集已完成` : complete ? "已完成" : "待创作"}</small></span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                    <div className="comic-auto-save"><Check className="size-3.5" /> 草稿已自动保存</div>
                </aside>

                <section className="comic-main comic-panel">
                    <header className="comic-stage-bar">
                        <nav aria-label="漫剧创作阶段">
                            {stages.map((stage) => {
                                const Icon = stage.icon;
                                return <button type="button" key={stage.key} className={webActiveStage === stage.key ? "is-active" : ""} onClick={() => setActiveStage(stage.key)}><Icon className="size-4" /><span>{stage.shortLabel}</span></button>;
                            })}
                        </nav>
                        <div className="comic-stage-actions">
                            <Tooltip title={assistantOpen ? "收起创作助手" : "打开创作助手"}>
                                <button type="button" className="comic-icon-button comic-assistant-toggle" onClick={() => setAssistantOpen((value) => !value)}>{assistantOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}</button>
                            </Tooltip>
                            <button type="button" className="comic-auto-button" disabled={runningAction === "auto"} onClick={() => void generateAll()}>
                                {runningAction === "auto" ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                                <span>{runningAction === "auto" ? autoStep || "正在生成" : "全自动生成"}</span>
                            </button>
                        </div>
                    </header>

                    <div className="comic-stage-content thin-scrollbar">
                        {webActiveStage === "source" ? (
                            <SourceStage
                                source={source}
                                running={runningAction === "outline"}
                                fileInputRef={fileInputRef}
                                onChange={(value) => setProjectField("source", value)}
                                onImport={importSourceFile}
                                onGenerate={() => void generateOutline()}
                            />
                        ) : null}
                        {webActiveStage === "outline" ? (
                            <OutlineStage
                                premise={premise}
                                outline={outline}
                                characters={characters}
                                running={runningAction === "episodes"}
                                onPremiseChange={(value) => setProjectField("premise", value)}
                                onOutlineChange={(value) => setProjectField("outline", value)}
                                onAddCharacter={addCharacter}
                                onUpdateCharacter={updateCharacter}
                                onRemoveCharacter={removeCharacter}
                                onGenerate={() => void generateEpisodePlan()}
                            />
                        ) : null}
                        {webActiveStage === "episodes" ? (
                            <EpisodesStage
                                episodes={episodes}
                                selectedEpisodeId={selectedEpisode?.id || ""}
                                expandedEpisodes={expandedEpisodes}
                                runningAction={runningAction}
                                onSelect={selectEpisode}
                                onToggle={(id) => setExpandedEpisodes((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                                onUpdate={updateEpisode}
                                onGenerate={(episode) => void generateScript(episode)}
                                onOptimize={(episode) => void optimizeScript(episode)}
                                onCanvas={exportForDesktop}
                            />
                        ) : null}
                        {webActiveStage === "script" ? (
                            <ScriptStage
                                episodes={episodes}
                                episode={selectedEpisode}
                                runningAction={runningAction}
                                onSelect={selectEpisode}
                                onUpdate={updateEpisode}
                                onGenerate={(episode) => void generateScript(episode)}
                                onOptimize={(episode) => void optimizeScript(episode)}
                                onCopy={copyScript}
                                onDownload={downloadScript}
                                onCanvas={exportForDesktop}
                            />
                        ) : null}
                    </div>
                </section>

                <button type="button" aria-label="关闭创作助手" className={`comic-assistant-scrim ${assistantOpen ? "is-open" : ""}`} onClick={() => setAssistantOpen(false)} />
                <aside className={`comic-assistant comic-panel ${assistantOpen ? "is-open" : ""}`}>
                    <header className="comic-assistant-header">
                        <span className="comic-assistant-mark"><WandSparkles className="size-5" /></span>
                        <div><strong>剧本创作助手</strong><small>理解项目上下文并直接修改当前内容</small></div>
                        <Tooltip title="清空对话"><button type="button" className="comic-icon-button" onClick={clearMessages}><Trash2 className="size-4" /></button></Tooltip>
                        <button type="button" className="comic-icon-button comic-assistant-close" onClick={() => setAssistantOpen(false)}><PanelRightClose className="size-4" /></button>
                    </header>

                    <div className="comic-context-card">
                        <span>当前上下文</span>
                        <strong>{projectName}</strong>
                        <div><em>{style}</em><em>{ratio}</em>{selectedEpisode ? <em>第 {selectedEpisode.number} 集</em> : null}</div>
                    </div>

                    <div className="comic-chat thin-scrollbar">
                        {messages.length ? messages.map((item) => (
                            <div key={item.id} className={`comic-message is-${item.role}`}>
                                {item.role === "assistant" ? <span><Bot className="size-4" /></span> : null}
                                <p>{item.content}</p>
                            </div>
                        )) : <div className="comic-chat-empty"><MessageSquareText className="size-6" /><span>从一次具体调整开始</span></div>}
                        {assistantRunning ? <div className="comic-message is-assistant"><span><Bot className="size-4" /></span><p className="comic-typing"><i /><i /><i /></p></div> : null}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="comic-quick-prompts">
                        {["强化本集冲突", "压缩对白节奏", "增加结尾钩子"].map((prompt) => <button type="button" key={prompt} onClick={() => void sendAssistantMessage(prompt)}>{prompt}</button>)}
                    </div>

                    <div className="comic-chat-composer">
                        <textarea
                            value={assistantInput}
                            rows={4}
                            placeholder="告诉助手要调整的人物、情节、节奏或对白…"
                            onChange={(event) => setAssistantInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && !event.shiftKey) {
                                    event.preventDefault();
                                    void sendAssistantMessage();
                                }
                            }}
                        />
                        <div className="comic-composer-footer">
                            <ModelPicker
                                config={config}
                                capability="text"
                                value={config.textModel}
                                onChange={(model) => updateConfig("textModel", model)}
                                onMissingConfig={() => openConfigDialog(false, "models")}
                                className="comic-model-picker"
                            />
                            <button type="button" className="comic-send-button" disabled={!assistantInput.trim() || assistantRunning} onClick={() => void sendAssistantMessage()} aria-label="发送调整要求">
                                {assistantRunning ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        </main>
    );
}

function StageHeading({ icon: Icon, title, description, badge }: { icon: typeof FileInput; title: string; description: string; badge?: string }) {
    return <header className="comic-stage-heading"><span><Icon className="size-5" /></span><div><h2>{title}</h2><p>{description}</p></div>{badge ? <em>{badge}</em> : null}</header>;
}

function SourceStage({ source, running, fileInputRef, onChange, onImport, onGenerate }: {
    source: string;
    running: boolean;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onChange: (value: string) => void;
    onImport: (files?: FileList | null) => void;
    onGenerate: () => void;
}) {
    return <div className="comic-stage-view comic-source-stage">
        <StageHeading icon={FileInput} title="导入故事素材" description="小说、故事梗概或已有剧本" badge={`${source.length.toLocaleString()} 字`} />
        <div className="comic-source-editor">
            <textarea value={source} placeholder="粘贴故事正文、人物设定或剧情梗概…" onChange={(event) => onChange(event.target.value)} />
            <div className="comic-source-actions">
                <input ref={fileInputRef} className="hidden" type="file" accept=".txt,.md,.json,text/plain,text/markdown,application/json" onChange={(event) => void onImport(event.target.files)} />
                <button type="button" className="comic-secondary-button" onClick={() => fileInputRef.current?.click()}><FileInput className="size-4" /> 导入文本</button>
                <button type="button" className="comic-primary-button" disabled={running} onClick={onGenerate}>{running ? <LoaderCircle className="size-4 animate-spin" /> : <GitBranch className="size-4" />} 生成故事骨架</button>
            </div>
        </div>
    </div>;
}

function OutlineStage({ premise, outline, characters, running, onPremiseChange, onOutlineChange, onAddCharacter, onUpdateCharacter, onRemoveCharacter, onGenerate }: {
    premise: string;
    outline: string;
    characters: ReturnType<typeof useComicStore.getState>["characters"];
    running: boolean;
    onPremiseChange: (value: string) => void;
    onOutlineChange: (value: string) => void;
    onAddCharacter: () => void;
    onUpdateCharacter: (id: string, patch: { name?: string; role?: string; description?: string }) => void;
    onRemoveCharacter: (id: string) => void;
    onGenerate: () => void;
}) {
    return <div className="comic-stage-view">
        <StageHeading icon={GitBranch} title="故事骨架" description="确定核心命题、人物关系与主线冲突" badge={`${characters.length} 个角色`} />
        <section className="comic-editor-card">
            <label><span>一句话故事</span><textarea rows={2} value={premise} onChange={(event) => onPremiseChange(event.target.value)} /></label>
            <label><span>故事主线</span><textarea rows={7} value={outline} onChange={(event) => onOutlineChange(event.target.value)} /></label>
        </section>
        <section className="comic-characters-section">
            <header><div><strong>主要角色</strong><small>人物定位会同步到分集与剧本</small></div><button type="button" onClick={onAddCharacter}><Plus className="size-4" /> 添加角色</button></header>
            <div className="comic-character-grid">
                {characters.map((character) => <article key={character.id} className="comic-character-card">
                    <div className="comic-character-avatar">{character.name.trim().slice(0, 1) || "角"}</div>
                    <div className="comic-character-fields">
                        <input aria-label="角色姓名" value={character.name} onChange={(event) => onUpdateCharacter(character.id, { name: event.target.value })} />
                        <input aria-label="角色定位" value={character.role} onChange={(event) => onUpdateCharacter(character.id, { role: event.target.value })} />
                        <textarea aria-label="角色描述" rows={3} value={character.description} onChange={(event) => onUpdateCharacter(character.id, { description: event.target.value })} />
                    </div>
                    <button type="button" title="删除角色" onClick={() => onRemoveCharacter(character.id)}><Trash2 className="size-4" /></button>
                </article>)}
            </div>
        </section>
        <div className="comic-stage-footer"><button type="button" className="comic-primary-button" disabled={running} onClick={onGenerate}>{running ? <LoaderCircle className="size-4 animate-spin" /> : <Layers3 className="size-4" />} 生成分集规划</button></div>
    </div>;
}

function EpisodesStage({ episodes, selectedEpisodeId, expandedEpisodes, runningAction, onSelect, onToggle, onUpdate, onGenerate, onOptimize, onCanvas }: {
    episodes: ComicEpisode[];
    selectedEpisodeId: string;
    expandedEpisodes: string[];
    runningAction: string;
    onSelect: (id: string) => void;
    onToggle: (id: string) => void;
    onUpdate: (id: string, patch: Partial<ComicEpisode>) => void;
    onGenerate: (episode: ComicEpisode) => void;
    onOptimize: (episode: ComicEpisode) => void;
    onCanvas: (episode: ComicEpisode) => void;
}) {
    return <div className="comic-stage-view">
        <StageHeading icon={Layers3} title="分集规划" description="拆解每集目标、冲突与结尾钩子" badge={`${episodes.length} 集`} />
        <div className="comic-episode-grid">
            {episodes.map((episode) => {
                const expanded = expandedEpisodes.includes(episode.id);
                const selected = selectedEpisodeId === episode.id;
                const scriptRunning = runningAction === `script:${episode.id}`;
                const optimizeRunning = runningAction === `optimize:${episode.id}`;
                return <article key={episode.id} className={`comic-episode-card ${selected ? "is-selected" : ""}`} onClick={() => onSelect(episode.id)}>
                    <header>
                        <span>第{episode.number}集</span>
                        <input aria-label={`第 ${episode.number} 集标题`} value={episode.title} onChange={(event) => onUpdate(episode.id, { title: event.target.value })} onClick={(event) => event.stopPropagation()} />
                        <button type="button" onClick={(event) => { event.stopPropagation(); onToggle(episode.id); }} aria-label={expanded ? "收起分集" : "展开分集"}><ChevronDown className={`size-4 ${expanded ? "is-expanded" : ""}`} /></button>
                    </header>
                    <div className="comic-episode-status">{episode.script ? <><Check className="size-3.5" /> 剧本已生成</> : "待生成剧本"}</div>
                    <textarea className="comic-episode-summary" value={episode.summary} rows={expanded ? 5 : 3} onChange={(event) => onUpdate(episode.id, { summary: event.target.value })} onClick={(event) => event.stopPropagation()} />
                    {expanded ? <label className="comic-hook-field"><span>集尾钩子</span><textarea rows={2} value={episode.hook} onChange={(event) => onUpdate(episode.id, { hook: event.target.value })} onClick={(event) => event.stopPropagation()} /></label> : <p className="comic-hook-preview"><Sparkles className="size-3.5" /> {episode.hook}</p>}
                    <footer>
                        <button type="button" className="is-primary" disabled={scriptRunning} onClick={(event) => { event.stopPropagation(); onGenerate(episode); }}>{scriptRunning ? <LoaderCircle className="size-4 animate-spin" /> : <PenLine className="size-4" />} {episode.script ? "重写剧本" : "生成剧本"}</button>
                        <button type="button" disabled={optimizeRunning} onClick={(event) => { event.stopPropagation(); onOptimize(episode); }}>{optimizeRunning ? <LoaderCircle className="size-4 animate-spin" /> : <WandSparkles className="size-4" />} 优化剧本</button>
                        <button type="button" onClick={(event) => { event.stopPropagation(); onCanvas(episode); }}><GitBranch className="size-4" /> 导出到桌面端</button>
                    </footer>
                </article>;
            })}
        </div>
    </div>;
}

function ScriptStage({ episodes, episode, runningAction, onSelect, onUpdate, onGenerate, onOptimize, onCopy, onDownload, onCanvas }: {
    episodes: ComicEpisode[];
    episode?: ComicEpisode;
    runningAction: string;
    onSelect: (id: string) => void;
    onUpdate: (id: string, patch: Partial<ComicEpisode>) => void;
    onGenerate: (episode: ComicEpisode) => void;
    onOptimize: (episode: ComicEpisode) => void;
    onCopy: (episode: ComicEpisode) => void;
    onDownload: (episode: ComicEpisode) => void;
    onCanvas: (episode: ComicEpisode) => void;
}) {
    if (!episode) return <div className="comic-empty-stage"><Film className="size-8" /><span>请先生成分集规划</span></div>;
    const generating = runningAction === `script:${episode.id}`;
    const optimizing = runningAction === `optimize:${episode.id}`;
    return <div className="comic-stage-view comic-script-stage">
        <StageHeading icon={FileText} title="单集剧本" description="镜头、动作、对白与声音的完整脚本" badge={episode.script ? `${episode.script.length} 字` : "待生成"} />
        <div className="comic-script-toolbar">
            <label><span>当前分集</span><span className="comic-native-select"><select value={episode.id} onChange={(event) => onSelect(event.target.value)}>{episodes.map((item) => <option key={item.id} value={item.id}>第 {item.number} 集 · {item.title}</option>)}</select><ChevronDown className="size-4" /></span></label>
            <div>
                <Tooltip title="复制剧本"><button type="button" className="comic-icon-button" onClick={() => void onCopy(episode)}><Copy className="size-4" /></button></Tooltip>
                <Tooltip title="下载剧本"><button type="button" className="comic-icon-button" onClick={() => onDownload(episode)}><Download className="size-4" /></button></Tooltip>
            </div>
        </div>
        <section className="comic-script-editor">
            <header><span>第 {episode.number} 集</span><input value={episode.title} onChange={(event) => onUpdate(episode.id, { title: event.target.value })} /></header>
            <textarea value={episode.script} placeholder="点击“生成本集剧本”，或直接在这里开始写作…" onChange={(event) => onUpdate(episode.id, { script: event.target.value })} />
        </section>
        <div className="comic-script-actions">
            <button type="button" className="comic-secondary-button" disabled={optimizing} onClick={() => onOptimize(episode)}>{optimizing ? <LoaderCircle className="size-4 animate-spin" /> : <WandSparkles className="size-4" />} 优化剧本</button>
            <button type="button" className="comic-primary-button" disabled={generating} onClick={() => onGenerate(episode)}>{generating ? <LoaderCircle className="size-4 animate-spin" /> : <PenLine className="size-4" />} {episode.script ? "重新生成" : "生成本集剧本"}</button>
            <button type="button" className="comic-canvas-button" onClick={() => onCanvas(episode)}><GitBranch className="size-4" /> 导出到桌面端</button>
        </div>
    </div>;
}

type GeneratedOutline = { premise?: unknown; outline?: unknown; characters?: Array<{ name?: unknown; role?: unknown; description?: unknown }> };
type GeneratedProject = GeneratedOutline & { episodes?: Array<Partial<ComicEpisode>> };

function parseJsonObject(value: string) {
    const clean = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
        return JSON.parse(clean.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function normalizeCharacters(value: GeneratedOutline["characters"], fallback: ReturnType<typeof useComicStore.getState>["characters"]) {
    if (!Array.isArray(value) || !value.length) return fallback;
    return value.slice(0, 12).map((character, index) => ({
        id: `comic-character-${Date.now()}-${index}`,
        name: String(character.name || `角色 ${index + 1}`),
        role: String(character.role || "主要角色"),
        description: String(character.description || "待补充人物设定"),
    }));
}

function normalizeEpisodes(value: GeneratedProject["episodes"], count: number, existing: ComicEpisode[]) {
    const fallback = createComicEpisodes(count, existing);
    if (!Array.isArray(value) || !value.length) return fallback;
    return Array.from({ length: count }, (_, index) => {
        const base = fallback[index];
        const item = value[index];
        if (!item) return base;
        return {
            ...base,
            title: String(item.title || base.title),
            summary: String(item.summary || base.summary),
            hook: String(item.hook || base.hook),
        };
    });
}

function localOutline(source: string, style: string) {
    const clean = source.replace(/\s+/g, " ").trim();
    const excerpt = clean.slice(0, 118);
    return {
        premise: `${excerpt}${clean.length > 118 ? "…" : ""}`,
        outline: `采用${style}的叙事方式，从主角发现异常线索开始，逐步揭示事件背后的隐秘关系。前段建立人物目标与核心悬念，中段通过误导、追查与关系冲突持续升级，后段让主角付出关键代价并完成选择，最终解决主线危机，同时保留可延展的新钩子。`,
    };
}

function buildEpisodeContext(episode: ComicEpisode, project: { projectName: string; ratio: string; style: string; premise: string; outline: string; characters: ReturnType<typeof useComicStore.getState>["characters"] }) {
    return [
        `项目：${project.projectName}`,
        `画面比例：${project.ratio}`,
        `写作风格：${project.style}`,
        `一句话故事：${project.premise}`,
        `故事骨架：${project.outline}`,
        `人物：${project.characters.map((character) => `${character.name}（${character.role}）：${character.description}`).join("；")}`,
        `当前分集：第 ${episode.number} 集《${episode.title}》`,
        `本集情节：${episode.summary}`,
        `结尾钩子：${episode.hook}`,
        "请用场景标题、镜头画面、动作、对白、声音和转场写出完整单集剧本，人物行为和对白必须推动冲突。",
    ].join("\n");
}

function cleanModelText(value: string) {
    return value.trim().replace(/^```(?:text|markdown)?\s*/i, "").replace(/```\s*$/i, "").trim();
}

function optimizeLocalScript(script: string) {
    const optimized = script
        .replace(/画面：/g, "画面：镜头由远及近，")
        .replace(/旁白：/g, "旁白（克制）：")
        .replace(/【结尾钩子】/g, "【结尾钩子｜音乐骤停】");
    return optimized === script ? `${script}\n\n【节奏强化】冲突提前，关键动作采用近景切换，结尾在答案出现前切黑。` : optimized;
}

function activeContent(stage: ComicStage, values: { source: string; outline: string; selectedEpisode?: ComicEpisode }) {
    if (stage === "source") return values.source;
    if (stage === "outline") return values.outline;
    if (stage === "episodes") return values.selectedEpisode ? JSON.stringify({ title: values.selectedEpisode.title, summary: values.selectedEpisode.summary, hook: values.selectedEpisode.hook }, null, 2) : "";
    return values.selectedEpisode?.script || "";
}

function safeFileName(value: string) {
    return value.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80) || "AikArt";
}

function stageComplete(stage: ComicStage, values: { source: string; premise: string; outline: string; episodes: ComicEpisode[] }) {
    if (stage === "source") return Boolean(values.source.trim());
    if (stage === "outline") return Boolean(values.premise.trim() && values.outline.trim());
    if (stage === "episodes") return Boolean(values.episodes.length && values.episodes.every((episode) => episode.summary.trim()));
    return Boolean(values.episodes.some((episode) => episode.script.trim()));
}

function wait(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}
