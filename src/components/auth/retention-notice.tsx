import { Archive, Clock3, UploadCloud } from "lucide-react";
import { Modal } from "antd";
import { useEffect, useState } from "react";

import { useAuthStore } from "@/stores/use-auth-store";

export function RetentionNotice() {
    const user = useAuthStore((state) => state.user);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (!user) return;
        const key = `aikart:retention-notice:${user.id}:v1`;
        if (!localStorage.getItem(key)) setOpen(true);
    }, [user]);

    const close = () => {
        if (user) localStorage.setItem(`aikart:retention-notice:${user.id}:v1`, new Date().toISOString());
        setOpen(false);
    };
    return (
        <Modal className="aikart-retention-modal" title="作品保存规则" open={open} centered onOk={close} onCancel={close} cancelButtonProps={{ style: { display: "none" } }} okText="我知道了">
            <div className="grid gap-3 py-2 text-sm text-slate-600">
                <p className="m-0 flex gap-3"><UploadCloud className="mt-0.5 size-5 shrink-0 text-emerald-500" /><span><strong className="text-slate-900">手动上传的素材永久保存</strong><br />上传到“我的素材”的原始文件不会自动清理。</span></p>
                <p className="m-0 flex gap-3"><Archive className="mt-0.5 size-5 shrink-0 text-sky-500" /><span><strong className="text-slate-900">已保存或已发布的生成结果永久保留</strong><br />保存到我的作品或发布到作品展示后，不受清理时间影响。</span></p>
                <p className="m-0 flex gap-3"><Clock3 className="mt-0.5 size-5 shrink-0 text-amber-500" /><span><strong className="text-slate-900">未保存、未发布的生成结果保留 {user?.retentionDays || 7} 天</strong><br />到期后服务器会自动释放存储空间。</span></p>
            </div>
        </Modal>
    );
}
