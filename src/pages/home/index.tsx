import {
    ArrowRight,
    Check,
    Clapperboard,
    Image as ImageIcon,
    Layers3,
    PenLine,
    Sparkles,
    WandSparkles,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const steps = [
    { number: "01", label: "选场景", icon: Layers3 },
    { number: "02", label: "加参考", icon: ImageIcon },
    { number: "03", label: "写描述", icon: PenLine },
    { number: "04", label: "生成", icon: WandSparkles },
    { number: "05", label: "微调", icon: Sparkles },
    { number: "06", label: "保存", icon: Check },
];

const studioCards = [
    {
        eyebrow: "电商",
        title: "上新视觉",
        detail: "商品展示 / 海报 / 详情",
        icon: Layers3,
        className: "studio-card-wide studio-card-blue",
    },
    {
        eyebrow: "漫剧",
        title: "角色分镜",
        detail: "封面 / 连载 / 对话",
        icon: Clapperboard,
        className: "studio-card-lilac",
    },
    {
        eyebrow: "美颜",
        title: "人像精修",
        detail: "肤色 / 光影 / 质感",
        icon: ImageIcon,
        className: "studio-card-mint",
    },
];

export default function IndexPage() {
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState<"commerce" | "drama" | "beauty">("commerce");
    const categoryContent = {
        commerce: { title: "上新视觉", route: "/image", summary: "夏季上新、商品主视觉、自然光" },
        drama: { title: "角色分镜", route: "/video", summary: "漫画分镜、角色设定、连续叙事" },
        beauty: { title: "人像精修", route: "/image", summary: "自然人像、柔和光影、细节质感" },
    } as const;
    const currentCategory = categoryContent[activeCategory];

    return (
        <main className="home-page h-full overflow-y-auto text-[#10172c]">
            <section className="home-shell">
                <div className="home-hero-grid" />
                <div className="home-orbit home-orbit-one" />
                <div className="home-orbit home-orbit-two" />

                <div className="home-content">
                    <div className="home-copy">
                        <div className="home-agent-pill">
                            <Sparkles className="size-4" />
                            <span>Agent 创作入口</span>
                        </div>
                        <h1>爱坤Ai画布</h1>
                        <p className="home-lead">把灵感放进画布，让图片、文字与视频在同一个创作空间里持续生长。</p>

                        <div className="home-category-list" aria-label="创作类型">
                            <button type="button" className={`home-category ${activeCategory === "commerce" ? "active" : ""}`} onClick={() => setActiveCategory("commerce")}>
                                <Layers3 className="size-5" />
                                <span>电商</span>
                            </button>
                            <button type="button" className={`home-category ${activeCategory === "drama" ? "active" : ""}`} onClick={() => setActiveCategory("drama")}>
                                <Clapperboard className="size-5" />
                                <span>漫剧</span>
                            </button>
                            <button type="button" className={`home-category ${activeCategory === "beauty" ? "active" : ""}`} onClick={() => setActiveCategory("beauty")}>
                                <ImageIcon className="size-5" />
                                <span>美颜</span>
                            </button>
                        </div>

                        <div className="home-steps">
                            {steps.map(({ number, label, icon: Icon }, index) => (
                                <div className="home-step" key={number}>
                                    <div className={`home-step-number ${index < 2 ? "is-active" : ""}`}>
                                        <span>{number}</span>
                                    </div>
                                    <span>{label}</span>
                                </div>
                            ))}
                        </div>

                        <button type="button" className="home-primary-action" onClick={() => navigate(currentCategory.route)}>
                            <span>开始创作</span>
                            <ArrowRight className="size-5" />
                        </button>
                    </div>

                    <div className="studio-window" aria-label="爱坤Ai创作工作台预览">
                        <div className="studio-window-bar">
                            <div className="window-dots" aria-hidden="true">
                                <span className="dot-red" />
                                <span className="dot-yellow" />
                                <span className="dot-green" />
                            </div>
                            <span className="studio-window-title">爱坤 Ai Creative Studio</span>
                            <span className="studio-status">创作任务 / 生成中</span>
                        </div>
                        <div className="studio-window-body">
                            <div className="studio-heading-row">
                                <div>
                                    <span className="studio-label">AI 创作台</span>
                                    <h2>电商、漫剧与美颜</h2>
                                </div>
                                <span className="generating-pill">
                                    <WandSparkles className="size-4" /> 正在生成
                                </span>
                            </div>

                            <div className="studio-card-grid">
                                {studioCards.map(({ eyebrow, title, detail, icon: Icon, className }, index) => {
                                    const category = index === 0 ? "commerce" : index === 1 ? "drama" : "beauty";
                                    const content = categoryContent[category];
                                    return (
                                    <button type="button" className={`studio-card ${className} ${activeCategory === category ? "studio-card-selected" : ""}`} key={title} onClick={() => setActiveCategory(category)}>
                                        <span className="studio-card-icon"><Icon className="size-7" /></span>
                                        <span className="studio-card-copy">
                                            <span className="studio-card-eyebrow">{eyebrow}</span>
                                            <strong>{content.title}</strong>
                                            <small>{detail}</small>
                                        </span>
                                    </button>
                                    );
                                })}
                            </div>

                            <div className="studio-summary">
                                <div>
                                    <span>当前描述</span>
                                    <strong>{currentCategory.summary}</strong>
                                </div>
                                <b>12 个结果</b>
                            </div>

                            <div className="studio-progress-grid">
                                <Progress label="参考图识别" value="完成" color="cyan" percent="92%" />
                                <Progress label="风格生成" value="生成中" color="pink" percent="68%" />
                                <Progress label="细节优化" value="待处理" color="yellow" percent="35%" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}

function Progress({ label, value, color, percent }: { label: string; value: string; color: "cyan" | "pink" | "yellow"; percent: string }) {
    return (
        <div className="studio-progress">
            <span>{label}</span>
            <strong>{value}</strong>
            <i className={`progress-track progress-${color}`}><em style={{ width: percent }} /></i>
        </div>
    );
}
