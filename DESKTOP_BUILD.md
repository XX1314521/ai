# AikArt 桌面版

正式桌面版会打开 `https://canvas.ikui.cn/`，开发模式仍然打开本地 Vite 服务。

## 构建 Windows 安装包

在 Windows 电脑执行：

```powershell
npm install
npm run desktop:build
```

安装包和绿色版会生成在 `release/`：

- `AikArt-0.1.0-x64-Setup.exe`：安装版
- `AikArt-0.1.0-x64-Portable.exe`：免安装版

## 本地开发桌面版

```powershell
npm run desktop:dev
```

## 修改软件加载地址

正式包默认打开 `https://canvas.ikui.cn/`。临时测试其他地址可以设置环境变量：

```powershell
$env:AIKART_APP_URL = "https://canvas.ikui.cn/"
npm run desktop:build
```

注意：桌面版只是网站的 Windows 外壳，API Key、配置、素材和生成记录仍按照网站当前的浏览器本地存储规则保存。不要把 API Key 写入 Electron 源码。
