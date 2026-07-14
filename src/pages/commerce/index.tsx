import {
    Bot,
    Check,
    ChevronRight,
    Copy,
    Download,
    FileArchive,
    FolderPlus,
    Globe2,
    HelpCircle,
    Image as ImageIcon,
    Layers3,
    Languages,
    LayoutTemplate,
    LoaderCircle,
    Pencil,
    Plus,
    RefreshCw,
    ShoppingBag,
    Sparkles,
    Trash2,
    Upload,
    UserRound,
    UsersRound,
    WandSparkles,
    X,
} from "lucide-react";
import { App, Button, Image, Input, Modal, Tabs, Tooltip, Tour, type TourProps } from "antd";
import { saveAs } from "file-saver";
import { nanoid } from "nanoid";
import { useEffect, useMemo, useRef, useState } from "react";

import { ModelPicker } from "@/components/model-picker";
import {
    commerceKitOptions,
    commerceKitPrompt,
    commerceLanguageOptions,
    commerceMaterialLabel,
    commerceOutputLabel,
    commerceOutputOptions,
    commercePlatformLabel,
    commercePlatformOptions,
    commerceRatioOptions,
    commerceSpecPrompt,
    recommendedCommerceRatio,
    resolveCommerceRatio,
    resolveCommerceRequestSize,
    supportedCommerceRatios,
    type CommerceKitVariant,
    type CommerceOutputType,
    type CommercePlatform,
    type CommerceTextLanguage,
} from "@/lib/commerce-specs";
import { createZip } from "@/lib/zip";
import { requestEdit, requestGeneration, requestImageQuestion } from "@/services/api/image";
import { imageToDataUrl, resolveImageUrl, uploadImage } from "@/services/image-storage";
import { allCommerceRoles, type CommerceHistory, type CommercePrompt, type CommerceResult, type CommerceRole, useCommerceStore } from "@/stores/use-commerce-store";
import { useAssetStore } from "@/stores/use-asset-store";
import { useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import type { ReferenceImage } from "@/types/image";
import { CommerceSelect } from "./commerce-select";
import { CommerceSpecEditor } from "./commerce-spec-editor";

type RoleDraft = Pick<CommerceRole, "name" | "summary" | "systemPrompt" | "accent" | "avatarUrl" | "avatarStorageKey">;

const initialRoleDraft: RoleDraft = { name: "", summary: "", systemPrompt: "", accent: "#36a7b7" };
const isImageFile = (file: File) => file.type.startsWith("image/") || /\.(avif|bmp|gif|jpe?g|png|webp)$/i.test(file.name);
const COMMERCE_TOUR_KEY = "aikart:commerce_tour_v1";

export default function CommercePage() {
    const { message } = App.useApp();
    const productInputRef = useRef<HTMLInputElement>(null);
    const roleStripRef = useRef<HTMLElement>(null);
    const uploadRef = useRef<HTMLDivElement>(null);
    const outputTabsRef = useRef<HTMLDivElement>(null);
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const settingsRef = useRef<HTMLDivElement>(null);
    const actionsRef = useRef<HTMLDivElement>(null);
    const kitRef = useRef<HTMLElement>(null);
    const config = useConfigStore((state) => state.config);
    const effectiveConfig = useEffectiveConfig();
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const customRoles = useCommerceStore((state) => state.customRoles);
    const selectedRoleId = useCommerceStore((state) => state.selectedRoleId);
    const selectRole = useCommerceStore((state) => state.selectRole);
    const commerceHydrated = useCommerceStore((state) => state.hydrated);
    const description = useCommerceStore((state) => state.description);
    const setDescription = useCommerceStore((state) => state.setDescription);
    const productImage = useCommerceStore((state) => state.productImage);
    const setProductImage = useCommerceStore((state) => state.setProductImage);
    const promptResult = useCommerceStore((state) => state.promptResult);
    const setPromptResult = useCommerceStore((state) => state.setPromptResult);
    const activePrompt = useCommerceStore((state) => state.activePrompt);
    const setActivePrompt = useCommerceStore((state) => state.setActivePrompt);
    const outputType = useCommerceStore((state) => state.outputType) || "main";
    const setOutputType = useCommerceStore((state) => state.setOutputType);
    const platform = useCommerceStore((state) => state.platform) || "auto";
    const setPlatform = useCommerceStore((state) => state.setPlatform);
    const textLanguage = useCommerceStore((state) => state.textLanguage) || "none";
    const setTextLanguage = useCommerceStore((state) => state.setTextLanguage);
    const kitVariants = useCommerceStore((state) => state.kitVariants || ["scene", "selling-point", "close-up", "a-plus"]);
    const setKitVariants = useCommerceStore((state) => state.setKitVariants);
    const results = useCommerceStore((state) => state.results);
    const setResults = useCommerceStore((state) => state.setResults);
    const history = useCommerceStore((state) => state.history || []);
    const addHistory = useCommerceStore((state) => state.addHistory);
    const setHistory = useCommerceStore((state) => state.setHistory);
    const removeHistory = useCommerceStore((state) => state.removeHistory);
    const addAsset = useAssetStore((state) => state.addAsset);
    const roles = useMemo(() => allCommerceRoles(customRoles), [customRoles]);
    const selectedRole = roles.find((role) => role.id === selectedRoleId) || roles[0];
    const [roleManagerOpen, setRoleManagerOpen] = useState(false);
    const [assistantOpen, setAssistantOpen] = useState(false);
    const [specEditorOpen, setSpecEditorOpen] = useState(false);
    const [promptRunning, setPromptRunning] = useState(false);
    const [aiWriting, setAiWriting] = useState(false);
    const [pendingJobs, setPendingJobs] = useState<Array<{ id: string; mode: "single" | "kit"; labels: string[] }>>([]);
    const [generationMode, setGenerationMode] = useState<"single" | "kit" | null>(null);
    const [previewImage, setPreviewImage] = useState<CommerceResult | null>(null);
    const [productUploading, setProductUploading] = useState(false);
    const [pendingProductImage, setPendingProductImage] = useState<ReferenceImage | null>(null);
    const [tourOpen, setTourOpen] = useState(false);
    const [tourCurrent, setTourCurrent] = useState(0);
    const latestVisibleJobRef = useRef("");

    const imageModel = effectiveConfig.imageModel || effectiveConfig.model;
    const textModel = effectiveConfig.textModel || effectiveConfig.model;
    const supportedRatios = useMemo(() => supportedCommerceRatios(effectiveConfig, imageModel), [effectiveConfig, imageModel]);
    const ratioSelectOptions = useMemo(() => commerceRatioOptions.map((option) => ({ ...option, disabled: !supportedRatios.includes(option.value), hint: supportedRatios.includes(option.value) ? undefined : "当前模型不支持" })), [supportedRatios]);
    const countSelectOptions = useMemo(() => [1, 2, 3, 4].map((count) => ({ value: String(count), label: `${count} 张` })), []);
    const imageRunning = pendingJobs.length > 0;
    const hasSingleJob = pendingJobs.some((job) => job.mode === "single");
    const hasKitJob = pendingJobs.some((job) => job.mode === "kit");

    useEffect(() => {
        if (!commerceHydrated || window.localStorage.getItem(COMMERCE_TOUR_KEY)) return;
        const timer = window.setTimeout(() => setTourOpen(true), 450);
        return () => window.clearTimeout(timer);
    }, [commerceHydrated]);

    const closeTour = () => {
        window.localStorage.setItem(COMMERCE_TOUR_KEY, "completed");
        setTourOpen(false);
        setTourCurrent(0);
    };

    const openTour = () => {
        setRoleManagerOpen(false);
        setAssistantOpen(false);
        setSpecEditorOpen(false);
        setTourCurrent(0);
        setTourOpen(true);
    };

    const tourSteps = useMemo<TourProps["steps"]>(() => [
        { title: "选择创作角色", description: "不同角色会采用对应的电商视觉策略。你也可以创建自己的专业角色。", target: () => roleStripRef.current!, placement: "bottom" },
        { title: "上传商品图", description: "上传 JPG、PNG 或 WebP。AikArt 会保存素材，并在提示词和生图中保持商品外观一致。", target: () => uploadRef.current!, placement: "right" },
        { title: "选择素材类型", description: "主图、详情图和广告图会使用不同的构图规则，并自动推荐适合的比例。", target: () => outputTabsRef.current!, placement: "bottom" },
        { title: "描述创作需求", description: "填写商品、目标人群、卖点与画面风格。内容越具体，生成结果越稳定。", target: () => descriptionRef.current!, placement: "top" },
        { title: "设置平台与模型", description: "选择投放平台、文字语言、画面比例、张数和生图模型。不支持的比例会显示为灰色。", target: () => settingsRef.current!, placement: "top" },
        { title: "整理提示词并生图", description: "先让 AI 整理专业提示词，也可以直接生成当前选择的主图、详情图或广告图。", target: () => actionsRef.current!, placement: "top" },
        { title: "生成整套电商素材", description: "一次生成场景、卖点、特写和 A+ 多规格素材，结果可以整套下载或批量存入素材库。", target: () => kitRef.current!, placement: "top" },
    ], []);

    useEffect(() => {
        if (supportedRatios.includes(config.size)) return;
        updateConfig("size", resolveCommerceRatio(effectiveConfig, imageModel, config.size || recommendedCommerceRatio(outputType, platform)));
    }, [config.size, effectiveConfig, imageModel, outputType, platform, supportedRatios, updateConfig]);

    const changeOutputType = (value: CommerceOutputType) => {
        setOutputType(value);
        updateConfig("size", resolveCommerceRatio(effectiveConfig, imageModel, recommendedCommerceRatio(value, platform)));
    };

    const changePlatform = (value: CommercePlatform) => {
        setPlatform(value);
        updateConfig("size", resolveCommerceRatio(effectiveConfig, imageModel, recommendedCommerceRatio(outputType, value)));
    };

    const changeImageModel = (model: string) => {
        updateConfig("imageModel", model);
        updateConfig("size", resolveCommerceRatio(effectiveConfig, model, config.size || recommendedCommerceRatio(outputType, platform)));
    };

    const toggleKitVariant = (variant: CommerceKitVariant) => {
        setKitVariants(kitVariants.includes(variant) ? kitVariants.filter((item) => item !== variant) : [...kitVariants, variant]);
    };

    useEffect(() => {
        if (!commerceHydrated) return;
        if (productImage.some((image) => image.storageKey && !image.dataUrl)) {
            void Promise.all(productImage.map(async (image) => ({ ...image, dataUrl: image.storageKey ? await resolveImageUrl(image.storageKey, image.dataUrl) : image.dataUrl }))).then(setProductImage);
        }
        if (results.some((result) => result.storageKey && !result.dataUrl)) {
            void Promise.all(results.map(async (result) => ({ ...result, dataUrl: result.storageKey ? await resolveImageUrl(result.storageKey, result.dataUrl) : result.dataUrl }))).then(setResults);
        }
        if (history.some((entry) => entry.results.some((result) => result.storageKey && !result.dataUrl))) {
            void Promise.all(history.map(async (entry) => ({ ...entry, results: await Promise.all(entry.results.map(async (result) => ({ ...result, dataUrl: result.storageKey ? await resolveImageUrl(result.storageKey, result.dataUrl) : result.dataUrl }))) }))).then(setHistory);
        }
    }, [commerceHydrated]);

    const uploadProduct = async (files?: FileList | null) => {
        const selectedFiles = Array.from(files || []).filter(isImageFile);
        if (!selectedFiles.length) {
            message.warning("请选择 JPG、PNG、WebP 等图片文件");
            if (productInputRef.current) productInputRef.current.value = "";
            return;
        }

        const previewUrl = URL.createObjectURL(selectedFiles[0]);
        setPendingProductImage({ id: nanoid(), name: selectedFiles.length > 1 ? `${selectedFiles[0].name} 等 ${selectedFiles.length} 张` : selectedFiles[0].name, type: selectedFiles[0].type || "image/*", dataUrl: previewUrl });
        setPromptResult(null);
        setProductUploading(true);

        try {
            const uploaded = await Promise.all(selectedFiles.map(async (file) => {
                const stored = await uploadImage(file);
                return { id: nanoid(), name: file.name, type: stored.mimeType, dataUrl: stored.url, storageKey: stored.storageKey };
            }));
            setProductImage((current) => [...current, ...uploaded]);
            message.success(`已上传 ${uploaded.length} 张商品图`);
        } catch (error) {
            console.error("Failed to upload commerce product image", error);
            message.error(error instanceof Error ? `图片上传失败：${error.message}` : "图片上传失败，请重试");
        } finally {
            setPendingProductImage(null);
            setProductUploading(false);
            URL.revokeObjectURL(previewUrl);
            if (productInputRef.current) productInputRef.current.value = "";
        }
    };

    const aiWriteDescription = async () => {
        if (!description.trim() && !productImage.length) {
            message.warning("请先上传商品图或输入简单的商品信息");
            return;
        }
        if (!isAiConfigReady(effectiveConfig, textModel)) {
            message.warning("请先配置可用的文本模型和 API Key");
            openConfigDialog(true, "models");
            return;
        }
        setAiWriting(true);
        const requestConfig = { ...effectiveConfig, model: textModel, textModel };
        const instruction = [
            `已有商品信息：${description.trim() || "请从参考图识别商品"}`,
            commerceSpecPrompt(outputType, platform, textLanguage),
            "请将信息整理成一段 120 到 300 字的电商视觉创作要求，补齐目标人群、核心卖点、构图、场景、光线、材质和画面限制。",
            "必须保持商品、包装、Logo、颜色和结构真实；不要输出标题、列表、Markdown 或解释，只返回创作要求正文。",
        ].join("\n");
        try {
            const answer = await requestImageQuestion(
                requestConfig,
                [
                    { role: "system", content: "你是电商视觉策划助手，负责把简略商品信息整理为准确、可执行的图片创作要求。" },
                    {
                        role: "user",
                        content: productImage.length
                            ? [
                                  { type: "text", text: instruction },
                                  ...(await Promise.all(productImage.map(async (image) => ({ type: "image_url" as const, image_url: { url: await imageToDataUrl(image) } })))),
                              ]
                            : instruction,
                    },
                ],
                () => undefined,
            );
            const next = cleanPromptSection(answer, 1200);
            if (!next) throw new Error("AI 没有返回可用内容");
            setDescription(next);
            message.success("创作要求已补充");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "AI 帮写失败");
        } finally {
            setAiWriting(false);
        }
    };

    const generatePrompt = async () => {
        if (!description.trim() && !productImage.length) {
            message.error("请上传商品图或填写商品描述");
            return;
        }
        if (!isAiConfigReady(effectiveConfig, textModel)) {
            message.warning("请先配置可用的文本模型和 API Key");
            openConfigDialog(true, "models");
            return;
        }
        setAssistantOpen(true);
        setPromptRunning(true);
        setPromptResult(null);
        const productContent = description.trim() || "请根据参考商品图识别产品类别、材质和核心卖点";
        const requestConfig = { ...effectiveConfig, model: textModel, textModel };
        const instruction = [
            selectedRole.systemPrompt,
            `商品信息：${productContent}`,
            commerceSpecPrompt(outputType, platform, textLanguage),
            `画面比例：${resolveCommerceRatio(effectiveConfig, imageModel, config.size || recommendedCommerceRatio(outputType, platform))}。`,
            `请为电商${commerceOutputLabel(outputType)}生成一套可直接用于生图模型的提示词。必须保持商品外观真实，不能改变品牌、包装、颜色和结构。`,
            "内容要求：说明不超过120个中文字符；中文提示词控制在300到800个中文字符；英文提示词控制在180到450个英文单词。禁止重复句子、重复标签、重复输出同一组内容；英文提示词不得包含中文字符。",
            "只返回一个合法 JSON 对象，不要输出 Markdown、代码块或 JSON 之外的内容：",
            '{"intro":"用两到三句话说明视觉策略","chinese":"完整、具体、可直接生图的中文提示词","english":"与中文含义一致且不包含任何中文字符的专业英文提示词"}',
        ].join("\n");
        try {
            const answer = await requestImageQuestion(
                requestConfig,
                [
                    { role: "system", content: "你是 AikArt 电商视觉提示词专家，输出应专业、具体、可执行。" },
                    {
                        role: "user",
                        content: productImage.length
                            ? [
                                  { type: "text", text: instruction },
                                  ...(await Promise.all(productImage.map(async (image) => ({ type: "image_url" as const, image_url: { url: await imageToDataUrl(image) } })))),
                              ]
                            : instruction,
                    },
                ],
                () => undefined,
            );
            const parsed = parsePromptResponse(answer, productContent, selectedRole);
            if (!isEnglishPrompt(parsed.english) || parsed.english === buildEnglishFallback()) {
                const repairedEnglish = await requestImageQuestion(
                    requestConfig,
                    [
                        { role: "system", content: "You are a professional e-commerce image prompt translator. Output English only, without headings, labels, explanations, Chinese characters, or markdown." },
                        { role: "user", content: `Translate and refine this image-generation prompt into concise professional English. Preserve all product and brand details:\n\n${parsed.chinese}` },
                    ],
                    () => undefined,
                );
                parsed.english = cleanPromptSection(repairedEnglish, 3600);
                if (!isEnglishPrompt(parsed.english)) parsed.english = buildEnglishFallback();
            }
            setPromptResult(parsed);
            setActivePrompt("chinese");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "提示词生成失败");
            setAssistantOpen(false);
        } finally {
            setPromptRunning(false);
        }
    };

    const generateImages = async () => {
        const basePrompt = promptResult?.[activePrompt] || buildFallbackPrompt(description || (productImage.length ? "根据参考商品图识别产品并进行真实商业展示" : ""), selectedRole);
        const desiredRatio = config.size || recommendedCommerceRatio(outputType, platform);
        const actualRatio = resolveCommerceRatio(effectiveConfig, imageModel, desiredRatio);
        const requestSize = resolveCommerceRequestSize(effectiveConfig, imageModel, desiredRatio);
        const prompt = [basePrompt, commerceSpecPrompt(outputType, platform, textLanguage), `最终画面比例为 ${actualRatio}。`].filter(Boolean).join("\n");
        if (!prompt.trim()) {
            message.error("请先填写商品描述或生成提示词");
            return;
        }
        if (!isAiConfigReady(effectiveConfig, imageModel)) {
            message.warning("请先配置可用的生图模型和 API Key");
            openConfigDialog(true, "models");
            return;
        }
        const jobId = nanoid();
        latestVisibleJobRef.current = jobId;
        setPendingJobs((jobs) => [...jobs, { id: jobId, mode: "single", labels: [commerceOutputLabel(outputType)] }]);
        setResults([]);
        setGenerationMode("single");
        const requestConfig = { ...effectiveConfig, model: imageModel, imageModel, size: requestSize };
        try {
            const generated = productImage.length
                ? await requestEdit(requestConfig, prompt, productImage)
                : await requestGeneration(requestConfig, prompt);
            const storedResults = await Promise.all(
                generated.map(async (image) => {
                    const stored = await uploadImage(image.dataUrl);
                    return { id: image.id, dataUrl: stored.url, storageKey: stored.storageKey, width: stored.width, height: stored.height, bytes: stored.bytes, mimeType: stored.mimeType, materialType: outputType, platform, language: textLanguage, size: actualRatio, model: imageModel, prompt };
                }),
            );
            if (latestVisibleJobRef.current === jobId) setResults(storedResults);
            addHistory({ id: jobId, createdAt: Date.now(), title: `${commerceOutputLabel(outputType)} · ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`, prompt, results: storedResults });
            message.success(`已生成并保存 ${storedResults.length} 张商品图`);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "商品图生成失败");
        } finally {
            setPendingJobs((jobs) => jobs.filter((job) => job.id !== jobId));
            setGenerationMode(null);
        }
    };

    const generateMaterialKit = async () => {
        const selectedVariants = commerceKitOptions.filter((item) => kitVariants.includes(item.value));
        if (!selectedVariants.length) {
            message.warning("请至少选择一种套图素材");
            return;
        }
        if (!isAiConfigReady(effectiveConfig, imageModel)) {
            message.warning("请先配置可用的生图模型和 API Key");
            openConfigDialog(true, "models");
            return;
        }
        const basePrompt = promptResult?.[activePrompt] || buildFallbackPrompt(description || (productImage.length ? "根据参考商品图识别产品并进行真实商业展示" : ""), selectedRole);
        if (!basePrompt.trim()) {
            message.error("请先上传商品图或填写商品描述");
            return;
        }

        const jobId = nanoid();
        latestVisibleJobRef.current = jobId;
        setPendingJobs((jobs) => [...jobs, { id: jobId, mode: "kit", labels: selectedVariants.map((item) => item.value) }]);
        setResults([]);
        setGenerationMode("kit");

        const tasks = selectedVariants.map(async (spec) => {
            const actualRatio = resolveCommerceRatio(effectiveConfig, imageModel, spec.ratio);
            const requestSize = resolveCommerceRequestSize(effectiveConfig, imageModel, spec.ratio);
            const materialOutputType: CommerceOutputType = spec.value === "a-plus" ? "detail" : spec.value === "selling-point" ? "ad" : "main";
            const prompt = [
                basePrompt,
                commerceSpecPrompt(materialOutputType, platform, textLanguage),
                commerceKitPrompt(spec.value),
                `这是同一套系列素材中的“${spec.label}”画面，最终比例为 ${actualRatio}。保持与其他规格一致的品牌色、布光、背景语言和版式系统。`,
            ].join("\n");
            const requestConfig = { ...effectiveConfig, model: imageModel, imageModel, size: requestSize, count: "1" };
            const generated = productImage.length ? await requestEdit(requestConfig, prompt, productImage) : await requestGeneration(requestConfig, prompt);
            const image = generated[0];
            if (!image) throw new Error(`${spec.label}没有返回图片`);
            const stored = await uploadImage(image.dataUrl);
            return { id: image.id, dataUrl: stored.url, storageKey: stored.storageKey, width: stored.width, height: stored.height, bytes: stored.bytes, mimeType: stored.mimeType, materialType: spec.value, platform, language: textLanguage, size: actualRatio, model: imageModel, prompt } satisfies CommerceResult;
        });

        const settled = await Promise.allSettled(tasks);
        const completed = settled.flatMap((item) => (item.status === "fulfilled" ? [item.value] : []));
        const failures = settled.flatMap((item, index) => (item.status === "rejected" ? [`${selectedVariants[index].label}：${item.reason instanceof Error ? item.reason.message : "生成失败"}`] : []));
        if (latestVisibleJobRef.current === jobId) setResults(completed);
        if (completed.length) addHistory({ id: jobId, createdAt: Date.now(), title: `整套素材 · ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`, prompt: basePrompt, results: completed });
        setPendingJobs((jobs) => jobs.filter((job) => job.id !== jobId));
        setGenerationMode(null);
        if (completed.length) message.success(`已完成 ${completed.length} 种规格素材`);
        if (failures.length) message.warning(`${failures.length} 种规格未完成：${failures.join("；")}`);
    };

    const saveResult = async (result: CommerceResult, index: number, silent = false) => {
        const stored = result.storageKey && result.width && result.height && result.bytes && result.mimeType
            ? { url: result.dataUrl, storageKey: result.storageKey, width: result.width, height: result.height, bytes: result.bytes, mimeType: result.mimeType }
            : await uploadImage(result.dataUrl);
        addAsset({
            kind: "image",
            title: `电商${commerceMaterialLabel(result.materialType)} ${index + 1}`,
            coverUrl: stored.url,
            tags: ["电商", commerceMaterialLabel(result.materialType), commercePlatformLabel(result.platform || platform), selectedRole.name],
            source: "电商工作台",
            data: { dataUrl: stored.url, storageKey: stored.storageKey, width: stored.width, height: stored.height, bytes: stored.bytes, mimeType: stored.mimeType },
            metadata: { role: selectedRole.name, prompt: result.prompt || promptResult?.[activePrompt] || description, materialType: result.materialType, platform: result.platform || platform, language: result.language || textLanguage, size: result.size, model: result.model || imageModel },
        });
        if (!silent) message.success("已存入我的素材");
    };

    const saveAllResults = async () => {
        await Promise.all(results.map((result, index) => saveResult(result, index, true)));
        message.success(`已将 ${results.length} 张图片存入我的素材`);
    };

    const downloadAllResults = async () => {
        const files = await Promise.all(results.map(async (result, index) => ({ name: `${String(index + 1).padStart(2, "0")}-${commerceMaterialLabel(result.materialType)}-${result.size || "image"}.png`, data: await (await fetch(result.dataUrl)).blob() })));
        const zip = await createZip(files);
        saveAs(zip, `AikArt-电商多规格素材-${new Date().toISOString().slice(0, 10)}.zip`);
        message.success("整套素材已打包下载");
    };

    const copyPrompt = async (value: string) => {
        await navigator.clipboard.writeText(value);
        message.success("提示词已复制");
    };

    const usePrompt = (type: "chinese" | "english") => {
        const value = promptResult?.[type]?.trim();
        if (!value) {
            message.warning("当前提示词为空，请重新生成");
            return;
        }
        setActivePrompt(type);
        setAssistantOpen(false);
        message.success(`已使用${type === "chinese" ? "中文" : "英文"}提示词，可直接生成商品图`);
        window.setTimeout(() => document.getElementById("commerce-prompt-preview")?.scrollIntoView({ behavior: "smooth", block: "center" }), 180);
    };

    return (
        <main className="commerce-page h-full overflow-y-auto">
            <div className="commerce-shell mx-auto w-full max-w-[1560px] px-5 pb-16 pt-6 sm:px-8 xl:px-12">
                <header className="commerce-heading">
                    <div>
                        <div className="commerce-eyebrow"><ShoppingBag className="size-4" /> AikArt Commerce</div>
                        <h1>电商视觉工作台</h1>
                        <p>选择专业角色，把商品素材快速整理成可生成的商业视觉方案。</p>
                    </div>
                    <div className="commerce-heading-actions">
                        <Tooltip title="电商工作台教程">
                            <button type="button" className="commerce-help-button" aria-label="打开电商工作台教程" onClick={openTour}><HelpCircle className="size-5" /></button>
                        </Tooltip>
                        <Button icon={<UsersRound className="size-4" />} onClick={() => setRoleManagerOpen(true)}>角色管理</Button>
                    </div>
                </header>

                <section ref={roleStripRef} className="commerce-role-strip" aria-label="电商角色">
                    <RoleSummary role={selectedRole} />
                    <div className="commerce-role-list hide-scrollbar">
                        {roles.map((role) => (
                            <button key={role.id} type="button" className={`commerce-role-choice ${role.id === selectedRole.id ? "is-active" : ""}`} onClick={() => selectRole(role.id)} title={role.name}>
                                <RoleAvatar role={role} />
                                <span>{role.name.replace(/大师|设计师|摄影师/g, "")}</span>
                            </button>
                        ))}
                        <button type="button" className="commerce-role-choice commerce-role-add" onClick={() => setRoleManagerOpen(true)}>
                            <span className="commerce-avatar"><Plus className="size-5" /></span>
                            <span>新角色</span>
                        </button>
                    </div>
                </section>

                <section className="commerce-composer">
                    <div ref={uploadRef} className="commerce-upload-column">
                        <input ref={productInputRef} className="hidden" type="file" accept="image/*" multiple onChange={(event) => void uploadProduct(event.target.files)} />
                        {pendingProductImage || productImage.length ? (
                            <div className="commerce-product-preview commerce-product-preview-grid">
                                {pendingProductImage ? <img src={pendingProductImage.dataUrl} alt={pendingProductImage.name} /> : productImage.map((image, index) => <div key={image.id} className="commerce-product-thumb"><img src={image.dataUrl} alt={image.name} /><button type="button" title="移除商品图" disabled={productUploading} onClick={() => setProductImage((items) => items.filter((_, itemIndex) => itemIndex !== index))}><X className="size-3.5" /></button></div>)}
                                {productUploading ? (
                                    <div className="commerce-upload-status" role="status">
                                        <LoaderCircle className="size-5 animate-spin" />
                                        <strong>正在保存图片</strong>
                                    </div>
                                ) : null}
                                <button type="button" title="移除全部商品图" disabled={productUploading} onClick={() => setProductImage([])}><X className="size-4" /></button>
                            </div>
                        ) : (
                            <button type="button" className="commerce-upload" onClick={() => productInputRef.current?.click()}>
                                <span><Upload className="size-5" /></span>
                                <strong>上传商品图</strong>
                                <small>支持 JPG、PNG、WebP</small>
                            </button>
                        )}
                    </div>

                    <div className="commerce-prompt-column">
                        <div className="commerce-quick-specs">
                            <div ref={outputTabsRef} className="commerce-output-tabs" aria-label="素材类型">
                                {commerceOutputOptions.map((option) => <button key={option.value} type="button" className={outputType === option.value ? "is-active" : ""} onClick={() => changeOutputType(option.value)}>{option.label}</button>)}
                            </div>
                            <button type="button" className="commerce-edit-spec" onClick={() => setSpecEditorOpen(true)}><Pencil className="size-4" /> 编辑规格</button>
                        </div>
                        <textarea
                            ref={descriptionRef}
                            id="commerce-description"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="描述商品、目标人群、卖点、画面风格和文字排版。上传商品图后，可让 AI 自动识别并整理。"
                            maxLength={3000}
                        />
                        <div className="commerce-prompt-meta"><span>{selectedRole.name}正在为你策划</span><b>{description.length}/3000</b></div>
                        <div ref={settingsRef} className="commerce-settings-block">
                            <div className="commerce-context-row">
                                <CommerceSelect value={platform} options={commercePlatformOptions} onChange={changePlatform} ariaLabel="目标平台" icon={<Globe2 className="size-3.5" />} />
                                <CommerceSelect value={textLanguage} options={commerceLanguageOptions} onChange={setTextLanguage} ariaLabel="目标语言" icon={<Languages className="size-3.5" />} />
                            </div>
                            <div className="commerce-control-row">
                                <label><span>画面比例</span><CommerceSelect value={config.size} options={ratioSelectOptions} onChange={(value) => updateConfig("size", value)} ariaLabel="画面比例" /></label>
                                <label><span>生成张数</span><CommerceSelect value={config.count} options={countSelectOptions} onChange={(value) => updateConfig("count", value)} ariaLabel="生成张数" /></label>
                                <div className="commerce-model-control"><span>生图模型</span><ModelPicker config={config} capability="image" value={imageModel} onChange={changeImageModel} onMissingConfig={() => openConfigDialog(false, "models")} className="commerce-model-picker" contentClassName="commerce-model-picker-content" /></div>
                            </div>
                        </div>
                    </div>
                </section>

                <div ref={actionsRef} className="commerce-action-row">
                    <button type="button" className="commerce-secondary-action" disabled={promptRunning || productUploading} onClick={() => void generatePrompt()}>
                        {promptRunning ? <LoaderCircle className="size-5 animate-spin" /> : <Sparkles className="size-5" />} AI 整理提示词
                    </button>
                    <button type="button" className="commerce-primary-action" disabled={productUploading} onClick={() => void generateImages()}>
                        {hasSingleJob ? <LoaderCircle className="size-5 animate-spin" /> : <WandSparkles className="size-5" />} {hasSingleJob ? "继续生成中" : `生成${commerceOutputLabel(outputType)}`}
                    </button>
                </div>

                <section ref={kitRef} className="commerce-kit-builder">
                    <div className="commerce-kit-copy">
                        <span><Layers3 className="size-4" /> 多规格素材套图</span>
                        <h2>一套信息输出多规格素材</h2>
                        <p>场景、卖点、特写、A+ 常用类型一键齐全，保持风格与版式统一，直接生成可投放规格。</p>
                    </div>
                    <div className="commerce-kit-options">
                        {commerceKitOptions.map((option) => (
                            <button key={option.value} type="button" className={kitVariants.includes(option.value) ? "is-active" : ""} onClick={() => toggleKitVariant(option.value)}>
                                <span>{option.label}</span><small>{option.summary}</small><b>{resolveCommerceRatio(effectiveConfig, imageModel, option.ratio)}</b>
                            </button>
                        ))}
                    </div>
                    <button type="button" className="commerce-kit-generate" disabled={productUploading || !kitVariants.length} onClick={() => void generateMaterialKit()}>
                        {hasKitJob ? <LoaderCircle className="size-5 animate-spin" /> : <LayoutTemplate className="size-5" />}
                        {hasKitJob ? "套图生成中，可继续发送" : `生成整套素材（${kitVariants.length} 种）`}
                    </button>
                </section>

                {promptResult ? (
                    <section id="commerce-prompt-preview" className="commerce-prompt-preview">
                        <div className="commerce-section-title"><div><Sparkles className="size-5" /><span>AI 视觉方案</span><b>当前使用：{activePrompt === "chinese" ? "中文" : "英文"}</b></div><button type="button" onClick={() => setAssistantOpen(true)}>查看完整方案 <ChevronRight className="size-4" /></button></div>
                        <p>{promptResult.intro}</p>
                        <div className="commerce-prompt-tabs">
                            <button type="button" className={activePrompt === "chinese" ? "is-active" : ""} onClick={() => setActivePrompt("chinese")}><Check className="size-4" /> 中文提示词</button>
                            <button type="button" className={activePrompt === "english" ? "is-active" : ""} onClick={() => setActivePrompt("english")}><Check className="size-4" /> 英文提示词</button>
                            <button type="button" className="commerce-copy-button" onClick={() => void copyPrompt(promptResult[activePrompt])}><Copy className="size-4" /> 复制</button>
                        </div>
                        <pre>{promptResult[activePrompt]}</pre>
                    </section>
                ) : null}

                {imageRunning || results.length || history.length ? (
                    <section className="commerce-results">
                        <div className="commerce-section-title commerce-results-title">
                            <div><ImageIcon className="size-5" /><span>生成结果</span>{results.length ? <b>{results.length} 张</b> : null}</div>
                            {results.length ? <div className="commerce-result-batch-actions"><button type="button" onClick={() => void saveAllResults()}><FolderPlus className="size-4" />全部存入素材</button><button type="button" onClick={() => void downloadAllResults()}><FileArchive className="size-4" />下载整套 ZIP</button></div> : null}
                        </div>
                        <div className="commerce-result-grid">
                            {pendingJobs.flatMap((job) => job.labels.map((label, index) => <div className="commerce-result-loading" key={`${job.id}-${label}-${index}`}><LoaderCircle className="size-7 animate-spin" /><span>正在生成{commerceMaterialLabel(label as CommerceKitVariant) || label}</span></div>))}
                            {results.map((result, index) => (
                                <article className="commerce-result-card" key={result.id}>
                                    <button type="button" className="block size-full cursor-zoom-in" onClick={() => setPreviewImage(result)} aria-label="预览图片"><img src={result.dataUrl} alt={`电商生成结果 ${index + 1}`} /></button>
                                    <span className="commerce-result-kind">{commerceMaterialLabel(result.materialType)} · {result.size || config.size}</span>
                                    <div className="commerce-result-tools">
                                        <Tooltip title="下载"><button type="button" aria-label="下载" onClick={() => saveAs(result.dataUrl, `aikart-${commerceMaterialLabel(result.materialType)}-${index + 1}.png`)}><Download className="size-4" /></button></Tooltip>
                                        <Tooltip title="存入素材"><button type="button" aria-label="存入素材" onClick={() => void saveResult(result, index)}><FolderPlus className="size-4" /></button></Tooltip>
                                        <Tooltip title="删除"><button type="button" aria-label="删除" onClick={() => setResults((items) => items.filter((item) => item.id !== result.id))}><Trash2 className="size-4" /></button></Tooltip>
                                    </div>
                                </article>
                            ))}
                        </div>
                        {history.length ? (
                            <div className="mt-6 border-t border-stone-200 pt-5 dark:border-stone-800">
                                <div className="mb-3 flex items-center justify-between"><strong className="text-sm">历史结果</strong><span className="text-xs text-stone-500">刷新后仍保留最近 {history.length} 批</span></div>
                                <div className="space-y-3">
                                    {history.map((entry: CommerceHistory) => (
                                        <div key={entry.id} className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                            <div className="mb-2 flex items-start justify-between gap-3"><div className="min-w-0"><strong className="text-sm">{entry.title}</strong><p className="mt-1 line-clamp-2 text-xs text-stone-500">{entry.prompt}</p></div><button type="button" className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-white" onClick={() => removeHistory(entry.id)}>删除</button></div>
                                            <div className="flex gap-2 overflow-x-auto">{entry.results.map((result, index) => <button type="button" key={result.id} className="size-16 shrink-0 overflow-hidden rounded-md border border-stone-200 dark:border-stone-700" onClick={() => setPreviewImage(result)} aria-label={`预览历史结果 ${index + 1}`}><img src={result.dataUrl} alt="" className="size-full object-cover" /></button>)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </section>
                ) : null}
            </div>

            <CommerceSpecEditor
                open={specEditorOpen}
                config={config}
                imageModel={imageModel}
                description={description}
                outputType={outputType}
                platform={platform}
                textLanguage={textLanguage}
                onClose={() => setSpecEditorOpen(false)}
                onDescriptionChange={setDescription}
                onOutputTypeChange={changeOutputType}
                onPlatformChange={changePlatform}
                onTextLanguageChange={setTextLanguage}
                onSizeChange={(value) => updateConfig("size", value)}
                onCountChange={(value) => updateConfig("count", value)}
                onModelChange={changeImageModel}
                onMissingConfig={() => openConfigDialog(false, "models")}
                onAiWrite={() => void aiWriteDescription()}
                aiWriting={aiWriting}
            />
            <RoleManagerModal open={roleManagerOpen} onClose={() => setRoleManagerOpen(false)} />
            <AssistantModal
                open={assistantOpen}
                role={selectedRole}
                running={promptRunning}
                result={promptResult}
                onClose={() => setAssistantOpen(false)}
                onRegenerate={() => void generatePrompt()}
                onUse={usePrompt}
                onCopy={copyPrompt}
            />
            <Modal open={Boolean(previewImage)} footer={previewImage ? <Button type="primary" icon={<Download className="size-4" />} onClick={() => saveAs(previewImage.dataUrl, `aikart-preview-${previewImage.id}.png`)}>下载图片</Button> : null} title="图片预览" onCancel={() => setPreviewImage(null)} width={900} centered>
                {previewImage ? <Image src={previewImage.dataUrl} alt="生成结果预览" preview={false} style={{ display: "block", maxHeight: "70vh", width: "100%", objectFit: "contain" }} /> : null}
            </Modal>
            <Tour
                open={tourOpen}
                current={tourCurrent}
                steps={tourSteps}
                onChange={setTourCurrent}
                onClose={closeTour}
                onFinish={closeTour}
                className="commerce-tour"
                mask={{ color: "rgba(22, 31, 45, .58)" }}
                gap={{ offset: 10, radius: 18 }}
                scrollIntoViewOptions={{ behavior: "smooth", block: "center" }}
                indicatorsRender={(current, total) => (
                    <div className="commerce-tour-indicators" aria-label={`教程第 ${current + 1} 步，共 ${total} 步`}>
                        {Array.from({ length: total }, (_, index) => <span key={index} className={index < current ? "is-done" : index === current ? "is-active" : ""}>{index + 1}</span>)}
                    </div>
                )}
            />
        </main>
    );
}

function RoleSummary({ role }: { role: CommerceRole }) {
    return <div className="commerce-role-summary"><RoleAvatar role={role} /><div><strong>{role.name}</strong><span>{role.summary}</span></div></div>;
}

function RoleAvatar({ role, large = false }: { role: CommerceRole; large?: boolean }) {
    const [url, setUrl] = useState(role.avatarUrl || "");
    useEffect(() => {
        setUrl(role.avatarUrl || "");
        if (role.avatarStorageKey) void resolveImageUrl(role.avatarStorageKey, role.avatarUrl).then(setUrl);
    }, [role.avatarStorageKey, role.avatarUrl]);
    return (
        <span className={`commerce-avatar ${large ? "is-large" : ""}`} style={{ "--role-accent": role.accent } as React.CSSProperties}>
            {url ? <img src={url} alt="" /> : <UserRound className={large ? "size-7" : "size-5"} />}
        </span>
    );
}

function RoleManagerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { message } = App.useApp();
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const config = useConfigStore((state) => state.config);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const customRoles = useCommerceStore((state) => state.customRoles);
    const selectedRoleId = useCommerceStore((state) => state.selectedRoleId);
    const addRole = useCommerceStore((state) => state.addRole);
    const updateRole = useCommerceStore((state) => state.updateRole);
    const removeRole = useCommerceStore((state) => state.removeRole);
    const selectRole = useCommerceStore((state) => state.selectRole);
    const roles = useMemo(() => allCommerceRoles(customRoles), [customRoles]);
    const [tab, setTab] = useState("roles");
    const [draft, setDraft] = useState<RoleDraft>(initialRoleDraft);
    const [editingId, setEditingId] = useState("");
    const [avatarUploading, setAvatarUploading] = useState(false);

    const editRole = (role: CommerceRole) => {
        setDraft({ name: role.name, summary: role.summary, systemPrompt: role.systemPrompt, accent: role.accent, avatarUrl: role.avatarUrl, avatarStorageKey: role.avatarStorageKey });
        if (role.avatarStorageKey) {
            void resolveImageUrl(role.avatarStorageKey, role.avatarUrl).then((avatarUrl) => setDraft((value) => ({ ...value, avatarUrl })));
        }
        setEditingId(role.builtIn ? "" : role.id);
        setTab("create");
    };

    const saveRole = () => {
        if (!draft.name.trim() || !draft.systemPrompt.trim()) {
            message.error("请填写角色名称和角色提示词");
            return;
        }
        if (editingId) updateRole(editingId, draft);
        else addRole(draft);
        message.success(editingId ? "角色已更新" : "角色已创建");
        setDraft(initialRoleDraft);
        setEditingId("");
        setTab("roles");
    };

    const uploadAvatar = async (files?: FileList | null) => {
        const file = Array.from(files || []).find(isImageFile);
        if (!file) {
            message.warning("请选择 JPG、PNG、WebP 等图片文件");
            if (avatarInputRef.current) avatarInputRef.current.value = "";
            return;
        }

        const previousAvatar = { avatarUrl: draft.avatarUrl, avatarStorageKey: draft.avatarStorageKey };
        const previewUrl = URL.createObjectURL(file);
        setDraft((value) => ({ ...value, avatarUrl: previewUrl, avatarStorageKey: undefined }));
        setAvatarUploading(true);

        try {
            const stored = await uploadImage(file);
            setDraft((value) => ({ ...value, avatarUrl: stored.url, avatarStorageKey: stored.storageKey }));
            message.success("头像已上传");
        } catch (error) {
            console.error("Failed to upload commerce role avatar", error);
            setDraft((value) => ({ ...value, ...previousAvatar }));
            message.error(error instanceof Error ? `头像上传失败：${error.message}` : "头像上传失败，请重试");
        } finally {
            setAvatarUploading(false);
            URL.revokeObjectURL(previewUrl);
            if (avatarInputRef.current) avatarInputRef.current.value = "";
        }
    };

    return (
        <Modal className="commerce-role-modal" open={open} onCancel={onClose} footer={null} width={860} centered destroyOnHidden title={<div className="commerce-modal-title"><span><UsersRound className="size-5" /></span><div><strong>角色管理</strong><small>管理 AI 创作角色，快速生成专业电商提示词</small></div></div>}>
            <Tabs activeKey={tab} onChange={setTab} items={[
                {
                    key: "roles",
                    label: "我的角色",
                    children: <div className="commerce-role-manager-body">
                        <div className="commerce-role-manager-list thin-scrollbar">
                            {roles.map((role) => <div className={`commerce-role-manager-item ${selectedRoleId === role.id ? "is-selected" : ""}`} key={role.id}>
                                <button type="button" className="commerce-role-manager-main" onClick={() => selectRole(role.id)}><RoleAvatar role={role} /><span><strong>{role.name}</strong><small>{role.summary}</small></span>{role.builtIn ? <em>官方</em> : null}</button>
                                <button type="button" title={role.builtIn ? "基于此角色创建" : "编辑角色"} onClick={() => editRole(role)}><Pencil className="size-4" /></button>
                                {!role.builtIn ? <button type="button" title="删除角色" onClick={() => removeRole(role.id)}><Trash2 className="size-4" /></button> : null}
                            </div>)}
                        </div>
                        <div className="commerce-dialog-model"><div><Bot className="size-4" /><span><strong>对话模型设置</strong><small>用于分析商品并生成中英文提示词</small></span></div><ModelPicker config={config} capability="text" value={config.textModel} onChange={(model) => updateConfig("textModel", model)} onMissingConfig={() => openConfigDialog(false, "models")} className="commerce-model-picker" contentClassName="commerce-model-picker-content" /></div>
                        <Button type="primary" block onClick={onClose}>保存角色设置</Button>
                    </div>,
                },
                {
                    key: "create",
                    label: editingId ? "编辑角色" : "创建角色",
                    children: <div className="commerce-role-create">
                        <div className="commerce-role-create-top">
                            <div className="commerce-avatar-field">
                                <span>角色形象</span>
                                <input ref={avatarInputRef} className="hidden" type="file" accept="image/*" onChange={(event) => void uploadAvatar(event.target.files)} />
                                <button type="button" className={draft.avatarUrl ? "has-image" : ""} disabled={avatarUploading} onClick={() => avatarInputRef.current?.click()}>
                                    {draft.avatarUrl ? <img src={draft.avatarUrl} alt="角色头像预览" /> : <Plus className="size-6" />}
                                    <small className="commerce-avatar-upload-label">
                                        {avatarUploading ? <LoaderCircle className="size-4 animate-spin" /> : null}
                                        {avatarUploading ? "正在保存" : draft.avatarUrl ? "更换头像" : "上传头像"}
                                    </small>
                                </button>
                            </div>
                            <div className="commerce-role-fields"><label>角色名称<b>*</b><Input value={draft.name} maxLength={24} placeholder="给角色起个名字" onChange={(event) => setDraft((value) => ({ ...value, name: event.target.value }))} /></label><label>角色简介<Input value={draft.summary} maxLength={80} placeholder="一句话描述角色（可选）" onChange={(event) => setDraft((value) => ({ ...value, summary: event.target.value }))} /></label></div>
                        </div>
                        <label className="commerce-role-prompt-field"><span>角色设定<b>*</b><small>定义角色的专业能力、任务和输出风格</small></span><Input.TextArea value={draft.systemPrompt} maxLength={5000} showCount rows={8} placeholder="例如：你是一位专业电商海报设计师，擅长商业产品摄影与高转化商品主图……" onChange={(event) => setDraft((value) => ({ ...value, systemPrompt: event.target.value }))} /></label>
                        <div className="commerce-role-create-actions"><Button onClick={() => { setDraft(initialRoleDraft); setEditingId(""); setTab("roles"); }}>取消</Button><Button type="primary" icon={<Plus className="size-4" />} onClick={saveRole}>{editingId ? "保存修改" : "创建角色"}</Button></div>
                    </div>,
                },
            ]} />
        </Modal>
    );
}

function AssistantModal({ open, role, running, result, onClose, onRegenerate, onUse, onCopy }: { open: boolean; role: CommerceRole; running: boolean; result: CommercePrompt | null; onClose: () => void; onRegenerate: () => void; onUse: (type: "chinese" | "english") => void; onCopy: (value: string) => Promise<void> }) {
    return <Modal className="commerce-assistant-modal" open={open} onCancel={onClose} footer={null} width={900} centered destroyOnHidden title={<div className="commerce-assistant-title"><RoleAvatar role={role} /><strong>{role.name}</strong></div>}>
        {running ? <div className="commerce-thinking"><RoleAvatar role={role} large /><LoaderCircle className="size-5 animate-spin" /><span>AI 正在分析商品并整理视觉方案...</span></div> : result ? <div className="commerce-assistant-result">
            <div className="commerce-assistant-message"><span><Bot className="size-4" /> AI 回复</span><p>{result.intro}</p></div>
            <div className="commerce-assistant-prompt-grid">
                <PromptCard title="中文提示词" value={result.chinese} onCopy={onCopy} onUse={() => onUse("chinese")} />
                <PromptCard title="英文提示词" value={result.english} onCopy={onCopy} onUse={() => onUse("english")} accent />
            </div>
            <div className="commerce-assistant-footer"><Button icon={<RefreshCw className="size-4" />} onClick={onRegenerate}>重新生成</Button></div>
        </div> : null}
    </Modal>;
}

function PromptCard({ title, value, accent, onCopy, onUse }: { title: string; value: string; accent?: boolean; onCopy: (value: string) => Promise<void>; onUse: () => void }) {
    return <article className={`commerce-assistant-prompt ${accent ? "is-accent" : ""}`}><header><strong>{title}</strong><button type="button" onClick={() => void onCopy(value)}><Copy className="size-4" />复制</button></header><pre>{value}</pre><button type="button" className="commerce-use-prompt" onClick={onUse}>使用此提示词 <ChevronRight className="size-4" /></button></article>;
}

function parsePromptResponse(answer: string, description: string, role: CommerceRole): CommercePrompt {
    const clean = stripPromptWrapper(answer);
    const json = parsePromptJson(clean);
    if (json) {
        const intro = cleanPromptSection(json.intro, 800) || `已由${role.name}围绕商品主体、卖点层级和商业质感整理视觉方案。`;
        const chinese = cleanPromptSection(json.chinese, 3600) || buildFallbackPrompt(description, role);
        const englishCandidate = cleanPromptSection(json.english, 3600);
        return { intro, chinese, english: isEnglishPrompt(englishCandidate) ? englishCandidate : buildEnglishFallback() };
    }
    const sections = collectPromptSections(clean);
    const intro = cleanPromptSection(bestSection(sections.intro, "intro"), 800) || `已由${role.name}围绕商品主体、卖点层级和商业质感整理视觉方案。`;
    const chinese = cleanPromptSection(bestSection(sections.chinese, "chinese"), 3600) || cleanPromptSection(clean, 3600) || buildFallbackPrompt(description, role);
    const englishCandidate = cleanPromptSection(bestSection(sections.english, "english"), 3600);
    const english = isEnglishPrompt(englishCandidate) ? englishCandidate : buildEnglishFallback();
    return { intro, chinese, english };
}

type PromptSectionKind = "intro" | "chinese" | "english";
type PromptSections = Record<PromptSectionKind, string[]>;

function stripPromptWrapper(value: string) {
    return value
        .trim()
        .replace(/^```(?:json|text|markdown)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .replace(/<\/?(?:response|answer)>/gi, "")
        .trim();
}

function parsePromptJson(value: string): CommercePrompt | null {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
        const parsed = JSON.parse(value.slice(start, end + 1)) as Partial<CommercePrompt>;
        if (typeof parsed.chinese !== "string" || typeof parsed.english !== "string") return null;
        return { intro: typeof parsed.intro === "string" ? parsed.intro : "", chinese: parsed.chinese, english: parsed.english };
    } catch {
        return null;
    }
}

function collectPromptSections(value: string): PromptSections {
    const result: PromptSections = { intro: [], chinese: [], english: [] };
    const marker = /(?:[【\[]\s*(说明|中文提示词|英文提示词|Chinese Prompt|English Prompt)\s*[】\]]|(?:^|\r?\n)\s*(?:#{1,4}\s*)?(说明|中文提示词|英文提示词|Chinese Prompt|English Prompt)\s*[:：])\s*/gi;
    const matches = Array.from(value.matchAll(marker));
    matches.forEach((match, index) => {
        const label = (match[1] || match[2]).toLowerCase();
        const kind: PromptSectionKind = label === "说明" ? "intro" : label === "中文提示词" || label === "chinese prompt" ? "chinese" : "english";
        const start = (match.index || 0) + match[0].length;
        const end = matches[index + 1]?.index ?? value.length;
        const section = value.slice(start, end).trim();
        if (section) result[kind].push(section);
    });
    if (!matches.length && value) result.chinese.push(value);
    return result;
}

function bestSection(values: string[], kind: PromptSectionKind) {
    const unique = Array.from(new Set(values.map((value) => cleanPromptSection(value, 5000)).filter(Boolean)));
    const valid = kind === "english" ? unique.filter(isEnglishPrompt) : kind === "chinese" ? unique.filter((value) => /[\u3400-\u9fff]/.test(value)) : unique;
    return (valid.length ? valid : unique).sort((a, b) => sectionScore(b, kind) - sectionScore(a, kind))[0] || "";
}

function sectionScore(value: string, kind: PromptSectionKind) {
    const cappedLength = Math.min(value.length, kind === "intro" ? 800 : 3600);
    const chineseCount = (value.match(/[\u3400-\u9fff]/g) || []).length;
    const latinCount = (value.match(/[A-Za-z]/g) || []).length;
    if (kind === "english") return cappedLength + latinCount * 2 - chineseCount * 30;
    if (kind === "chinese") return cappedLength + chineseCount * 2;
    return cappedLength - Math.max(0, value.length - 800) * 2;
}

function cleanPromptSection(value: string, maxLength: number) {
    const withoutLabels = stripPromptWrapper(value)
        .replace(/[【\[]\s*(?:说明|中文提示词|英文提示词|Chinese Prompt|English Prompt)\s*[】\]]\s*[:：]?/gi, "\n")
        .replace(/(?:^|\n)\s*(?:说明|中文提示词|英文提示词|Chinese Prompt|English Prompt)\s*[:：]\s*/gi, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    if (!withoutLabels) return "";
    const paragraphs = withoutLabels.split(/\n+/).map((item) => item.trim()).filter(Boolean);
    const seen = new Set<string>();
    const deduplicated = paragraphs.filter((paragraph) => {
        const key = paragraph.replace(/[\s，。,.!！?？:：;；'"“”‘’()（）\[\]【】_-]+/g, "").toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    }).join("\n\n");
    return truncatePrompt(deduplicated, maxLength);
}

function truncatePrompt(value: string, maxLength: number) {
    if (value.length <= maxLength) return value;
    const clipped = value.slice(0, maxLength);
    const boundary = Math.max(clipped.lastIndexOf("。"), clipped.lastIndexOf("."), clipped.lastIndexOf("\n"));
    return `${clipped.slice(0, boundary > maxLength * 0.6 ? boundary + 1 : maxLength).trim()}…`;
}

function isEnglishPrompt(value: string) {
    if (!value.trim()) return false;
    const chineseCount = (value.match(/[\u3400-\u9fff]/g) || []).length;
    const latinCount = (value.match(/[A-Za-z]/g) || []).length;
    return chineseCount === 0 && latinCount >= 40;
}

function buildEnglishFallback() {
    return "Create a premium e-commerce hero image based on the referenced product. Preserve the exact product appearance, packaging, colors, logo, typography, materials, structure, and proportions. Use clean commercial lighting, a clear visual hierarchy, realistic materials, refined details, a polished advertising composition, and a conversion-focused layout. Do not alter any brand text or product information.";
}

function buildFallbackPrompt(description: string, role: CommerceRole) {
    if (!description.trim()) return "";
    return `${description.trim()}。${role.systemPrompt}。制作高转化电商商品主图，商品主体清晰完整，保持真实包装、品牌标识、颜色、材质和比例，商业摄影级灯光，干净背景，信息层级明确，高细节，高质感。`;
}
