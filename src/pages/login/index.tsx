import { App, Button, Input } from "antd";
import { ArrowRight, ExternalLink, Gift, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { useAuthStore } from "@/stores/use-auth-store";

export default function LoginPage() {
    const { message } = App.useApp();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const user = useAuthStore((state) => state.user);
    const status = useAuthStore((state) => state.status);
    const login = useAuthStore((state) => state.login);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [inviteCode, setInviteCode] = useState(searchParams.get("invite") || "");
    const returnTo = useMemo(() => {
        const value = searchParams.get("returnTo") || "/";
        return value.startsWith("/") && !value.startsWith("//") ? value : "/";
    }, [searchParams]);

    if (user && status === "authenticated") return <Navigate to={returnTo} replace />;

    const submit = async () => {
        if (!username.trim() || !password) {
            message.warning("请输入爱坤Ai账号和密码");
            return;
        }
        setLoading(true);
        try {
            await login({ username: username.trim(), password, inviteCode });
            message.success("登录成功");
            navigate(returnTo, { replace: true });
        } catch (error) {
            message.error(error instanceof Error ? error.message : "登录失败");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="aikart-login-page">
            <Link to="/" className="aikart-login-brand"><span className="aikart-login-logo" />AikArt</Link>
            <section className="aikart-login-panel">
                <div className="aikart-login-heading">
                    <span><ShieldCheck className="size-4" /> 安全登录</span>
                    <h1>欢迎回到 AikArt</h1>
                    <p>使用你的爱坤Ai账号继续创作</p>
                </div>
                <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
                    <label>爱坤Ai账号<Input size="large" prefix={<UserRound className="size-4 text-slate-400" />} value={username} autoComplete="username" placeholder="用户名" onChange={(event) => setUsername(event.target.value)} /></label>
                    <label>密码<Input.Password size="large" prefix={<KeyRound className="size-4 text-slate-400" />} value={password} autoComplete="current-password" placeholder="密码" onChange={(event) => setPassword(event.target.value)} /></label>
                    <label>邀请码（选填）<Input size="large" prefix={<Gift className="size-4 text-slate-400" />} value={inviteCode} placeholder="AikArt 或爱坤Ai邀请码 / 邀请链接" onChange={(event) => setInviteCode(event.target.value)} /></label>
                    {inviteCode ? <div className="aikart-login-invite">邀请关系只会在首次登录时绑定，请确认邀请码来源。</div> : null}
                    <Button htmlType="submit" type="primary" size="large" loading={loading} block>登录并继续 <ArrowRight className="size-4" /></Button>
                </form>
                <div className="aikart-login-register">
                    <span>还没有爱坤Ai账号？</span>
                    <Button type="link" href="https://ai.ikui.cn/sign-up">立即注册 <ExternalLink className="size-3.5" /></Button>
                </div>
                <div className="aikart-login-foot">AikArt 不会把完整访问密钥发送到浏览器</div>
            </section>
        </main>
    );
}
