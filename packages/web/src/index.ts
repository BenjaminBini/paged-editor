/**
 * Vanilla JS embed for paged-editor.
 *
 * Creates an iframe pointing at the editor frontend and communicates with it
 * via postMessage.  No framework required.
 *
 * @example
 * ```ts
 * import { PagedEditor } from "@benjaminbini/paged-editor-web";
 *
 * const editor = new PagedEditor(document.getElementById("editor")!, {
 *   src: "/memoire-editor/index.html#apiBase=/api/projects/my-project/memoire",
 * });
 * editor.on("save", ({ name }) => console.log("saved:", name));
 * // later: editor.destroy();
 * ```
 */

type EditorEvent = "ready" | "save" | "change";

export interface EditorPayload {
  file?: string;
  name?: string;
}

export interface PagedEditorOptions {
  /** Full src URL (or path + hash) for the editor iframe. */
  src: string;
}

export class PagedEditor {
  private readonly iframe: HTMLIFrameElement;
  private readonly container: HTMLElement;
  private readonly handlers = new Map<EditorEvent, Array<(p: EditorPayload) => void>>();
  private readonly listener: (e: MessageEvent) => void;

  constructor(container: HTMLElement, options: PagedEditorOptions) {
    this.container = container;

    this.iframe = document.createElement("iframe");
    this.iframe.src = options.src;
    this.iframe.style.cssText = "width:100%;height:100%;border:none;display:block;";
    this.iframe.allow = "clipboard-write";
    this.iframe.title = "Paged Editor";
    container.appendChild(this.iframe);

    this.listener = (e: MessageEvent) => {
      if (!e.data || e.data.source !== "paged-editor") return;
      const type = e.data.type as EditorEvent;
      const payload: EditorPayload = e.data.payload ?? {};
      (this.handlers.get(type) ?? []).forEach((h) => h(payload));
    };
    window.addEventListener("message", this.listener);

    // Prevent Cmd/Ctrl+S from triggering browser save — the editor handles it
    this._preventBrowserSave = this._preventBrowserSave.bind(this);
    container.addEventListener("keydown", this._preventBrowserSave, true);
  }

  on(event: EditorEvent, handler: (payload: EditorPayload) => void): this {
    const list = this.handlers.get(event) ?? [];
    this.handlers.set(event, [...list, handler]);
    return this;
  }

  off(event: EditorEvent, handler: (payload: EditorPayload) => void): this {
    const list = this.handlers.get(event) ?? [];
    this.handlers.set(event, list.filter((h) => h !== handler));
    return this;
  }

  destroy(): void {
    window.removeEventListener("message", this.listener);
    this.container.removeEventListener("keydown", this._preventBrowserSave, true);
    this.iframe.remove();
  }

  private _preventBrowserSave(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") e.preventDefault();
  }
}
