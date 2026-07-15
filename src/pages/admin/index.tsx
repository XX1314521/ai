import { App, Button, Form, Input, InputNumber, Popconfirm, Select, Statistic, Table, Tabs, Tag } from "antd";
import { Ban, CheckCircle2, Database, RefreshCw, Save, ShieldCheck, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";

type AdminStats = {
    users: number; bannedUsers: number; publishedWorks: number; blockedWorks: number; storageBytes: number;
    completedOrders: number; traded: number; platformFees: number; inviteCommissions: number;
    settings: { platformFeePercent: number; inviteCommissionOfFeePercent: number; minPrice: number };
};
type AdminUser = { id: string; newApiUserId: number; username: string; displayName: string; status: "active" | "banned"; balance: number; works: number; createdAt: string; lastLoginAt: string };
type AdminWork = { id: string; title: string; accessType: string; price: number; status: string; owner: { id: string; displayName: string }; mediaUrl: string; createdAt: string };

export default function AdminPage() {
    const { message } = App.useApp();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [works, setWorks] = useState<AdminWork[]>([]);
    const [search, setSearch] = useState("");
    const [workStatus, setWorkStatus] = useState("");
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    const load = async () => {
        setLoading(true);
        try {
            const [nextStats, userResult, workResult] = await Promise.all([
                apiFetch<AdminStats>("/api/admin/stats"),
                apiFetch<{ items: AdminUser[] }>(`/api/admin/users?search=${encodeURIComponent(search)}`),
                apiFetch<{ items: AdminWork[] }>(`/api/admin/works?status=${encodeURIComponent(workStatus)}`),
            ]);
            setStats(nextStats); setUsers(userResult.items); setWorks(workResult.items);
            form.setFieldsValue(nextStats.settings);
        } catch (error) { message.error(error instanceof Error ? error.message : "读取后台数据失败"); }
        finally { setLoading(false); }
    };
    useEffect(() => { void load(); }, []);

    const updateUser = async (user: AdminUser) => {
        await apiFetch(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ status: user.status === "active" ? "banned" : "active" }) });
        message.success("用户状态已更新"); await load();
    };
    const updateWork = async (work: AdminWork, action: "block" | "restore" | "delete") => {
        await apiFetch(`/api/admin/works/${work.id}`, { method: "PATCH", body: JSON.stringify({ action }) });
        message.success("作品状态已更新"); await load();
    };
    const saveSettings = async (values: AdminStats["settings"]) => {
        await apiFetch("/api/admin/settings", { method: "PATCH", body: JSON.stringify(values) });
        message.success("平台规则已保存"); await load();
    };

    return <main className="aikart-admin-page h-full overflow-y-auto"><div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8">
        <header className="aikart-page-heading"><div><span>ADMIN CONSOLE</span><h1>后台管理</h1><p>用户、作品、交易规则与存储状态</p></div><Button icon={<RefreshCw className="size-4" />} loading={loading} onClick={() => void load()}>刷新</Button></header>
        <section className="aikart-admin-stats">
            <Statistic title="用户" value={stats?.users || 0} prefix={<Users className="size-4" />} />
            <Statistic title="公开作品" value={stats?.publishedWorks || 0} prefix={<ShieldCheck className="size-4" />} />
            <Statistic title="成交额" value={stats?.traded || 0} precision={2} />
            <Statistic title="平台手续费" value={stats?.platformFees || 0} precision={2} />
            <Statistic title="存储占用" value={formatBytes(stats?.storageBytes || 0)} prefix={<Database className="size-4" />} />
        </section>
        <Tabs items={[
            { key: "users", label: "用户管理", children: <section className="aikart-admin-section"><div className="aikart-admin-toolbar"><Input.Search value={search} allowClear placeholder="用户名或爱坤Ai用户 ID" onChange={(event) => setSearch(event.target.value)} onSearch={() => void load()} /></div><Table rowKey="id" loading={loading} dataSource={users} pagination={{ pageSize: 20 }} columns={[
                { title: "用户", render: (_: unknown, row: AdminUser) => <div><strong>{row.displayName}</strong><div className="text-xs text-slate-500">@{row.username} · 爱坤Ai #{row.newApiUserId}</div></div> },
                { title: "余额", dataIndex: "balance", width: 120 }, { title: "作品", dataIndex: "works", width: 90 },
                { title: "状态", dataIndex: "status", width: 100, render: (value: string) => <Tag color={value === "active" ? "green" : "red"}>{value === "active" ? "正常" : "已封禁"}</Tag> },
                { title: "操作", width: 130, render: (_: unknown, row: AdminUser) => <Popconfirm title={row.status === "active" ? "确认封禁该用户？" : "确认解除封禁？"} onConfirm={() => void updateUser(row)}><Button danger={row.status === "active"} icon={row.status === "active" ? <Ban className="size-4" /> : <CheckCircle2 className="size-4" />}>{row.status === "active" ? "封禁" : "解封"}</Button></Popconfirm> },
            ]} /></section> },
            { key: "works", label: "作品管理", children: <section className="aikart-admin-section"><div className="aikart-admin-toolbar"><Select value={workStatus} options={[{label:"全部状态",value:""},{label:"已发布",value:"published"},{label:"已封禁",value:"blocked"},{label:"已删除",value:"deleted"},{label:"我的作品",value:"saved"}]} onChange={(value) => { setWorkStatus(value); setTimeout(() => void load(), 0); }} /></div><Table rowKey="id" loading={loading} dataSource={works} pagination={{ pageSize: 20 }} columns={[
                { title: "预览", dataIndex: "mediaUrl", width: 90, render: (value: string) => <img className="size-14 rounded-lg object-cover" src={value} alt="" /> },
                { title: "作品", render: (_: unknown, row: AdminWork) => <div><strong>{row.title}</strong><div className="text-xs text-slate-500">{row.owner.displayName}</div></div> },
                { title: "类型", width: 110, render: (_: unknown, row: AdminWork) => <Tag>{row.accessType === "paid" ? `付费 ${row.price}` : row.accessType === "free" ? "免费" : "私密"}</Tag> },
                { title: "状态", dataIndex: "status", width: 100 },
                { title: "操作", width: 210, render: (_: unknown, row: AdminWork) => <div className="flex gap-2">{row.status === "blocked" ? <Button icon={<CheckCircle2 className="size-4" />} onClick={() => void updateWork(row,"restore")}>恢复</Button> : <Button icon={<Ban className="size-4" />} onClick={() => void updateWork(row,"block")}>封禁</Button>}<Popconfirm title="确认删除该作品？" onConfirm={() => void updateWork(row,"delete")}><Button danger icon={<Trash2 className="size-4" />} /></Popconfirm></div> },
            ]} /></section> },
            { key: "rules", label: "交易规则", children: <section className="aikart-admin-section max-w-2xl"><Form form={form} layout="vertical" onFinish={(values) => void saveSettings(values)}><Form.Item name="platformFeePercent" label="平台手续费（%）" rules={[{required:true}]}><InputNumber min={0} max={100} precision={2} className="w-full" /></Form.Item><Form.Item name="inviteCommissionOfFeePercent" label="邀请佣金占平台手续费（%）" extra="例如平台手续费 10%，此处 30%，则邀请人获得成交价的 3%。"><InputNumber min={0} max={100} precision={2} className="w-full" /></Form.Item><Form.Item name="minPrice" label="付费提示词最低价格" extra="最高价格不限制"><InputNumber min={0.1} precision={4} className="w-full" /></Form.Item><Button type="primary" htmlType="submit" icon={<Save className="size-4" />}>保存规则</Button></Form></section> },
        ]} />
    </div></main>;
}

function formatBytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`; if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`; return `${(value / 1024 ** 3).toFixed(2)} GB`; }
