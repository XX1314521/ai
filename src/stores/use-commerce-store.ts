import { nanoid } from "nanoid";
import { create } from "zustand";
import { persist } from "zustand/middleware";

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

export const builtInCommerceRoles: CommerceRole[] = [
    {
        id: "poster-master",
        name: "电商海报设计大师",
        summary: "商品主图、活动海报和详情页视觉策划",
        systemPrompt: "你是一位专业电商视觉总监，擅长淘宝、天猫、京东商品主图与营销海报。输出必须突出真实商品、清晰卖点、商业构图、平台转化率和可执行的摄影灯光细节。",
        accent: "#ef6f91",
        builtIn: true,
    },
    {
        id: "creative-master",
        name: "图片创意大师",
        summary: "概念创意、视觉冲击和品牌记忆点",
        systemPrompt: "你是一位商业广告创意总监，擅长从产品卖点提炼视觉概念。方案要新颖但可落地，兼顾品牌识别、画面层级和商品真实性。",
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
    productImage: ReferenceImage | null;
    promptResult: CommercePrompt | null;
    activePrompt: "chinese" | "english";
    results: CommerceResult[];
    addRole: (role: Omit<CommerceRole, "id" | "builtIn">) => string;
    updateRole: (id: string, patch: Partial<Omit<CommerceRole, "id" | "builtIn">>) => void;
    removeRole: (id: string) => void;
    selectRole: (id: string) => void;
    setDescription: (description: string) => void;
    setProductImage: (productImage: ReferenceImage | null) => void;
    setPromptResult: (promptResult: CommercePrompt | null) => void;
    setActivePrompt: (activePrompt: "chinese" | "english") => void;
    setResults: (results: CommerceResult[] | ((results: CommerceResult[]) => CommerceResult[])) => void;
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
            productImage: null,
            promptResult: null,
            activePrompt: "chinese",
            results: [],
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
            setDescription: (description) => set({ description }),
            setProductImage: (productImage) => set({ productImage }),
            setPromptResult: (promptResult) => set({ promptResult }),
            setActivePrompt: (activePrompt) => set({ activePrompt }),
            setResults: (results) => set((state) => ({ results: typeof results === "function" ? results(state.results) : results })),
            clearSession: () => set({ description: "", productImage: null, promptResult: null, activePrompt: "chinese", results: [] }),
        }),
        {
            name: COMMERCE_STORE_KEY,
            partialize: (state) => ({
                customRoles: state.customRoles.map((role) => ({ ...role, avatarUrl: persistentImageUrl(role.avatarUrl, role.avatarStorageKey) })),
                selectedRoleId: state.selectedRoleId,
                description: state.description,
                productImage: state.productImage ? { ...state.productImage, dataUrl: persistentImageUrl(state.productImage.dataUrl, state.productImage.storageKey) } : null,
                promptResult: state.promptResult,
                activePrompt: state.activePrompt,
                results: state.results.map((result) => ({ ...result, dataUrl: persistentImageUrl(result.dataUrl, result.storageKey) })),
            }),
            onRehydrateStorage: () => () => {
                useCommerceStore.setState({ hydrated: true });
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
