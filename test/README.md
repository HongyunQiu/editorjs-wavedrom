# WaveDrom Editor.js Tool 测试页

本目录下的测试文件基于 `/QNotes/test` 中的 Editor.js 功能测试页面简化/移植，并用于验证 **WaveDrom 波形 BlockTool（editorjs-wavedrom 插件）**。

## 文件说明

- `editor-test-simple.html` - 使用 CDN 加载 Editor.js + 常用工具，并通过本地构建的 `wavedrom.umd.js` 测试 WaveDrom 波形工具
- `editor-test.js` - 简化版测试脚本，初始化 Editor.js、注册 `wavedrom` 工具，并支持保存/加载内容
- `editor-test.css` - 测试页面样式（复用 QNotes 测试页的布局与样式）

## 使用方法

1. 在 `PlugIns/editorjs-wavedrom` 目录下安装依赖并构建：

   ```bash
   npm install
   npx --yes vite build
   ```

   或者直接运行你已经在仓库中的批处理脚本：

   ```bash
   .\build_dist_copy.bat
   ```

2. 用浏览器直接打开 `test/editor-test-simple.html`（本地文件即可）。
3. 点击“初始化编辑器”，确认：
   - Editor.js 能正常初始化；
   - 工具栏菜单中可以插入 “WaveDrom” 类型的块（`wavedrom`）；
   - 默认会渲染一个简单的示例时序波形；
   - 修改下方 WaveJSON 文本后，上方 SVG 预览会实时更新；
   - 点击 “保存内容” 可以在右侧看到包含 `wavedrom` 块及其 `code` 字段（WaveJSON 字符串）的 JSON 输出。

## 注意事项

- `editor-test-simple.html` 通过 `<script src="../dist/wavedrom.umd.js"></script>` 引入本地构建产物，请先执行构建命令。
- 如果网络环境无法访问 jsDelivr/CDN，可将 Editor.js 及其工具的脚本改为本地路径再测试。
