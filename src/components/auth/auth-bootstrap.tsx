import { useEffect, type ReactNode } from "react";

import { useAuthStore } from "@/stores/use-auth-store";

export function AuthBootstrap({ children }: { children: ReactNode }) {
    const initialize = useAuthStore((state) => state.initialize);
    useEffect(() => {
        void initialize();
    }, [initialize]);
    return children;
}
