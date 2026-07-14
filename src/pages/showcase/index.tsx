import { Images } from "lucide-react";

export default function ShowcasePage() {
    return (
        <main className="showcase-page flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="showcase-placeholder">
                <span><Images className="size-7" /></span>
                <h1>作品展示</h1>
                <p>作品展示功能即将上线</p>
            </div>
        </main>
    );
}

