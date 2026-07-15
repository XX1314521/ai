const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow, shell, session } = require("electron");

const isDev = process.argv.includes("--dev");
const devUrl = "http://127.0.0.1:3000/desktop.html";
const desktopFile = path.join(__dirname, "..", "dist-desktop", "desktop.html");
const desktopFileUrl = pathToFileURL(desktopFile).href;

function isAllowedAppUrl(url) {
    try {
        const parsed = new URL(url);
        if (isDev) return parsed.origin === new URL(devUrl).origin;
        return parsed.protocol === "file:" && parsed.href.split("#")[0].split("?")[0] === desktopFileUrl;
    } catch {
        return false;
    }
}

function createWindow() {
    const window = new BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 1024,
        minHeight: 700,
        show: false,
        backgroundColor: "#f5f8fb",
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });

    window.once("ready-to-show", () => window.show());
    window.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:/i.test(url)) void shell.openExternal(url);
        return { action: "deny" };
    });
    window.webContents.on("will-navigate", (event, url) => {
        if (!isAllowedAppUrl(url)) {
            event.preventDefault();
            if (/^https?:/i.test(url)) void shell.openExternal(url);
        }
    });

    if (isDev) {
        void window.loadURL(devUrl);
    } else {
        void window.loadFile(desktopFile);
    }
}

app.whenReady().then(() => {
    app.setAppUserModelId("cn.aikart.storyboard");
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
