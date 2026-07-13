const { app, BrowserWindow, shell, session } = require("electron");

const isDev = process.argv.includes("--dev");
const devUrl = "http://127.0.0.1:3000";
const productionUrl = process.env.AIKART_APP_URL || "https://canvas.ikui.cn/";

function isAllowedAppUrl(url) {
    try {
        const parsed = new URL(url);
        const appOrigin = new URL(productionUrl).origin;
        return parsed.origin === appOrigin;
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
        const allowed = isDev ? url.startsWith(devUrl) : isAllowedAppUrl(url);
        if (!allowed) {
            event.preventDefault();
            if (/^https?:/i.test(url)) void shell.openExternal(url);
        }
    });

    if (isDev) {
        void window.loadURL(devUrl);
        window.webContents.openDevTools({ mode: "detach" });
    } else {
        void window.loadURL(productionUrl);
    }
}

app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
