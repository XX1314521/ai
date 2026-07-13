import localforage from "localforage";

import { nanoid } from "nanoid";
import { readImageMeta } from "@/lib/image-utils";

export type UploadedImage = {
    url: string;
    storageKey: string;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
};

// Keep image blobs in their own database. Adding stores to the shared app
// database can leave IndexedDB upgrades blocked by another open tab.
const store = localforage.createInstance({ name: "infinite-canvas-images", storeName: "files" });
const legacyStore = localforage.createInstance({ name: "infinite-canvas", storeName: "image_files" });
const objectUrls = new Map<string, string>();
const STORAGE_TIMEOUT_MS = 10_000;

export async function uploadImage(input: string | Blob): Promise<UploadedImage> {
    const blob = typeof input === "string" ? await fetchImageBlob(input) : input;
    const storageKey = `image:${nanoid()}`;
    const url = URL.createObjectURL(blob);
    objectUrls.set(storageKey, url);
    const metaPromise = readImageMeta(url);

    try {
        await withStorageTimeout(store.setItem(storageKey, blob), "保存图片超时，请刷新页面后重试");
        const meta = await metaPromise;
        return { url, storageKey, width: meta.width, height: meta.height, bytes: blob.size, mimeType: blob.type || meta.mimeType };
    } catch (error) {
        objectUrls.delete(storageKey);
        URL.revokeObjectURL(url);
        throw error;
    }
}

export async function resolveImageUrl(storageKey?: string, fallback = "") {
    if (!storageKey) return fallback;
    const cached = objectUrls.get(storageKey);
    if (cached) return cached;
    const blob = await getImageBlob(storageKey);
    if (!blob) return fallback;
    const url = URL.createObjectURL(blob);
    objectUrls.set(storageKey, url);
    return url;
}

export async function getImageBlob(storageKey: string) {
    const current = await readImageStore(store, storageKey);
    if (current) return current;

    const legacy = await readImageStore(legacyStore, storageKey);
    if (legacy) {
        void withStorageTimeout(store.setItem(storageKey, legacy), "迁移图片超时").catch(() => undefined);
    }
    return legacy;
}

export async function setImageBlob(storageKey: string, blob: Blob) {
    await withStorageTimeout(store.setItem(storageKey, blob), "保存图片超时，请刷新页面后重试");
    const url = URL.createObjectURL(blob);
    objectUrls.set(storageKey, url);
    return url;
}

export async function imageToDataUrl(image: { url?: string; dataUrl?: string; storageKey?: string }) {
    const url = image.dataUrl || (await resolveImageUrl(image.storageKey, image.url || ""));
    if (!url || url.startsWith("data:")) return url;
    return blobToDataUrl(await (await fetch(url)).blob());
}

export async function deleteStoredImages(keys: Iterable<string>) {
    await Promise.all(
        Array.from(new Set(keys)).map(async (key) => {
            const url = objectUrls.get(key);
            if (url) URL.revokeObjectURL(url);
            objectUrls.delete(key);
            await Promise.all([
                withStorageTimeout(store.removeItem(key), "删除图片超时").catch(() => undefined),
                withStorageTimeout(legacyStore.removeItem(key), "删除旧图片超时").catch(() => undefined),
            ]);
        }),
    );
}

export async function cleanupUnusedImages(usedData: unknown) {
    const usedKeys = collectImageStorageKeys(usedData);
    const [currentKeys, legacyKeys] = await Promise.all([listImageKeys(store), listImageKeys(legacyStore)]);
    const unused = [...currentKeys, ...legacyKeys].filter((key) => !usedKeys.has(key));
    await deleteStoredImages(unused);
}

export function collectImageStorageKeys(value: unknown, keys = new Set<string>()) {
    if (!value || typeof value !== "object") return keys;
    if ("storageKey" in value && typeof value.storageKey === "string" && value.storageKey.startsWith("image:")) keys.add(value.storageKey);
    Object.values(value).forEach((item) => (Array.isArray(item) ? item.forEach((child) => collectImageStorageKeys(child, keys)) : collectImageStorageKeys(item, keys)));
    return keys;
}

function blobToDataUrl(blob: Blob) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("读取图片失败"));
        reader.readAsDataURL(blob);
    });
}

async function fetchImageBlob(url: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`读取图片失败（HTTP ${response.status}）`);
    return response.blob();
}

async function readImageStore(imageStore: LocalForage, storageKey: string) {
    try {
        return await withStorageTimeout(imageStore.getItem<Blob>(storageKey), "读取图片超时");
    } catch {
        return null;
    }
}

async function listImageKeys(imageStore: LocalForage) {
    try {
        return await withStorageTimeout(imageStore.keys(), "读取图片列表超时");
    } catch {
        return [];
    }
}

function withStorageTimeout<T>(promise: Promise<T>, message: string, timeoutMs = STORAGE_TIMEOUT_MS) {
    return new Promise<T>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
        promise.then(
            (value) => {
                window.clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                window.clearTimeout(timer);
                reject(error);
            },
        );
    });
}
