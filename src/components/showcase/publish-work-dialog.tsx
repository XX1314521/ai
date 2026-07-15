import { App, Button, Input, InputNumber, Modal, Segmented } from "antd";
import { Archive, Check, ImagePlus, LoaderCircle, Sparkles, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api-client";

export type PublishSource = {
    dataUrl: string;
    mediaId?: string;
    title?: string;
    prompt?: string;
    description?: string;
    metadata?: Record<string, unknown>;
};

export function PublishWorkDialog({ open, source, onClose, onPublished }: { open: boolean; source?: PublishSource | null; onClose: () => void; onPublished?: () => void }) {
    const { message } = App.useApp();
    const fileInput = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [prompt, setPrompt] = useState("");
    const [accessType, setAccessType] = useState<"private" | "free" | "paid">("free");
    const [price, setPrice] = useState(0.1);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setFile(null);
        setTitle(source?.title || "");
        setDescription(source?.description || "");
        setPrompt(source?.prompt || "");
        setAccessType("free");
        setPrice(0.1);
    }, [open, source]);

    const previewUrl = source?.dataUrl || (file ? URL.createObjectURL(file) : "");
    useEffect(() => {
        if (!file || source?.dataUrl) return;
        const url = previewUrl;
        return () => URL.revokeObjectURL(url);
    }, [file, previewUrl, source?.dataUrl]);

    const publish = async () => {
        if (!source?.dataUrl && !file) { message.warning("请先选择作品图片"); return; }
        if (!title.trim()) { message.warning("请填写作品标题"); return; }
        if (accessType !== "private" && !prompt.trim()) { message.warning("公开作品需要填写提示词"); return; }
        setLoading(true);
        try {
            let mediaId = source?.mediaId;
            if (!mediaId) {
                const upload = file || await sourceToFile(source!.dataUrl, title);
                const formData = new FormData();
                formData.append("file", upload);
                const mediaResult = await apiFetch<{ media: { id: string } }>(`/api/media?source=${source ? "generated" : "upload"}`, { method: "POST", body: formData });
                mediaId = mediaResult.media.id;
            }
            await apiFetch("/api/works", {
                method: "POST",
                body: JSON.stringify({ mediaId, title: title.trim(), description: description.trim(), prompt: prompt.trim(), accessType, price: accessType === "paid" ? price : 0, metadata: source?.metadata || {} }),
            });
            message.success(accessType === "private" ? "已保存到我的作品" : "作品已发布");
            onPublished?.();
            onClose();
        } catch (error) { message.error(error instanceof Error ? error.message : "保存作品失败"); }
        finally { setLoading(false); }
    };

    return <Modal className="aikart-publish-modal" title={<div className="aikart-publish-title"><Sparkles className="size-5" /><div><strong>发布作品</strong><span>保存后生成结果不会被自动清理</span></div></div>} open={open} onCancel={onClose} width={820} centered footer={null} destroyOnHidden>
        <div className="aikart-publish-layout">
            <div className="aikart-publish-media">
                <input ref={fileInput} type="file" accept="image/*" hidden onChange={(event) => setFile(event.target.files?.[0] || null)} />
                {previewUrl ? <button type="button" onClick={() => !source && fileInput.current?.click()}><img src={previewUrl} alt="作品预览" /><span><ImagePlus className="size-4" />{source ? "生成结果" : "更换图片"}</span></button> : <button type="button" className="is-empty" onClick={() => fileInput.current?.click()}><Upload className="size-7" /><strong>选择作品图片</strong><small>手动上传的素材永久保存</small></button>}
            </div>
            <div className="aikart-publish-form">
                <label>作品标题<Input value={title} maxLength={120} placeholder="给作品起一个名字" onChange={(event) => setTitle(event.target.value)} /></label>
                <label>作品说明<Input.TextArea value={description} maxLength={2000} rows={2} placeholder="可选" onChange={(event) => setDescription(event.target.value)} /></label>
                <label>展示方式<Segmented block value={accessType} options={[{ label: "我的作品", value: "private", icon: <Archive className="size-4" /> }, { label: "免费公开", value: "free", icon: <Sparkles className="size-4" /> }, { label: "付费公开", value: "paid", icon: <Check className="size-4" /> }]} onChange={(value) => setAccessType(value as typeof accessType)} /></label>
                {accessType === "paid" ? <label>提示词价格<InputNumber className="w-full" min={0.1} precision={4} value={price} addonAfter="余额" onChange={(value) => setPrice(Number(value) || 0.1)} /></label> : null}
                <label>提示词<Input.TextArea value={prompt} maxLength={50000} rows={5} placeholder={accessType === "private" ? "可选" : "复制或购买后提供给其他用户"} onChange={(event) => setPrompt(event.target.value)} /></label>
                <Button type="primary" size="large" block disabled={loading} onClick={() => void publish()}>{loading ? <><LoaderCircle className="size-4 animate-spin" /> 正在保存</> : accessType === "private" ? "保存到我的作品" : "立即发布"}</Button>
            </div>
        </div>
    </Modal>;
}

async function sourceToFile(dataUrl: string, title: string) {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error("无法读取生成图片");
    const blob = await response.blob();
    const extension = blob.type.split("/")[1] || "png";
    return new File([blob], `${title || "aikart-work"}.${extension}`, { type: blob.type || "image/png" });
}
