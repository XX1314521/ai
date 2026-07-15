# AikArt Storyboard 跨平台桌面版

桌面版是独立的本地漫剧视觉工作站，只包含分镜画布、全景空间和导演台。它会从安装包内加载文件，不依赖 `canvas.ikui.cn`，项目、节点、视口和历史记录保存在当前电脑。

Web 端漫剧只保留“导入、骨架、分集、剧本”。完成剧本后点击“导出到桌面端”，再用桌面版右上角的“导入项目”按钮打开 `.aikart.json` 文件。

## 本地开发

```powershell
npm install
npm run desktop:dev
```

## Windows

```powershell
npm run desktop:build:win
```

输出目录：`release-storyboard-build/`。包含安装版和免安装版。

## macOS

需要在 macOS 电脑执行：

```bash
npm install
npm run desktop:build:mac
```

输出 DMG 和 ZIP。未配置 Apple Developer 签名时，首次打开需要在“系统设置 -> 隐私与安全性”中允许。

## Linux

需要在 Linux 电脑执行：

```bash
npm install
npm run desktop:build:linux
```

输出 AppImage 和 DEB。

桌面包不会内置 API Key。用户需要在软件右上角“配置”中填写渠道、API Key 和模型。

## 参考与归属

桌面工作流参考了 Open Storyboard Canvas：

- <https://github.com/ganbo-gab/open-storyboard-canvas>
- 上游原项目 Storyboard-Copilot：<https://github.com/henjicc/Storyboard-Copilot>

本仓库的实现为现有 AikArt 代码上的独立实现，未直接复制参考项目的大型组件。
