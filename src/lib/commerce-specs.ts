import { modelOptionName, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";

export type CommerceOutputType = "main" | "detail" | "ad";
export type CommercePlatform = "auto" | "taobao" | "tmall" | "pinduoduo" | "jd" | "douyin" | "1688" | "alibaba" | "amazon" | "temu" | "ebay" | "shein" | "shopee";
export type CommerceTextLanguage = "none" | "zh-cn" | "zh-tw" | "en" | "ja" | "ko" | "de" | "fr" | "it" | "ar" | "ru" | "th" | "id";
export type CommerceKitVariant = "scene" | "selling-point" | "close-up" | "a-plus";
export type CommerceMaterialType = CommerceOutputType | CommerceKitVariant;

export const commerceOutputOptions: Array<{ value: CommerceOutputType; label: string }> = [
    { value: "main", label: "主图" },
    { value: "detail", label: "详情图" },
    { value: "ad", label: "广告图" },
];

export const commercePlatformOptions: Array<{ value: CommercePlatform; label: string }> = [
    { value: "auto", label: "智能匹配" },
    { value: "taobao", label: "淘宝" },
    { value: "tmall", label: "天猫" },
    { value: "pinduoduo", label: "拼多多" },
    { value: "jd", label: "京东" },
    { value: "douyin", label: "抖音" },
    { value: "1688", label: "1688" },
    { value: "alibaba", label: "阿里巴巴国际站" },
    { value: "amazon", label: "亚马逊" },
    { value: "temu", label: "TEMU" },
    { value: "ebay", label: "eBay" },
    { value: "shein", label: "SHEIN" },
    { value: "shopee", label: "Shopee" },
];

export const commerceLanguageOptions: Array<{ value: CommerceTextLanguage; label: string }> = [
    { value: "none", label: "无文字（纯视觉）" },
    { value: "zh-cn", label: "中文（简体）" },
    { value: "zh-tw", label: "中文（繁体）" },
    { value: "en", label: "英语" },
    { value: "ja", label: "日语" },
    { value: "ko", label: "韩语" },
    { value: "de", label: "德语" },
    { value: "fr", label: "法语" },
    { value: "it", label: "意大利语" },
    { value: "ar", label: "阿拉伯语" },
    { value: "ru", label: "俄语" },
    { value: "th", label: "泰语" },
    { value: "id", label: "印尼语" },
];

export const commerceRatioOptions = [
    { value: "1:1", label: "正方形 1:1" },
    { value: "3:2", label: "横版 3:2" },
    { value: "2:3", label: "竖版 2:3" },
    { value: "4:3", label: "横版 4:3" },
    { value: "3:4", label: "竖版 3:4" },
    { value: "5:4", label: "横版 5:4" },
    { value: "4:5", label: "竖版 4:5" },
    { value: "16:9", label: "横屏 16:9" },
    { value: "9:16", label: "竖屏 9:16" },
    { value: "21:9", label: "超宽 21:9" },
];

export const commerceKitOptions: Array<{ value: CommerceKitVariant; label: string; summary: string; ratio: string }> = [
    { value: "scene", label: "场景", summary: "信息流投放", ratio: "4:5" },
    { value: "selling-point", label: "卖点", summary: "活动转化", ratio: "1:1" },
    { value: "close-up", label: "特写", summary: "材质细节", ratio: "1:1" },
    { value: "a-plus", label: "A+", summary: "宽图详情模块", ratio: "16:9" },
];

const genericRatios = commerceRatioOptions.map((item) => item.value);
const geminiRatios = ["1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "21:9"];

export function commerceOutputLabel(value: CommerceOutputType) {
    return commerceOutputOptions.find((item) => item.value === value)?.label || value;
}

export function commercePlatformLabel(value: CommercePlatform) {
    return commercePlatformOptions.find((item) => item.value === value)?.label || value;
}

export function commerceLanguageLabel(value: CommerceTextLanguage) {
    return commerceLanguageOptions.find((item) => item.value === value)?.label || value;
}

export function commerceMaterialLabel(value?: CommerceMaterialType) {
    if (!value) return "商品图";
    return commerceOutputOptions.find((item) => item.value === value)?.label || commerceKitOptions.find((item) => item.value === value)?.label || value;
}

export function supportedCommerceRatios(config: AiConfig, model: string) {
    const profile = imageModelProfile(config, model);
    if (profile === "dall-e-2") return ["1:1"];
    if (profile === "dall-e-3") return ["1:1", "16:9", "9:16"];
    if (profile === "gemini") return geminiRatios;
    return genericRatios;
}

export function resolveCommerceRatio(config: AiConfig, model: string, desired: string) {
    const supported = supportedCommerceRatios(config, model);
    const normalized = normalizeRatio(desired);
    if (supported.includes(normalized)) return normalized;
    const target = ratioValue(normalized);
    return supported.reduce((best, item) => (Math.abs(ratioValue(item) - target) < Math.abs(ratioValue(best) - target) ? item : best), supported[0]);
}

export function resolveCommerceRequestSize(config: AiConfig, model: string, desired: string) {
    const ratio = resolveCommerceRatio(config, model, desired);
    const profile = imageModelProfile(config, model);
    if (profile === "dall-e-2") return "1024x1024";
    if (profile === "dall-e-3") return ratio === "1:1" ? "1024x1024" : ratioValue(ratio) > 1 ? "1792x1024" : "1024x1792";
    return ratio;
}

export function recommendedCommerceRatio(outputType: CommerceOutputType, platform: CommercePlatform) {
    if (platform === "douyin") return outputType === "main" ? "3:4" : "9:16";
    if (platform === "amazon" || platform === "ebay") return outputType === "detail" ? "3:2" : outputType === "ad" ? "16:9" : "1:1";
    if (platform === "shein" || platform === "temu") return outputType === "main" ? "3:4" : outputType === "ad" ? "4:5" : "3:4";
    if (platform === "alibaba" || platform === "1688") return outputType === "detail" ? "3:2" : outputType === "ad" ? "16:9" : "1:1";
    if (outputType === "detail") return "3:4";
    if (outputType === "ad") return "16:9";
    return "1:1";
}

export function commerceSpecPrompt(outputType: CommerceOutputType, platform: CommercePlatform, language: CommerceTextLanguage) {
    return [outputPromptRule(outputType), platformPromptRule(platform), languagePromptRule(language)].join("\n");
}

export function commerceKitPrompt(variant: CommerceKitVariant) {
    if (variant === "scene") return "生成生活方式场景图：商品自然融入真实使用环境，主体清晰，构图适合信息流投放，保持统一品牌光线与色彩。";
    if (variant === "selling-point") return "生成卖点转化图：围绕最重要的产品利益点建立清晰视觉层级，保留商品真实性，画面适合活动转化。";
    if (variant === "close-up") return "生成产品特写图：使用微距或近景突出材质、工艺、纹理和关键结构，细节清晰可信，避免改变商品。";
    return "生成 A+ 宽图详情模块：包含完整商品、场景和关键特征的横向信息布局，留出有秩序的内容区域，适合电商详情页直接投放。";
}

function imageModelProfile(config: AiConfig, model: string) {
    const requestConfig = resolveModelRequestConfig(config, model);
    const name = modelOptionName(model).toLowerCase();
    if (requestConfig.apiFormat === "gemini") return "gemini";
    if (/dall-?e-?2/.test(name)) return "dall-e-2";
    if (/dall-?e-?3/.test(name)) return "dall-e-3";
    return "generic";
}

function outputPromptRule(value: CommerceOutputType) {
    if (value === "detail") return "素材类型：详情图。建立纵向叙事和产品信息层级，覆盖使用场景、核心卖点、材质细节与购买理由。";
    if (value === "ad") return "素材类型：广告图。强化单一传播主题、视觉冲击和转化焦点，构图适合付费广告投放。";
    return "素材类型：主图。商品必须成为唯一视觉主体，轮廓清楚、卖点直观、缩略图识别度高。";
}

function platformPromptRule(value: CommercePlatform) {
    const label = commercePlatformLabel(value);
    if (value === "auto") return "目标平台：智能匹配。根据商品类别和素材类型采用通用高转化电商规范。";
    if (value === "amazon") return `目标平台：${label}。主图优先干净背景、真实商品和合规构图；详情模块强调信息清晰与可信度。`;
    if (value === "douyin") return `目标平台：${label}。使用移动端优先、强首屏吸引力和短视频信息流风格，主体在小屏中仍清晰。`;
    if (["alibaba", "ebay", "temu", "shein", "shopee"].includes(value)) return `目标平台：${label}。采用跨境电商审美，视觉语言清晰直接，兼顾移动端浏览和国际受众。`;
    return `目标平台：${label}。遵循该平台常见商品视觉、信息密度和转化导向规范。`;
}

function languagePromptRule(value: CommerceTextLanguage) {
    if (value === "none") return "目标文字：无文字纯视觉。禁止新增标题、卖点、价格、标签、水印或伪文字；商品包装上原有的品牌 Logo、标签和印刷文字必须按参考图完整保留，不得删除、改写或重绘。";
    const label = commerceLanguageLabel(value);
    return `目标文字：新增营销文案仅允许使用${label}，保持简短、可读、准确，禁止混入其他语言或乱码；商品包装原有文字和 Logo 必须按参考图保留。`;
}

function normalizeRatio(value: string) {
    const dimensions = value.match(/^(\d+)x(\d+)$/i);
    if (dimensions) return `${Number(dimensions[1])}:${Number(dimensions[2])}`;
    return /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(value) ? value : "1:1";
}

function ratioValue(value: string) {
    const [width, height] = normalizeRatio(value).split(":").map(Number);
    return width / Math.max(1, height);
}
