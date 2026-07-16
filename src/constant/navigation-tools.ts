import { Clapperboard, FileText, GalleryHorizontalEnd, ImagePlus, Maximize2, Settings2, ShoppingBag, UserRound, Video } from "lucide-react";

export const navigationTools = [
    {
        slug: "canvas",
        label: "我的画布",
        icon: Maximize2,
    },
    {
        slug: "image",
        label: "生图工作台",
        icon: ImagePlus,
    },
    {
        slug: "commerce",
        label: "电商工作台",
        icon: ShoppingBag,
    },
    {
        slug: "comic",
        label: "漫剧",
        icon: Clapperboard,
    },
    {
        slug: "video",
        label: "视频创作台",
        icon: Video,
    },
    {
        slug: "prompts",
        label: "提示词库",
        icon: FileText,
    },
    {
        slug: "showcase",
        label: "作品展示",
        icon: GalleryHorizontalEnd,
    },
    {
        slug: "profile",
        label: "个人资料",
        icon: UserRound,
    },
    {
        slug: "config",
        label: "配置",
        icon: Settings2,
    },
] as const;

export type NavigationToolSlug = (typeof navigationTools)[number]["slug"];
