import React from "react";
import { createRoot } from "react-dom/client";
import "antd/dist/reset.css";
import "streamdown/styles.css";
import "./styles/globals.css";
import "./pages/comic/comic.css";
import "./pages/comic/comic-desktop.css";

import { AppProviders } from "@/components/layout/app-providers";
import { ComicDesktopApp } from "@/pages/comic/desktop";

document.body.style.fontFamily = '"SF Pro Display","SF Pro Text","PingFang SC","Microsoft YaHei","Helvetica Neue",sans-serif';

createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <AppProviders>
            <ComicDesktopApp />
        </AppProviders>
    </React.StrictMode>,
);
