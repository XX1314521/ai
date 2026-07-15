import { nanoid } from "nanoid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { localForageStorage } from "@/lib/localforage-storage";

export type ComicStage = "source" | "outline" | "episodes" | "script" | "storyboard" | "panorama" | "director";

export type ComicCharacter = {
    id: string;
    name: string;
    role: string;
    description: string;
};

export type ComicEpisode = {
    id: string;
    number: number;
    title: string;
    summary: string;
    hook: string;
    script: string;
};

export type ComicChatMessage = {
    id: string;
    role: "assistant" | "user";
    content: string;
    createdAt: number;
};

export type ComicShotCamera = {
    shotSize: string;
    angle: string;
    movement: string;
    camera: string;
    lens: string;
    focalLength: number;
    aperture: number;
};

export type ComicShotImageVersion = {
    id: string;
    imageUrl: string;
    storageKey?: string;
    prompt: string;
    createdAt: number;
};

export type ComicShot = {
    id: string;
    episodeId: string;
    order: number;
    title: string;
    description: string;
    dialogue: string;
    prompt: string;
    negativePrompt: string;
    duration: number;
    notes: string;
    position: { x: number; y: number };
    imageUrl: string;
    storageKey?: string;
    referenceImageUrl?: string;
    referenceStorageKey?: string;
    status: "idle" | "loading" | "success" | "error";
    error?: string;
    camera: ComicShotCamera;
    imageHistory: ComicShotImageVersion[];
};

export type ComicCanvasNodeType = "text" | "image" | "video" | "audio" | "group";

export type ComicCanvasNode = {
    id: string;
    episodeId: string;
    type: ComicCanvasNodeType;
    title: string;
    content: string;
    storageKey?: string;
    prompt?: string;
    position: { x: number; y: number };
    width: number;
    height: number;
    status: "idle" | "loading" | "success" | "error";
    error?: string;
};

export type ComicCanvasConnection = {
    id: string;
    episodeId: string;
    fromId: string;
    toId: string;
};

export type ComicPanorama = {
    id: string;
    episodeId: string;
    prompt: string;
    imageUrl: string;
    storageKey?: string;
    sourceImageUrl?: string;
    sourceStorageKey?: string;
    projection: "spherical" | "cylindrical";
    yaw: number;
    pitch: number;
    fov: number;
    status: "idle" | "loading" | "success" | "error";
    error?: string;
};

export type ComicDirectorItem = {
    id: string;
    type: "person" | "object" | "scene";
    label: string;
    x: number;
    y: number;
    z: number;
    rotation: number;
    scale: number;
    color: string;
    action: string;
};

export type ComicDirectorScene = {
    episodeId: string;
    mode: "flat" | "panorama";
    backgroundImageUrl?: string;
    backgroundStorageKey?: string;
    items: ComicDirectorItem[];
    camera: { yaw: number; pitch: number; zoom: number; fov: number; frame: string };
    lighting: { enabled: boolean; intensity: number; yaw: number; color: string; ambient: number };
    gridVisible: boolean;
    basePrompt: string;
    snapshotUrl?: string;
    snapshotStorageKey?: string;
    snapshotHistory: ComicShotImageVersion[];
};

export type ComicPromptPreset = {
    id: string;
    name: string;
    prompt: string;
    category: string;
    builtin?: boolean;
};

export type ComicViewport = { x: number; y: number; k: number };

export type ComicVisualState = {
    shots: ComicShot[];
    canvasNodes: ComicCanvasNode[];
    canvasConnections: ComicCanvasConnection[];
    panoramas: ComicPanorama[];
    directorScenes: ComicDirectorScene[];
    promptPresets: ComicPromptPreset[];
    selectedShotId: string;
    selectedCanvasNodeId: string;
    storyboardViewport: ComicViewport;
};

export type ComicProjectState = ComicVisualState & {
    projectName: string;
    ratio: string;
    style: string;
    episodeCount: number;
    source: string;
    premise: string;
    outline: string;
    characters: ComicCharacter[];
    episodes: ComicEpisode[];
    selectedEpisodeId: string;
    activeStage: ComicStage;
    messages: ComicChatMessage[];
};

type ComicStore = ComicProjectState & {
    setProjectField: <K extends keyof Pick<ComicProjectState, "projectName" | "ratio" | "style" | "source" | "premise" | "outline">>(key: K, value: ComicProjectState[K]) => void;
    setEpisodeCount: (count: number) => void;
    setActiveStage: (stage: ComicStage) => void;
    setEpisodes: (episodes: ComicEpisode[]) => void;
    updateEpisode: (id: string, patch: Partial<Omit<ComicEpisode, "id" | "number">>) => void;
    selectEpisode: (id: string) => void;
    setCharacters: (characters: ComicCharacter[]) => void;
    addCharacter: () => void;
    updateCharacter: (id: string, patch: Partial<Omit<ComicCharacter, "id">>) => void;
    removeCharacter: (id: string) => void;
    addMessage: (message: Omit<ComicChatMessage, "id" | "createdAt">) => void;
    clearMessages: () => void;
    setShots: (shots: ComicShot[]) => void;
    addShot: (episodeId?: string, afterId?: string) => string;
    updateShot: (id: string, patch: Partial<Omit<ComicShot, "id" | "episodeId">>) => void;
    removeShot: (id: string) => void;
    duplicateShot: (id: string) => void;
    reorderShots: (episodeId: string, orderedIds: string[]) => void;
    selectShot: (id: string) => void;
    addCanvasNode: (node: Omit<ComicCanvasNode, "id">) => string;
    updateCanvasNode: (id: string, patch: Partial<Omit<ComicCanvasNode, "id" | "episodeId">>) => void;
    removeCanvasNode: (id: string) => void;
    selectCanvasNode: (id: string) => void;
    addCanvasConnection: (episodeId: string, fromId: string, toId: string) => void;
    removeCanvasConnection: (id: string) => void;
    setStoryboardViewport: (viewport: ComicViewport) => void;
    upsertPanorama: (panorama: ComicPanorama) => void;
    updatePanorama: (id: string, patch: Partial<Omit<ComicPanorama, "id" | "episodeId">>) => void;
    upsertDirectorScene: (scene: ComicDirectorScene) => void;
    addDirectorItem: (episodeId: string, type: ComicDirectorItem["type"]) => string;
    updateDirectorItem: (episodeId: string, id: string, patch: Partial<Omit<ComicDirectorItem, "id">>) => void;
    removeDirectorItem: (episodeId: string, id: string) => void;
    addPromptPreset: (preset: Omit<ComicPromptPreset, "id">) => void;
    removePromptPreset: (id: string) => void;
    replaceVisualState: (visual: Partial<ComicVisualState>) => void;
    replaceProject: (project: Partial<ComicProjectState>) => void;
    resetProject: () => void;
};

const COMIC_STORE_KEY = "aikart:comic_workbench_v1";

const initialSource = "维修学徒林默在一次停电事故后，发现自己能看见旧物残留的记忆。他从一台被送修的银色收音机里听见了三年前失踪姐姐的声音，并被卷入一场围绕城市地下实验室的追查。";

const initialCharacters: ComicCharacter[] = [
    { id: "character-linmo", name: "林默", role: "男主角", description: "22 岁维修学徒，外冷内热，能读取旧物记忆。" },
    { id: "character-suyue", name: "苏玥", role: "搭档", description: "调查记者，行动果断，擅长从细节中寻找线索。" },
    { id: "character-linxia", name: "林夏", role: "关键人物", description: "林默失踪三年的姐姐，似乎仍在通过收音机传递信息。" },
];

const episodeBeats = [
    ["收音机里的声音", "林默修复一台银色收音机，意外听见失踪姐姐的求救声。", "声音最后留下了一串只属于姐弟二人的数字暗号。"],
    ["被抹去的维修单", "林默与苏玥追查收音机来源，却发现所有维修记录都被人为删除。", "监控里出现一个本不该存在的林夏身影。"],
    ["午夜站台", "暗号指向废弃地铁站，两人在封闭站台发现通往地下的旧电梯。", "电梯门打开时，收音机突然开始倒计时。"],
    ["记忆实验室", "林默读取实验器材的记忆，得知姐姐曾主动参与一项感知实验。", "实验记录显示林默才是最初的实验对象。"],
    ["真假来电", "两个自称林夏的人同时联系林默，并给出完全相反的逃生路线。", "苏玥发现其中一个声音来自未来七分钟。"],
    ["第零号房间", "林默闯入封存的第零号房间，准备直面能力与姐姐失踪的真相。", "门后坐着的不是林夏，而是另一个林默。"],
] as const;

const defaultCamera: ComicShotCamera = {
    shotSize: "中景",
    angle: "平视",
    movement: "固定",
    camera: "电影摄影机",
    lens: "标准镜头",
    focalLength: 50,
    aperture: 4,
};

const builtinPromptPresets: ComicPromptPreset[] = [
    { id: "preset-cinematic", name: "电影质感", category: "风格", prompt: "cinematic storyboard, dramatic lighting, coherent character design, high detail", builtin: true },
    { id: "preset-continuity", name: "角色一致", category: "连续性", prompt: "same character appearance, same costume, consistent face and proportions across shots", builtin: true },
    { id: "preset-anime", name: "精致漫剧", category: "风格", prompt: "premium animated drama frame, expressive acting, clean linework, polished color grading", builtin: true },
    { id: "preset-no-text", name: "画面无字", category: "质量", prompt: "no text, no subtitles, no logo, no watermark", builtin: true },
];

export function createComicEpisodes(count: number, existing: ComicEpisode[] = []) {
    return Array.from({ length: Math.max(1, Math.min(30, count)) }, (_, index) => {
        const current = existing[index];
        if (current) return { ...current, number: index + 1 };
        const beat = episodeBeats[index % episodeBeats.length];
        const cycle = Math.floor(index / episodeBeats.length) + 1;
        return {
            id: nanoid(),
            number: index + 1,
            title: cycle === 1 ? beat[0] : `${beat[0]} ${cycle}`,
            summary: beat[1],
            hook: beat[2],
            script: index === 0 ? createLocalEpisodeScript(index + 1, beat[0], beat[1], beat[2]) : "",
        };
    });
}

export function createLocalEpisodeScript(number: number, title: string, summary: string, hook: string) {
    return [
        `第 ${number} 集《${title || `未命名第 ${number} 集`}》`,
        "",
        "【场景一｜内景｜夜】",
        `画面：${summary || "主角在安静的房间里发现一条改变命运的线索。"}`,
        "旁白：有些真相从不消失，它们只是等待一个人重新听见。",
        "主角：（压低声音）这不可能……除非有人一直在等我。",
        "",
        "【场景二｜近景｜连续】",
        "画面：镜头缓慢推近关键物件，环境声骤然消失，只剩急促的呼吸声。",
        "搭档：别碰它，我们还不知道这是谁留下的。",
        "主角：我认识这个记号。只有她会这样写。",
        "",
        "【结尾钩子】",
        hook || "画面在新的危险出现前戛然而止。",
    ].join("\n");
}

export function createShot(episodeId: string, order: number, patch: Partial<ComicShot> = {}): ComicShot {
    return {
        id: patch.id || nanoid(),
        episodeId,
        order,
        title: patch.title || `镜头 ${order}`,
        description: patch.description || "补充画面动作与构图",
        dialogue: patch.dialogue || "",
        prompt: patch.prompt || "",
        negativePrompt: patch.negativePrompt || "文字、水印、变形、重复人物、低清晰度",
        duration: patch.duration || 3,
        notes: patch.notes || "",
        position: patch.position || shotPosition(order),
        imageUrl: patch.imageUrl || "",
        storageKey: patch.storageKey,
        referenceImageUrl: patch.referenceImageUrl,
        referenceStorageKey: patch.referenceStorageKey,
        status: patch.status === "loading" ? "idle" : patch.status || "idle",
        error: patch.error,
        camera: { ...defaultCamera, ...patch.camera },
        imageHistory: patch.imageHistory || [],
    };
}

export function createShotsFromEpisode(episode: ComicEpisode, existing: ComicShot[] = []) {
    const existingForEpisode = existing.filter((shot) => shot.episodeId === episode.id);
    const parsed = parseScriptBeats(episode.script || episode.summary);
    const beats = parsed.length ? parsed : [episode.summary, episode.hook].filter(Boolean);
    return beats.slice(0, 24).map((beat, index) => {
        const current = existingForEpisode[index];
        const order = index + 1;
        const description = beat.replace(/^(画面|旁白|镜头|动作)[：:]/, "").trim();
        return createShot(episode.id, order, {
            ...current,
            title: current?.title || `镜头 ${order}`,
            description: current?.description && current.description !== "补充画面动作与构图" ? current.description : description,
            prompt: current?.prompt || description,
            position: current?.position || shotPosition(order),
        });
    });
}

function parseScriptBeats(script: string) {
    return script
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^(画面|镜头|动作)[：:]/.test(line) || (line.length > 18 && !/^【/.test(line) && !/^第\s*\d+\s*集/.test(line)))
        .slice(0, 24);
}

function shotPosition(order: number) {
    const index = Math.max(0, order - 1);
    return { x: 80 + (index % 4) * 360, y: 80 + Math.floor(index / 4) * 400 };
}

function initialDirectorScene(episodeId: string): ComicDirectorScene {
    return {
        episodeId,
        mode: "flat",
        items: [],
        camera: { yaw: 0, pitch: 16, zoom: 1, fov: 50, frame: "16:9" },
        lighting: { enabled: true, intensity: 1, yaw: -35, color: "#fff1d6", ambient: 0.45 },
        gridVisible: true,
        basePrompt: "",
        snapshotHistory: [],
    };
}

function initialState(): ComicProjectState {
    const episodes = createComicEpisodes(6);
    const firstShots = createShotsFromEpisode(episodes[0]);
    return {
        projectName: "未命名漫剧",
        ratio: "16:9",
        style: "悬疑紧张",
        episodeCount: 6,
        source: initialSource,
        premise: "一名能读取旧物记忆的维修学徒，为寻找失踪姐姐，深入一座城市被掩盖的地下实验室。",
        outline: "林默从神秘收音机中获得第一条线索，与记者苏玥结伴追查；两人逐步发现感知实验、被篡改的记忆与时间错位，最终抵达第零号房间，并面对另一个自己的存在。",
        characters: initialCharacters.map((character) => ({ ...character })),
        episodes,
        selectedEpisodeId: episodes[0].id,
        activeStage: "episodes",
        messages: [{ id: "comic-welcome", role: "assistant", content: "项目草稿已准备好。你可以让我调整人物、情节、节奏或某一集对白，我会结合当前项目内容继续创作。", createdAt: Date.now() }],
        shots: firstShots,
        canvasNodes: [],
        canvasConnections: [],
        panoramas: [],
        directorScenes: [initialDirectorScene(episodes[0].id)],
        promptPresets: builtinPromptPresets,
        selectedShotId: firstShots[0]?.id || "",
        selectedCanvasNodeId: "",
        storyboardViewport: { x: 48, y: 48, k: 0.82 },
    };
}

function normalizeShotOrder(shots: ComicShot[], episodeId: string) {
    let index = 0;
    return shots.map((shot) => {
        if (shot.episodeId !== episodeId) return shot;
        index += 1;
        return { ...shot, order: index };
    });
}

export const useComicStore = create<ComicStore>()(
    persist(
        (set, get) => ({
            ...initialState(),
            setProjectField: (key, value) => set({ [key]: value } as Partial<ComicProjectState>),
            setEpisodeCount: (count) => set((state) => {
                const episodeCount = Math.max(1, Math.min(30, count));
                const episodes = createComicEpisodes(episodeCount, state.episodes);
                return { episodeCount, episodes, selectedEpisodeId: episodes.some((episode) => episode.id === state.selectedEpisodeId) ? state.selectedEpisodeId : episodes[0].id };
            }),
            setActiveStage: (activeStage) => set({ activeStage }),
            setEpisodes: (episodes) => set((state) => ({ episodes: episodes.map((episode, index) => ({ ...episode, number: index + 1 })), episodeCount: episodes.length, selectedEpisodeId: episodes.some((episode) => episode.id === state.selectedEpisodeId) ? state.selectedEpisodeId : episodes[0]?.id || "" })),
            updateEpisode: (id, patch) => set((state) => ({ episodes: state.episodes.map((episode) => (episode.id === id ? { ...episode, ...patch } : episode)) })),
            selectEpisode: (selectedEpisodeId) => set((state) => {
                const episodeShots = state.shots.filter((shot) => shot.episodeId === selectedEpisodeId);
                return { selectedEpisodeId, selectedShotId: episodeShots.some((shot) => shot.id === state.selectedShotId) ? state.selectedShotId : episodeShots[0]?.id || "", selectedCanvasNodeId: "" };
            }),
            setCharacters: (characters) => set({ characters }),
            addCharacter: () => set((state) => ({ characters: [...state.characters, { id: nanoid(), name: "新角色", role: "配角", description: "补充角色设定" }] })),
            updateCharacter: (id, patch) => set((state) => ({ characters: state.characters.map((character) => (character.id === id ? { ...character, ...patch } : character)) })),
            removeCharacter: (id) => set((state) => ({ characters: state.characters.filter((character) => character.id !== id) })),
            addMessage: (message) => set((state) => ({ messages: [...state.messages, { ...message, id: nanoid(), createdAt: Date.now() }].slice(-50) })),
            clearMessages: () => set({ messages: [] }),
            setShots: (shots) => set({ shots }),
            addShot: (episodeId = get().selectedEpisodeId, afterId) => {
                const id = nanoid();
                set((state) => {
                    const episodeShots = state.shots.filter((shot) => shot.episodeId === episodeId);
                    const insertIndex = afterId ? Math.max(0, episodeShots.findIndex((shot) => shot.id === afterId) + 1) : episodeShots.length;
                    const nextShot = createShot(episodeId, insertIndex + 1, { id });
                    const otherShots = state.shots.filter((shot) => shot.episodeId !== episodeId);
                    const nextEpisodeShots = [...episodeShots.slice(0, insertIndex), nextShot, ...episodeShots.slice(insertIndex)].map((shot, index) => ({ ...shot, order: index + 1 }));
                    return { shots: [...otherShots, ...nextEpisodeShots], selectedShotId: id };
                });
                return id;
            },
            updateShot: (id, patch) => set((state) => ({ shots: state.shots.map((shot) => (shot.id === id ? { ...shot, ...patch, camera: patch.camera ? { ...shot.camera, ...patch.camera } : shot.camera } : shot)) })),
            removeShot: (id) => set((state) => {
                const target = state.shots.find((shot) => shot.id === id);
                const shots = target ? normalizeShotOrder(state.shots.filter((shot) => shot.id !== id), target.episodeId) : state.shots;
                return { shots, selectedShotId: state.selectedShotId === id ? shots.find((shot) => shot.episodeId === target?.episodeId)?.id || "" : state.selectedShotId };
            }),
            duplicateShot: (id) => set((state) => {
                const target = state.shots.find((shot) => shot.id === id);
                if (!target) return state;
                const episodeShots = state.shots.filter((shot) => shot.episodeId === target.episodeId);
                const index = episodeShots.findIndex((shot) => shot.id === id);
                const copy = { ...target, id: nanoid(), title: `${target.title} 副本`, imageHistory: [...target.imageHistory], position: { x: target.position.x + 34, y: target.position.y + 34 }, status: "idle" as const };
                const nextEpisodeShots = [...episodeShots.slice(0, index + 1), copy, ...episodeShots.slice(index + 1)].map((shot, shotIndex) => ({ ...shot, order: shotIndex + 1 }));
                return { shots: [...state.shots.filter((shot) => shot.episodeId !== target.episodeId), ...nextEpisodeShots], selectedShotId: copy.id };
            }),
            reorderShots: (episodeId, orderedIds) => set((state) => {
                const byId = new Map(state.shots.filter((shot) => shot.episodeId === episodeId).map((shot) => [shot.id, shot]));
                const ordered = orderedIds.map((id) => byId.get(id)).filter((shot): shot is ComicShot => Boolean(shot));
                byId.forEach((shot) => { if (!ordered.some((item) => item.id === shot.id)) ordered.push(shot); });
                return { shots: [...state.shots.filter((shot) => shot.episodeId !== episodeId), ...ordered.map((shot, index) => ({ ...shot, order: index + 1 }))] };
            }),
            selectShot: (selectedShotId) => set({ selectedShotId, selectedCanvasNodeId: "" }),
            addCanvasNode: (node) => {
                const id = nanoid();
                set((state) => ({ canvasNodes: [...state.canvasNodes, { ...node, id }], selectedCanvasNodeId: id, selectedShotId: "" }));
                return id;
            },
            updateCanvasNode: (id, patch) => set((state) => ({ canvasNodes: state.canvasNodes.map((node) => node.id === id ? { ...node, ...patch } : node) })),
            removeCanvasNode: (id) => set((state) => ({ canvasNodes: state.canvasNodes.filter((node) => node.id !== id), canvasConnections: state.canvasConnections.filter((connection) => connection.fromId !== id && connection.toId !== id), selectedCanvasNodeId: state.selectedCanvasNodeId === id ? "" : state.selectedCanvasNodeId })),
            selectCanvasNode: (selectedCanvasNodeId) => set({ selectedCanvasNodeId, selectedShotId: "" }),
            addCanvasConnection: (episodeId, fromId, toId) => set((state) => state.canvasConnections.some((item) => item.fromId === fromId && item.toId === toId) || fromId === toId ? state : { canvasConnections: [...state.canvasConnections, { id: nanoid(), episodeId, fromId, toId }] }),
            removeCanvasConnection: (id) => set((state) => ({ canvasConnections: state.canvasConnections.filter((connection) => connection.id !== id) })),
            setStoryboardViewport: (storyboardViewport) => set({ storyboardViewport }),
            upsertPanorama: (panorama) => set((state) => ({ panoramas: [panorama, ...state.panoramas.filter((item) => item.id !== panorama.id)] })),
            updatePanorama: (id, patch) => set((state) => ({ panoramas: state.panoramas.map((panorama) => panorama.id === id ? { ...panorama, ...patch } : panorama) })),
            upsertDirectorScene: (scene) => set((state) => ({ directorScenes: [scene, ...state.directorScenes.filter((item) => item.episodeId !== scene.episodeId)] })),
            addDirectorItem: (episodeId, type) => {
                const id = nanoid();
                set((state) => {
                    const scene = state.directorScenes.find((item) => item.episodeId === episodeId) || initialDirectorScene(episodeId);
                    const count = scene.items.length;
                    const item: ComicDirectorItem = { id, type, label: type === "person" ? `角色 ${count + 1}` : type === "object" ? `道具 ${count + 1}` : `场景 ${count + 1}`, x: 32 + (count % 4) * 18, y: 38 + Math.floor(count / 4) * 16, z: 0, rotation: 0, scale: 1, color: type === "person" ? "#59b5c8" : type === "object" ? "#efa86a" : "#8c9fb2", action: "" };
                    return { directorScenes: [{ ...scene, items: [...scene.items, item] }, ...state.directorScenes.filter((entry) => entry.episodeId !== episodeId)] };
                });
                return id;
            },
            updateDirectorItem: (episodeId, id, patch) => set((state) => ({ directorScenes: state.directorScenes.map((scene) => scene.episodeId === episodeId ? { ...scene, items: scene.items.map((item) => item.id === id ? { ...item, ...patch } : item) } : scene) })),
            removeDirectorItem: (episodeId, id) => set((state) => ({ directorScenes: state.directorScenes.map((scene) => scene.episodeId === episodeId ? { ...scene, items: scene.items.filter((item) => item.id !== id) } : scene) })),
            addPromptPreset: (preset) => set((state) => ({ promptPresets: [...state.promptPresets, { ...preset, id: nanoid() }] })),
            removePromptPreset: (id) => set((state) => ({ promptPresets: state.promptPresets.filter((preset) => preset.id !== id || preset.builtin) })),
            replaceVisualState: (visual) => set((state) => ({ ...state, ...visual })),
            replaceProject: (project) => set((state) => ({ ...state, ...project })),
            resetProject: () => set(initialState()),
        }),
        {
            name: COMIC_STORE_KEY,
            storage: createJSONStorage(() => localForageStorage),
            merge: (persisted, current) => {
                const saved = persisted as Partial<ComicProjectState>;
                return {
                    ...current,
                    ...saved,
                    shots: (saved.shots || current.shots).map((shot) => createShot(shot.episodeId, shot.order, shot)),
                    canvasNodes: saved.canvasNodes || [],
                    canvasConnections: saved.canvasConnections || [],
                    panoramas: saved.panoramas || [],
                    directorScenes: saved.directorScenes || current.directorScenes,
                    promptPresets: saved.promptPresets?.length ? saved.promptPresets : current.promptPresets,
                    storyboardViewport: saved.storyboardViewport || current.storyboardViewport,
                } as ComicStore;
            },
            partialize: (state) => ({
                projectName: state.projectName,
                ratio: state.ratio,
                style: state.style,
                episodeCount: state.episodeCount,
                source: state.source,
                premise: state.premise,
                outline: state.outline,
                characters: state.characters,
                episodes: state.episodes,
                selectedEpisodeId: state.selectedEpisodeId,
                activeStage: state.activeStage,
                messages: state.messages,
                shots: state.shots,
                canvasNodes: state.canvasNodes,
                canvasConnections: state.canvasConnections,
                panoramas: state.panoramas,
                directorScenes: state.directorScenes,
                promptPresets: state.promptPresets,
                selectedShotId: state.selectedShotId,
                selectedCanvasNodeId: state.selectedCanvasNodeId,
                storyboardViewport: state.storyboardViewport,
            }),
        },
    ),
);
