import { apiFetch } from "@/lib/api-client";

export type PlatformLibraryItem = {
    id: string;
    kind: "text" | "image" | "video";
    title: string;
    content: string;
    tags: string[];
    note: string;
    source: string;
    metadata: Record<string, unknown>;
    media: null | { id: string; url: string; downloadUrl: string; mimeType: string; bytes: number; width: number | null; height: number | null };
    createdAt: string;
    updatedAt: string;
};

export async function listPlatformLibrary() {
    return apiFetch<{ items: PlatformLibraryItem[]; total: number }>("/api/library?pageSize=200");
}

export async function createPlatformLibraryItem(input: { kind: "text" | "image" | "video"; title: string; mediaId?: string; content?: string; tags?: string[]; note?: string; source?: string; metadata?: Record<string, unknown> }) {
    return (await apiFetch<{ item: PlatformLibraryItem }>("/api/library", { method: "POST", body: JSON.stringify(input) })).item;
}

export async function updatePlatformLibraryItem(id: string, input: { title?: string; content?: string; tags?: string[]; note?: string; source?: string; metadata?: Record<string, unknown> }) {
    await apiFetch(`/api/library/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function deletePlatformLibraryItem(id: string) {
    await apiFetch(`/api/library/${id}`, { method: "DELETE" });
}
