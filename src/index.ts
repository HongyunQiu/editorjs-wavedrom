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

  /**
   * 保存时自动将预览区高度撑到完整波形高度，避免预览区内部出现滚动条。
   *
   * - true: 保存时根据内容 scrollHeight 回写 data.previewHeight
   * - false: 维持用户手动设置/拖拽得到的 previewHeight
   *
   * 注意：宿主（如 QNotes）可能在编辑过程中做自动保存并频繁调用 save()，
   * 若开启该选项，会导致编辑时 block 高度“不断被撑大”。因此默认建议关闭，
   * 而在只读模式使用 fitPreviewOnReadOnly 来实现“查看态无滚动条”的效果。
   */
  fitPreviewOnSave?: boolean;

  /**
   * 只读模式渲染时自动将预览区高度撑到完整波形高度。
   *
   * - true: 只读模式根据内容撑开（默认）
   * - false: 只读模式仍使用 data.previewHeight/config.previewHeight
   */
  fitPreviewOnReadOnly?: boolean;
}

/**
 * WaveDrom 工具的数据结构
 */
export interface WavedromData {
  /**
   * WaveJSON 源码字符串
   */
  code: string;

  /**
   * 编辑区高度（像素）
   */
  editorHeight?: number;

  /**
   * 预览区高度（像素）
   */
  previewHeight?: number;
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
  splitter: string;
  textarea: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

  private previewWrapperEl: HTMLDivElement | null = null;
  private previewEl: HTMLDivElement | null = null;
  private errorEl: HTMLDivElement | null = null;

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
      editorHeight: data && Number.isFinite((data as WavedromData).editorHeight) ? Number((data as WavedromData).editorHeight) : undefined,
      previewHeight: data && Number.isFinite((data as WavedromData).previewHeight) ? Number((data as WavedromData).previewHeight) : undefined,
    };

    this.css = {
      baseClass: this.api.styles.block,
      wrapper: 'cdx-wavedrom',
      previewWrapper: 'cdx-wavedrom__preview-wrapper',
      preview: 'cdx-wavedrom__preview',
      error: 'cdx-wavedrom__error',
      editor: 'cdx-wavedrom__editor',
      splitter: 'cdx-wavedrom__splitter',
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

    this.previewWrapperEl = previewWrapper as HTMLDivElement;
    this.previewEl = preview as HTMLDivElement;
    this.errorEl = errorEl as HTMLDivElement;
    this.previewWrapperEl.dataset.readonly = String(this.readOnly);
    // 当启用“保存时按 SVG 实际高度自适应”时，让预览区不出现内部滚动条
    this.previewWrapperEl.dataset.fit = String(this.config.fitPreviewOnSave === true || (this.readOnly && this.config.fitPreviewOnReadOnly !== false));

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
    let editorEl: HTMLDivElement | null = null;
    let splitterEl: HTMLDivElement | null = null;
    if (!this.readOnly) {
      const editor = make('div', [this.css.editor]);
      editorEl = editor as HTMLDivElement;
      editorRoot = document.createElement('div');
      editorRoot.className = this.css.textarea;

      editor.appendChild(editorRoot);
      container.appendChild(editor);

      splitterEl = make('div', [this.css.splitter]) as HTMLDivElement;
      splitterEl.setAttribute('role', 'separator');
      splitterEl.setAttribute('aria-orientation', 'horizontal');
      splitterEl.setAttribute('tabindex', '0');
      container.appendChild(splitterEl);
    }

    // 预览区域放在编辑区域下方
    container.appendChild(previewWrapper);

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

    // 初始化两栏高度（用于拖拽调整）
    const minEditorHeight = 140;
    const minPreviewHeight = 160;
    const initialPreviewHeight = Number.isFinite(this.data.previewHeight as number)
      ? Math.max(minPreviewHeight, Number(this.data.previewHeight))
      : (Number.isFinite(this.config.previewHeight as number) ? Math.max(minPreviewHeight, Number(this.config.previewHeight)) : 260);
    const initialEditorHeight = Number.isFinite(this.data.editorHeight as number)
      ? Math.max(minEditorHeight, Number(this.data.editorHeight))
      : 220;

    if (!this.readOnly && editorEl) {
      editorEl.style.height = `${initialEditorHeight}px`;
      this.data.editorHeight = Math.round(initialEditorHeight);
    }

    (previewWrapper as HTMLDivElement).style.height = `${initialPreviewHeight}px`;
    (previewWrapper as HTMLDivElement).style.maxHeight = `${initialPreviewHeight}px`;
    this.data.previewHeight = Math.round(initialPreviewHeight);

    // 绑定拖拽分隔条：保持总高度不变，拖动时在两栏之间“挪动”高度
    if (!this.readOnly && editorEl && splitterEl) {
      let dragging = false;
      let startY = 0;
      let startEditorH = 0;
      let startPreviewH = 0;
      let totalH = 0;

      const setHeights = (editorH: number) => {
        const clampedEditorH = clamp(editorH, minEditorHeight, Math.max(minEditorHeight, totalH - minPreviewHeight));
        const previewH = clamp(totalH - clampedEditorH, minPreviewHeight, Math.max(minPreviewHeight, totalH - minEditorHeight));

        editorEl!.style.height = `${clampedEditorH}px`;
        (previewWrapper as HTMLDivElement).style.height = `${previewH}px`;
        (previewWrapper as HTMLDivElement).style.maxHeight = `${previewH}px`;

        this.data.editorHeight = Math.round(clampedEditorH);
        this.data.previewHeight = Math.round(previewH);
      };

      const onPointerDown = (ev: PointerEvent) => {
        // 仅处理鼠标左键 / 触控 / 笔
        if (ev.pointerType === 'mouse' && ev.button !== 0) {
          return;
        }
        ev.preventDefault();

        dragging = true;
        splitterEl!.classList.add('is-dragging');
        container.classList.add('cdx-wavedrom--dragging');

        startY = ev.clientY;
        startEditorH = editorEl!.getBoundingClientRect().height;
        startPreviewH = (previewWrapper as HTMLDivElement).getBoundingClientRect().height;
        totalH = startEditorH + startPreviewH;

        try {
          splitterEl!.setPointerCapture(ev.pointerId);
        } catch (_) {
          // ignore
        }
      };

      const onPointerMove = (ev: PointerEvent) => {
        if (!dragging) {
          return;
        }
        ev.preventDefault();

        const dy = ev.clientY - startY;
        setHeights(startEditorH + dy);
      };

      const endDrag = (ev?: PointerEvent) => {
        if (!dragging) {
          return;
        }
        dragging = false;
        splitterEl!.classList.remove('is-dragging');
        container.classList.remove('cdx-wavedrom--dragging');
        if (ev) {
          try {
            splitterEl!.releasePointerCapture(ev.pointerId);
          } catch (_) {
            // ignore
          }
        }
      };

      splitterEl.addEventListener('pointerdown', onPointerDown);
      splitterEl.addEventListener('pointermove', onPointerMove);
      splitterEl.addEventListener('pointerup', endDrag);
      splitterEl.addEventListener('pointercancel', endDrag);
      splitterEl.addEventListener('lostpointercapture', () => endDrag());
    }

    // 初始渲染一次（放在高度初始化之后，避免只读态的自适应被初始化高度覆盖）
    try {
      applyPreview();
    } catch (_) {
      // 忽略首次渲染异常，错误信息会写入 errorEl
    }

    // 只读模式下：让预览区按内容“撑开/收缩”，尽量避免内部滚动条
    if (this.readOnly && this.config.fitPreviewOnReadOnly !== false) {
      this.fitPreviewToContent({ minHeight: 40, mode: 'async' });
    }

    return container;
  }

  /**
   * 将预览区高度调整为当前内容高度（scrollHeight），用于避免预览区内部滚动条。
   *
   * 注意：
   * - 该方法仅调整预览区（不会自动改编辑区高度）
   * - 内部通过 rAF 延后读取布局，提升对 SVG/字体渲染的兼容性
   */
  private fitPreviewToContent(opts?: { minHeight?: number; mode?: 'sync' | 'async' }): void {
    if (!this.previewWrapperEl) {
      return;
    }

    const wrapper = this.previewWrapperEl;
    const minHeight = Number.isFinite(opts?.minHeight as number) ? Math.max(0, Number(opts!.minHeight)) : 40;
    const mode = opts?.mode ?? 'async';

    const measureAndApply = () => {
      // 关键：先把高度恢复为 auto/none，避免 scrollHeight 被“当前 clientHeight”放大导致越撑越大
      const prevHeight = wrapper.style.height;
      const prevMaxHeight = wrapper.style.maxHeight;

      wrapper.style.height = 'auto';
      wrapper.style.maxHeight = 'none';

      // 读取真实内容高度（此时 scrollHeight 基本等于内容高度）
      const measured = wrapper.scrollHeight;
      const target = Math.max(minHeight, measured);

      wrapper.style.height = `${target}px`;
      wrapper.style.maxHeight = `${target}px`;
      this.data.previewHeight = Math.round(target);

      // 如测量过程中 wrapper 没内容，保持最小高度即可；无需恢复到旧高度（旧高度本身可能就是不正确的）
      void prevHeight;
      void prevMaxHeight;
    };

    if (mode === 'sync') {
      measureAndApply();
      return;
    }

    requestAnimationFrame(() => measureAndApply());
  }

  public save(_wrapper: HTMLDivElement): WavedromData {
    // 保存时：默认不在编辑态“自动撑高”以避免宿主自动保存导致高度不断增长；
    // 如确需在 save() 时撑开，可显式设置 config.fitPreviewOnSave = true。
    if (this.config.fitPreviewOnSave === true) {
      this.fitPreviewToContent({ minHeight: 40, mode: 'sync' });
    }

    return {
      code: this.data.code ?? '',
      editorHeight: Number.isFinite(this.data.editorHeight as number) ? Number(this.data.editorHeight) : undefined,
      previewHeight: Number.isFinite(this.data.previewHeight as number) ? Number(this.data.previewHeight) : undefined,
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

    if (typeof data.editorHeight !== 'undefined' && !Number.isFinite(data.editorHeight)) {
      return false;
    }

    if (typeof data.previewHeight !== 'undefined' && !Number.isFinite(data.previewHeight)) {
      return false;
    }

    // 允许空字符串（相当于“未填写波形”）
    return true;
  }
}

