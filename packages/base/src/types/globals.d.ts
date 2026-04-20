// Global type declarations for CDN-loaded libraries and Electron preload APIs.

// ── marked (loaded via <script> from CDN) ────────────────────────────────────

interface MarkedToken {
  type: string;
  raw: string;
  text?: string;
  tokens?: MarkedToken[];
  items?: MarkedToken[];
  header?: MarkedToken[];
  rows?: MarkedToken[][];
  depth?: number;
  lang?: string;
  ordered?: boolean;
  start?: number;
  [key: string]: unknown;
}

interface MarkedRendererThis {
  parseInline(tokens: MarkedToken[], renderer?: unknown): string;
  parse(tokens: MarkedToken[], unwrap?: boolean): string;
  textRenderer?: unknown;
  [key: string]: unknown;
}

interface MarkedExtension {
  name: string;
  level: "block" | "inline";
  start?: (this: unknown, src: string) => number | undefined;
  tokenizer: (this: unknown, src: string, tokens?: MarkedToken[]) => MarkedToken | undefined;
  renderer: (this: MarkedRendererThis, token: MarkedToken) => string | false;
  childTokens?: string[];
}

interface MarkedOptions {
  renderer?: Record<string, (this: MarkedRendererThis, token: MarkedToken, ...args: unknown[]) => string>;
  hooks?: Record<string, (value: string) => string>;
  walkTokens?: (token: MarkedToken) => void;
  extensions?: MarkedExtension[];
  breaks?: boolean;
  gfm?: boolean;
  headerIds?: boolean;
  mangle?: boolean;
  [key: string]: unknown;
}

declare const marked: {
  use(options: MarkedOptions): void;
  lexer(src: string, options?: MarkedOptions): MarkedToken[];
  parser(tokens: MarkedToken[], options?: MarkedOptions): string;
  parse(src: string, options?: MarkedOptions): string;
  parseInline(src: string, options?: MarkedOptions): string;
};

// ── Paged.js (loaded from assets/paged.polyfill.js) ──────────────────────────

declare namespace Paged {
  class Previewer {
    preview(
      content: string | Element,
      stylesheets?: string[],
      renderTo?: Element
    ): Promise<{ total: number; performance: string }>;
    destroy?(): void;
  }
}

// ── DOMPurify (loaded via <script> from CDN) ──────────────────────────────────

interface DOMPurifyConfig {
  ADD_URI_SAFE_ATTR?: string[];
  ALLOWED_URI_REGEXP?: RegExp;
  [key: string]: unknown;
}

declare const DOMPurify: {
  sanitize(dirty: string, config?: DOMPurifyConfig): string;
  addHook(hook: string, callback: (node: Element, data: unknown, config: DOMPurifyConfig) => void): void;
};

// ── Mermaid (lazy-loaded from CDN) ────────────────────────────────────────────

declare const mermaid:
  | {
      initialize(config: Record<string, unknown>): void;
      render(id: string, definition: string): Promise<{ svg: string }>;
    }
  | undefined;

// ── Electron preload API ─────────────────────────────────────────────────────

interface ElectronAPI {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readDir(path: string): Promise<Array<{ name: string; path: string }>>;
  stat(path: string): Promise<{ mtimeMs: number }>;
  deleteFile(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  writeBinaryFile(path: string, buffer: ArrayBuffer): Promise<void>;
  showOpenFileDialog(): Promise<string | null>;
  showOpenFolderDialog(): Promise<string | null>;
  showSaveAsDialog(name: string): Promise<string | null>;
  showSaveDialog(name: string): Promise<string | null>;
  getFileModTime(path: string): Promise<number>;
  getAppState(): Promise<Record<string, unknown>>;
  setAppState(state: Record<string, unknown>): Promise<void>;
  addRecentFile(path: string): Promise<void>;
  addRecentFolder(path: string): Promise<void>;
  getRecentFiles(): Promise<string[]>;
  getRecentFolders(): Promise<string[]>;
  showInFinder(path: string): void;
  hasStartupPath(): Promise<boolean>;
  confirmWindowClose?(): Promise<void>;
  cancelWindowClose?(): Promise<void>;
  setTitle(title: string): void;
  previewPdf?(html: string, name: string): Promise<{ tempPath: string; name: string } | null> | void;
  savePdfAs?(name: string): void;
  getWorkspaceAssetBaseHref?(path: string): string;
  getWsPort(): Promise<number>;
  getWsHost(): Promise<string>;
  generateAgentKey(): Promise<string>;
  revokeAgentKey(key: string): Promise<void>;
  sendToAgent(key: string, msg: unknown): void;
  on(event: string, callback: (...args: any[]) => void): void;
  removeListener(event: string, callback: (...args: any[]) => void): void;
}

// ── Window augmentation ──────────────────────────────────────────────────────

interface Window {
  electronAPI?: ElectronAPI;
  __pagedEditorWebMode?: boolean;
  __pagedEditorNotifyParent?: (event: string, data: Record<string, unknown>) => void;
  __PAGED_EDITOR_API_URL?: string;
  DOMPurify?: typeof DOMPurify;
  PagedConfig?: { auto: boolean };

  // Globals exposed by shell/app-orchestrator.ts for HTML onclick handlers
  openLocalFile: () => void;
  openFolder: () => Promise<void>;
  saveCurrentFile: () => void | Promise<void> | Promise<boolean>;
  saveAs: () => Promise<void> | Promise<boolean>;
  insertTable: () => void;
  triggerRender: () => void;
  openPreviewTab: () => void;
  pdfViewerClose: () => void;
  pdfViewerSaveAs: () => void;
  downloadPdf: () => void;
  downloadFullMemoire: () => Promise<void>;
  previewZoomIn: () => void;
  previewZoomOut: () => void;
  previewZoomReset: () => void;
  toggleWrap: () => void;
  toggleTableEditor: () => void;
  closeDiffModal: () => void;
  resolveConflict: (strategy: string) => void;
  closeFolder: () => void;
  refreshSidebar: () => void;
  createNewFile: () => void;
  closeFile: () => void;
  newDocument: () => void;
  newFromTemplate: () => void;
  addAgent: () => void;
  [key: string]: unknown;
}
