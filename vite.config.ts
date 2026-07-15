import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { parseChangelog } from "./src/lib/release";

const webDir = dirname(fileURLToPath(import.meta.url));
const localVersion = readFileSync(resolve(webDir, "VERSION"), "utf8").trim() || "dev";
const localChangelog = readFileSync(resolve(webDir, "CHANGELOG.md"), "utf8");
const isDesktopBuild = process.env.VITE_DESKTOP === "true";

export default defineConfig({
    base: process.env.VITE_BASE || (isDesktopBuild ? "./" : "/"),
    plugins: [react()],
    optimizeDeps: {
        include: ["react-router", "react-router-dom"],
    },
    resolve: {
        alias: {
            "@": resolve(webDir, "src"),
        },
    },
    define: {
        __APP_VERSION__: JSON.stringify(localVersion),
        __APP_RELEASES__: JSON.stringify(parseChangelog(localChangelog)),
    },
    server: {
        proxy: {
            "/api": {
                target: process.env.VITE_API_PROXY || "http://127.0.0.1:4000",
                changeOrigin: true,
            },
        },
    },
    build: isDesktopBuild
        ? {
              outDir: "dist-desktop",
              emptyOutDir: true,
              rollupOptions: {
                  input: resolve(webDir, "desktop.html"),
              },
          }
        : undefined,
});
