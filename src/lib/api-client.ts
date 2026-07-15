export class ApiClientError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code = "request_error",
    ) {
        super(message);
    }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    headers.set("Accept", "application/json");
    const response = await fetch(path, { ...init, headers, credentials: "include" });
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
        ? ((await response.json().catch(() => ({}))) as Record<string, unknown>)
        : ({ message: await response.text().catch(() => "") } as Record<string, unknown>);
    if (!response.ok) {
        const error = payload.error && typeof payload.error === "object" ? (payload.error as Record<string, unknown>) : payload;
        throw new ApiClientError(
            typeof error.message === "string" && error.message ? error.message : `请求失败（${response.status}）`,
            response.status,
            typeof error.code === "string" ? error.code : "request_error",
        );
    }
    return payload as T;
}
