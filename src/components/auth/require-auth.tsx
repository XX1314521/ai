import { LoaderCircle } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuthStore } from "@/stores/use-auth-store";

export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
    const location = useLocation();
    const status = useAuthStore((state) => state.status);
    const user = useAuthStore((state) => state.user);
    const initialize = useAuthStore((state) => state.initialize);
    useEffect(() => {
        if (status === "idle") void initialize();
    }, [initialize, status]);

    if (status === "idle" || status === "loading") {
        return (
            <div className="grid h-full place-items-center bg-[#f5f7fb] text-slate-500">
                <div className="flex items-center gap-2 text-sm">
                    <LoaderCircle className="size-4 animate-spin" /> 正在验证登录状态
                </div>
            </div>
        );
    }
    if (!user) {
        const returnTo = `${location.pathname}${location.search}`;
        return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
    }
    if (admin && user.role !== "admin") return <Navigate to="/" replace />;
    return children;
}
