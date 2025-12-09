# @editorjs/wavedrom

[Editor.js](https://editorjs.io) 的 WaveDrom 波形图插件。允许用户在编辑器中使用 WaveJSON 语法绘制数字时序图（Digital Timing Diagram）。

![Preview](https://raw.githubusercontent.com/wavedrom/wavedrom/master/images/logo.png)

## 功能特点

- **实时预览**：在编辑器中直接编写 WaveJSON 代码，上方即时渲染波形图。
- **双视图模式**：上半部分显示 SVG 渲染结果，下半部分显示代码编辑区。
- **只读支持**：在只读模式下，自动隐藏代码编辑区，仅展示波形图。
- **轻量级**：集成 WaveDrom 核心库，无需额外复杂的配置。

## 编译
```
./build_dist_copy.bat
```
生成的目标文件位于/dist/wavedrom.umd.js
将该文件静态引入到工程中即可。


## 使用方法

在 Editor.js 的 `tools` 配置中引入该插件：

```javascript
    <!-- 引入本地构建好的 WaveDrom BlockTool（UMD，会挂载为 window.Wavedrom） -->
    <script src="../dist/wavedrom.umd.js"></script>

const editor = new EditorJS({
  holder: 'editorjs',
  tools: {
    wavedrom: {
      class: Wavedrom,
      config: {
        // 可选配置
        previewHeight: 300, // 预览区域高度
        defaultWaveJSON: '{ signal: [{ name: "clk", wave: "p." }] }' // 默认模板
      }
    }
  }
});
```

### 配置项 (Config)

| 参数名 | 类型 | 默认值 | 描述 |
| --- | --- | --- | --- |
| `previewHeight` | `number` | `260` | 预览区域的最大高度（像素）。 |
| `defaultWaveJSON` | `string` | (内置默认模板) | 当创建一个新块时，默认填充的 WaveJSON 代码。 |

## 输出数据格式

插件生成的数据包含 WaveJSON 源代码字符串：

```json
{
  "type": "wavedrom",
  "data": {
    "code": "{ signal: [{ name: \"clk\", wave: \"p...\" }, { name: \"data\", wave: \"0.1.\", data: [\"head\", \"body\"] }] }"
  }
}
```

## 开发与构建

本项目使用 Vite 进行构建。

### 安装依赖

```bash
npm install
```

### 开发模式

启动开发服务器（无预览页面，通常配合 demo 使用）：

```bash
npm run dev
```

### 构建

构建生产版本（输出到 `dist/` 目录）：

```bash
npm run build
```

### 本地测试

项目包含一个基于 HTML 的简单测试页面，位于 `test/` 目录下。

1. 构建项目：`npm run build`
2. 使用浏览器打开 `test/editor-test-simple.html` 即可测试插件功能。

## 关于 WaveDrom

WaveDrom 是一个基于 JavaScript 的数字时序图绘制引擎。它使用 JSON 来描述波形。

更多语法和示例请参考 [WaveDrom 官方文档](https://wavedrom.com/tutorial.html)。

## License

MIT
