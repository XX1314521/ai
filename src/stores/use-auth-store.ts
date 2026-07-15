import { create } from "zustand";

import { apiFetch } from "@/lib/api-client";
import type { PlatformUser } from "@/types/platform";

type AuthStatus = "idle" | "loading" | "authenticated" | "anonymous";

type AuthStore = {
    status: AuthStatus;
    user: PlatformUser | null;
    initialize: (force?: boolean) => Promise<PlatformUser | null>;
    login: (input: { username: string; password: string; inviteCode?: string }) => Promise<PlatformUser>;
    logout: () => Promise<void>;
    refresh: () => Promise<PlatformUser | null>;
    setBalance: (balance: number) => void;
};

let initialization: Promise<PlatformUser | null> | null = null;

export const useAuthStore = create<AuthStore>((set, get) => ({
    status: "idle",
    user: null,
    initialize: async (force = false) => {
        if (!force && get().status === "authenticated") return get().user;
        if (!force && initialization) return initialization;
        set({ status: "loading" });
        initialization = apiFetch<{ user: PlatformUser | null }>("/api/auth/me")
            .then(({ user }) => {
                set({ user, status: user ? "authenticated" : "anonymous" });
                return user;
            })
            .catch(() => {
                set({ user: null, status: "anonymous" });
                return null;
            })
            .finally(() => {
                initialization = null;
            });
        return initialization;
    },
    login: async (input) => {
        set({ status: "loading" });
        try {
            const { user } = await apiFetch<{ user: PlatformUser }>("/api/auth/login", {
                method: "POST",
                body: JSON.stringify(input),
            });
            set({ user, status: "authenticated" });
            return user;
        } catch (error) {
            set({ user: null, status: "anonymous" });
            throw error;
        }
    },
    logout: async () => {
        await apiFetch<{ success: boolean }>("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        set({ user: null, status: "anonymous" });
    },
    refresh: async () => get().initialize(true),
    setBalance: (balance) => set((state) => ({ user: state.user ? { ...state.user, balance } : null })),
}));
