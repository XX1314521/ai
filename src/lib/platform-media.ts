import { apiFetch } from "@/lib/api-client";

export type ServerMedia = {
    id: string;
    url: string;
    downloadUrl: string;
    retention: "draft" | "saved" | "published" | "permanent";
};

export async function uploadGeneratedDraft(input: { dataUrl: string; filename?: string; width?: number; height?: number }) {
    const response = await fetch(input.dataUrl);
    if (!response.ok) throw new Error("无法读取生成结果");
    const blob = await response.blob();
    const extension = blob.type.split("/")[1] || "png";
    const file = new File([blob], input.filename || `aikart-${Date.now()}.${extension}`, { type: blob.type || "image/png" });
    const form = new FormData();
    form.append("file", file);
    const params = new URLSearchParams({ source: "generated" });
    if (input.width) params.set("width", String(input.width));
    if (input.height) params.set("height", String(input.height));
    return (await apiFetch<{ media: ServerMedia }>(`/api/media?${params}`, { method: "POST", body: form })).media;
}

export async function uploadPermanentMedia(file: File) {
    const form = new FormData();
    form.append("file", file);
    return (await apiFetch<{ media: ServerMedia }>("/api/media?source=upload", { method: "POST", body: form })).media;
}

export async function uploadDataUrlPermanent(dataUrl: string, filename = `aikart-${Date.now()}.png`) {
    const response = await fetch(dataUrl);
    if (!response.ok) throw new Error("无法读取素材文件");
    const blob = await response.blob();
    return uploadPermanentMedia(new File([blob], filename, { type: blob.type || "image/png" }));
}

export async function keepServerMedia(mediaId?: string) {
    if (!mediaId) return;
    await apiFetch(`/api/media/${mediaId}/save`, { method: "PATCH" });
}
