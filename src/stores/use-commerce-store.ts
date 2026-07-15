import { nanoid } from "nanoid";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CommerceKitVariant, CommerceMaterialType, CommerceOutputType, CommercePlatform, CommerceTextLanguage } from "@/lib/commerce-specs";
import type { ReferenceImage } from "@/types/image";

export type CommercePrompt = { intro: string; chinese: string; english: string };
export type CommerceResult = {
    id: string;
    dataUrl: string;
    storageKey?: string;
    width?: number;
    height?: number;
    bytes?: number;
    mimeType?: string;
    materialType?: CommerceMaterialType;
    platform?: CommercePlatform;
    language?: CommerceTextLanguage;
    size?: string;
    model?: string;
    prompt?: string;
    serverMediaId?: string;
};

export type CommerceHistory = {
    id: string;
    createdAt: number;
    title: string;
    prompt: string;
    results: CommerceResult[];
};

export type CommerceRole = {
    id: string;
    name: string;
    summary: string;
    systemPrompt: string;
    accent: string;
    avatarUrl?: string;
    avatarStorageKey?: string;
    builtIn?: boolean;
};

const commerceDetailImageSkill = [
    "已启用 SkillHub 技能：scdsxqt（生成电商详情图）。",
    "工作职责：分析参考商品图，提取品牌、品类、规格、卖点、主色、材质、目标人群和包装亮点；生成主图、详情图、场景图和跨境电商素材的可执行提示词。",
    "硬性规则：完整还原商品外观、包装、Logo、颜色、结构和原有文字；保持材质真实、光影统一、版式整洁；根据素材类型匹配比例：主图 1:1，详情图 2:3，广告图 9:16，场景图 1:1。",
    "输出规则：中文方案要包含构图、商品位置、光线、材质和文案布局；英文生图提示词必须只使用英文，不得混入中文、标题、解释或 Markdown；主动消除重复句、重复标签和无效描述。",
].join("\n");

const marketingImageSkill = [
    "已启用 SkillHub 技能：hanis-marketing-image（营销图 UI 设计专家）。",
    "工作职责：为电商营销图、详情页 Banner、活动海报、社媒配图和品牌宣传图设计统一的视觉方案与版式。",
    "设计规则：先判断平台和场景，再匹配尺寸与布局；产品主图优先 1:1，详情 Banner 使用横向版式，营销海报和社媒封面使用 3:4、9:16 或平台对应规格；明确主体、背景、前景、色彩、CTA 和信息层级。",
    "默认使用中文文案，除非用户明确指定其他语言；保持品牌色、Logo 和商品真实性；避免杂乱排版、低对比度、乱码和重复信息。只输出设计规则和提示词，不调用技能包内的外部 API 或脚本。",
].join("\n");

export const builtInCommerceRoles: CommerceRole[] = [
    {
        id: "poster-master",
        name: "电商详情图专家",
        summary: "商品识别、主图详情图与多规格电商素材",
        systemPrompt: `你是一位专业电商详情图专家，负责把商品参考图和卖点转化为可直接执行的主图、详情图、场景图与跨境电商提示词。\n${commerceDetailImageSkill}`,
        accent: "#ef6f91",
        builtIn: true,
    },
    {
        id: "creative-master",
        name: "营销图 UI 设计专家",
        summary: "营销海报、详情 Banner 与平台视觉版式",
        systemPrompt: `你是一位营销图 UI 设计专家，负责为商品和品牌设计可投放的营销图、详情 Banner、活动海报和社媒配图。\n${marketingImageSkill}`,
        accent: "#f59e62",
        builtIn: true,
    },
    {
        id: "photo-master",
        name: "人像写实大师",
        summary: "真实人物、自然姿态与商业质感",
        systemPrompt: "你是一位商业人像摄影师，擅长自然可信的人物表现、皮肤质感、镜头语言和商品互动。人物必须服务于商品展示，不遮挡核心卖点。",
        accent: "#4f8fd8",
        builtIn: true,
    },
    {
        id: "conversion-master",
        name: "营销转化设计师",
        summary: "围绕受众、利益点和购买决策设计画面",
        systemPrompt: "你是一位增长导向的电商设计师，擅长把用户痛点、产品利益点和购买理由转化成高点击、高转化的商品视觉。",
        accent: "#8b7ad8",
        builtIn: true,
    },
    {
        id: "jewelry-master",
        name: "珠宝产品摄影师",
        summary: "高级材质、微距细节与奢侈品质感",
        systemPrompt: "你是一位珠宝与奢侈品静物摄影师，擅长金属、宝石和玻璃材质，强调微距细节、受控高光、干净背景和高级商业氛围。",
        accent: "#b59652",
        builtIn: true,
    },
    {
        id: "beauty-master",
        name: "美妆主图设计师",
        summary: "护肤彩妆、成分表达与清透视觉",
        systemPrompt: "你是一位美妆品牌视觉设计师，擅长护肤和彩妆商品主图。画面应清透、精致、可信，准确表现包装、材质、成分联想和目标人群。",
        accent: "#53a99c",
        builtIn: true,
    },
];

type CommerceStore = {
    hydrated: boolean;
    customRoles: CommerceRole[];
    selectedRoleId: string;
    description: string;
    productImage: ReferenceImage[];
    promptResult: CommercePrompt | null;
    activePrompt: "chinese" | "english";
    outputType: CommerceOutputType;
    platform: CommercePlatform;
    textLanguage: CommerceTextLanguage;
    kitVariants: CommerceKitVariant[];
    results: CommerceResult[];
    history: CommerceHistory[];
    addRole: (role: Omit<CommerceRole, "id" | "builtIn">) => string;
    updateRole: (id: string, patch: Partial<Omit<CommerceRole, "id" | "builtIn">>) => void;
    removeRole: (id: string) => void;
    selectRole: (id: string) => void;
    setDescription: (description: string) => void;
    setProductImage: (productImage: ReferenceImage[] | ReferenceImage | null | ((current: ReferenceImage[]) => ReferenceImage[])) => void;
    setPromptResult: (promptResult: CommercePrompt | null) => void;
    setActivePrompt: (activePrompt: "chinese" | "english") => void;
    setOutputType: (outputType: CommerceOutputType) => void;
    setPlatform: (platform: CommercePlatform) => void;
    setTextLanguage: (textLanguage: CommerceTextLanguage) => void;
    setKitVariants: (kitVariants: CommerceKitVariant[]) => void;
    setResults: (results: CommerceResult[] | ((results: CommerceResult[]) => CommerceResult[])) => void;
    addHistory: (entry: CommerceHistory) => void;
    setHistory: (history: CommerceHistory[]) => void;
    removeHistory: (id: string) => void;
    clearHistory: () => void;
    clearSession: () => void;
};

const COMMERCE_STORE_KEY = "aikart:commerce_workbench";

export const useCommerceStore = create<CommerceStore>()(
    persist(
        (set) => ({
            hydrated: false,
            customRoles: [],
            selectedRoleId: builtInCommerceRoles[0].id,
            description: "",
            productImage: [],
            promptResult: null,
            activePrompt: "chinese",
            outputType: "main",
            platform: "auto",
            textLanguage: "none",
            kitVariants: ["scene", "selling-point", "close-up", "a-plus"],
            results: [],
            history: [],
            addRole: (role) => {
                const id = nanoid();
                set((state) => ({ customRoles: [...state.customRoles, { ...role, id, builtIn: false }], selectedRoleId: id }));
                return id;
            },
            updateRole: (id, patch) => set((state) => ({ customRoles: state.customRoles.map((role) => (role.id === id ? { ...role, ...patch } : role)) })),
            removeRole: (id) =>
                set((state) => ({
                    customRoles: state.customRoles.filter((role) => role.id !== id),
                    selectedRoleId: state.selectedRoleId === id ? builtInCommerceRoles[0].id : state.selectedRoleId,
                })),
            selectRole: (selectedRoleId) => set({ selectedRoleId }),
            setDescription: (description) => set({ description, promptResult: null }),
            setProductImage: (productImage) => set((state) => ({ productImage: typeof productImage === "function" ? productImage(state.productImage) : Array.isArray(productImage) ? productImage : productImage ? [productImage] : [], promptResult: null })),
            setPromptResult: (promptResult) => set({ promptResult }),
            setActivePrompt: (activePrompt) => set({ activePrompt }),
            setOutputType: (outputType) => set({ outputType, promptResult: null }),
            setPlatform: (platform) => set({ platform, promptResult: null }),
            setTextLanguage: (textLanguage) => set({ textLanguage, promptResult: null }),
            setKitVariants: (kitVariants) => set({ kitVariants }),
            setResults: (results) => set((state) => ({ results: typeof results === "function" ? results(state.results) : results })),
            addHistory: (entry) => set((state) => ({ history: [entry, ...state.history.filter((item) => item.id !== entry.id)].sort((a, b) => b.createdAt - a.createdAt).slice(0, 30) })),
            setHistory: (history) => set({ history: [...history].sort((a, b) => b.createdAt - a.createdAt) }),
            removeHistory: (id) => set((state) => ({ history: state.history.filter((item) => item.id !== id) })),
            clearHistory: () => set({ history: [] }),
            clearSession: () => set({ description: "", productImage: [], promptResult: null, activePrompt: "chinese", outputType: "main", platform: "auto", textLanguage: "none", kitVariants: ["scene", "selling-point", "close-up", "a-plus"], results: [] }),
        }),
        {
            name: COMMERCE_STORE_KEY,
            partialize: (state) => ({
                customRoles: state.customRoles.map((role) => ({ ...role, avatarUrl: persistentImageUrl(role.avatarUrl, role.avatarStorageKey) })),
                selectedRoleId: state.selectedRoleId,
                description: state.description,
                productImage: state.productImage.map((image) => ({ ...image, dataUrl: persistentImageUrl(image.dataUrl, image.storageKey) })),
                promptResult: state.promptResult,
                activePrompt: state.activePrompt,
                outputType: state.outputType,
                platform: state.platform,
                textLanguage: state.textLanguage,
                kitVariants: state.kitVariants,
                results: state.results.map((result) => ({ ...result, dataUrl: persistentImageUrl(result.dataUrl, result.storageKey) })),
                history: state.history.map((entry) => ({ ...entry, results: entry.results.map((result) => ({ ...result, dataUrl: persistentImageUrl(result.dataUrl, result.storageKey) })) })),
            }),
            onRehydrateStorage: () => () => {
                useCommerceStore.setState({ hydrated: true });
            },
            merge: (persisted, current) => {
                const saved = (persisted || {}) as Partial<CommerceStore> & { productImage?: ReferenceImage | ReferenceImage[] | null };
                return {
                    ...current,
                    ...saved,
                    productImage: Array.isArray(saved.productImage) ? saved.productImage : saved.productImage ? [saved.productImage] : [],
                    history: Array.isArray(saved.history) ? [...saved.history].sort((a, b) => b.createdAt - a.createdAt) : [],
                };
            },
        },
    ),
);

export function allCommerceRoles(customRoles: CommerceRole[]) {
    return [...builtInCommerceRoles, ...customRoles];
}

function persistentImageUrl(url = "", storageKey?: string) {
    return storageKey && url.startsWith("blob:") ? "" : url;
}
