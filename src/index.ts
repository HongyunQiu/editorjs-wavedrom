import './index.css';

import { IconQuote } from '@codexteam/icons';
import { make } from '@editorjs/dom';
import type { API, BlockAPI, BlockTool, ToolConfig, SanitizerConfig } from '@editorjs/editorjs';
import WaveDrom from 'wavedrom';
import CodeFlask from 'codeflask';

/**
 * WaveDrom 工具的配置
 */
export interface WavedromConfig extends ToolConfig {
  /**
   * 初始 WaveJSON 模板（字符串形式）
   */
  defaultWaveJSON?: string;

  /**
   * 预览区域高度（像素）
   */
  previewHeight?: number;
}

/**
 * WaveDrom 工具的数据结构
 */
export interface WavedromData {
  /**
   * WaveJSON 源码字符串
   */
  code: string;
}

/**
 * 构造参数
 */
interface WavedromParams {
  data: WavedromData;
  config?: WavedromConfig;
  api: API;
  readOnly: boolean;
  block: BlockAPI;
}

/**
 * CSS 类名集合
 */
interface WavedromCSS {
  baseClass: string;
  wrapper: string;
  previewWrapper: string;
  preview: string;
  error: string;
  editor: string;
  textarea: string;
}

/**
 * 在浏览器中安全地解析 WaveJSON 字符串为对象。
 *
 * 说明：
 * - WaveJSON 官方示例多为 JS 对象字面量（非严格 JSON），因此这里采用 Function 包装的方式解析；
 * - 该解析仅在当前用户浏览器内执行，不会在服务端执行。
 */
function parseWaveJSON(source: string): unknown {
  const code = (source || '').trim();
  if (!code) {
    return null;
  }

  const wrapped = /^\s*[{\[]/.test(code) ? `(${code})` : code;

  // eslint-disable-next-line no-new-func
  const fn = new Function(`return ${wrapped};`);
  return fn();
}

/**
 * Editor.js WaveDrom BlockTool
 *
 * 上半部分：WaveJSON 文本编辑区域
 * 下半部分：波形图 SVG 预览
 */
export default class WavedromBlock implements BlockTool {
  private api: API;
  private readOnly: boolean;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private block: BlockAPI;

  private data: WavedromData;
  private css: WavedromCSS;
  private config: WavedromConfig;
  // 使用 CodeFlask 作为 WaveJSON 编辑器实例（仅在非只读模式下存在）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private editorInstance: any | null = null;

  constructor({ data, config, api, readOnly, block }: WavedromParams) {
    this.api = api;
    this.readOnly = readOnly;
    this.block = block;

    const defaultTemplate =
      '{\n' +
      '  signal: [\n' +
      '    { name: "clk",  wave: "p....." },\n' +
      '    { name: "req",  wave: "0.1.0." },\n' +
      '    { name: "ack",  wave: "1....." },\n' +
      '    { name: "data", wave: "x.345x", data: ["head", "body", "tail"] }\n' +
      '  ]\n' +
      '}\n';

    this.config = {
      ...config,
    };

    this.data = {
      code: (data && typeof data.code === 'string' ? data.code : '') || config?.defaultWaveJSON || defaultTemplate,
    };

    this.css = {
      baseClass: this.api.styles.block,
      wrapper: 'cdx-wavedrom',
      previewWrapper: 'cdx-wavedrom__preview-wrapper',
      preview: 'cdx-wavedrom__preview',
      error: 'cdx-wavedrom__error',
      editor: 'cdx-wavedrom__editor',
      textarea: 'cdx-wavedrom__textarea',
    };
  }

  public static get isReadOnlySupported(): boolean {
    return true;
  }

  public static get toolbox(): { icon: string; title: 'WaveDrom'; } {
    return {
      icon: IconQuote,
      title: 'WaveDrom',
    };
  }

  public static get contentless(): boolean {
    return true;
  }

  public static get enableLineBreaks(): boolean {
    return true;
  }

  public render(): HTMLElement {
    const container = make('div', [this.css.baseClass, this.css.wrapper]);

    const previewWrapper = make('div', [this.css.previewWrapper]);
    const preview = make('div', [this.css.preview]);
    const errorEl = make('div', [this.css.error]);

    previewWrapper.appendChild(preview);
    previewWrapper.appendChild(errorEl);

    const applyPreview = () => {
      if (!preview || !errorEl) {
        return;
      }

      const raw = this.data.code || '';

      preview.innerHTML = '';
      errorEl.textContent = '';

      const trimmed = raw.trim();
      if (!trimmed) {
        const placeholder = make('div', [], {
          innerHTML: this.api.i18n.t('输入 WaveJSON 以渲染波形（示例见上方编辑区）'),
        });
        preview.appendChild(placeholder);
        return;
      }

      try {
        const waveObject = parseWaveJSON(trimmed) as unknown;
        if (!waveObject) {
          errorEl.textContent = this.api.i18n.t('无法解析 WaveJSON，请检查语法。');
          return;
        }

        // wavedrom 的 CJS 库并不提供 WaveDrom.render，而是提供：
        // - renderAny(index, source, waveSkin, notFirstSignal)
        // - onml.stringify(tree) 将 ONML AST 转成 SVG 字符串
        // 这里组合这两个 API，在 BlockTool 内生成 SVG 并塞进预览区域。
        let svg: string | null = null;

        const anyWaveDrom = WaveDrom as any;
        if (
          anyWaveDrom &&
          typeof anyWaveDrom.renderAny === 'function' &&
          anyWaveDrom.onml &&
          typeof anyWaveDrom.onml.stringify === 'function'
        ) {
          const tree = anyWaveDrom.renderAny(0, waveObject, anyWaveDrom.waveSkin, false);
          svg = anyWaveDrom.onml.stringify(tree);
        }

        if (typeof svg === 'string' && svg.trim().length > 0) {
          preview.innerHTML = svg;
        } else {
          errorEl.textContent = this.api.i18n.t('WaveDrom.renderAny 未返回有效的 SVG，请检查 WaveJSON。');
        }
      } catch (e: unknown) {
        const msg =
          e && typeof (e as Error).message === 'string'
            ? (e as Error).message
            : String(e);
        errorEl.textContent = this.api.i18n.t(`渲染失败：${msg}`);
      }
    };

    // 仅在可编辑模式下渲染上方的 WaveJSON 编辑区域；
    // 只读模式下只展示下方图形预览。
    let editorRoot: HTMLDivElement | null = null;
    if (!this.readOnly) {
      const editor = make('div', [this.css.editor]);
      editorRoot = document.createElement('div');
      editorRoot.className = this.css.textarea;

      editor.appendChild(editorRoot);
      container.appendChild(editor);
    }

    // 预览区域放在编辑区域下方
    container.appendChild(previewWrapper);

    // 初始渲染一次
    try {
      applyPreview();
    } catch (_) {
      // 忽略首次渲染异常，错误信息会写入 errorEl
    }

    if (!this.readOnly && editorRoot) {
      // 使用 CodeFlask 作为轻量代码编辑器，高亮 WaveJSON（按 JavaScript 语法高亮即可）
      const flask = new CodeFlask(editorRoot, {
        language: 'js',
        lineNumbers: false,
        readonly: this.readOnly,
        defaultTheme: true,
      });

      this.editorInstance = flask;

      flask.onUpdate((code: string) => {
        this.data.code = code;
        applyPreview();
      });

      // 用当前数据初始化编辑器内容
      flask.updateCode(this.data.code || '');
    }

    // 根据配置调整预览高度（最小 160px）
    const height = Number.isFinite(this.config.previewHeight as number)
      ? Math.max(160, Number(this.config.previewHeight))
      : 260;
    (previewWrapper as HTMLDivElement).style.maxHeight = `${height}px`;

    return container;
  }

  public save(_wrapper: HTMLDivElement): WavedromData {
    return {
      code: this.data.code ?? '',
    };
  }

  public static get sanitize(): SanitizerConfig {
    // 让 Editor.js 对 data.code 保持原样透传，不做 HTML 清洗
    return {} as unknown as SanitizerConfig;
  }

  public validate(data: WavedromData): boolean {
    if (!data) {
      return false;
    }

    if (typeof data.code !== 'string') {
      return false;
    }

    // 允许空字符串（相当于“未填写波形”）
    return true;
  }
}

