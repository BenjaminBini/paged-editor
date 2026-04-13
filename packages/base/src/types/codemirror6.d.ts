// Type declarations for the pre-bundled CodeMirror 6 bundle (assets/codemirror6.bundle.js).
// These are minimal declarations covering only the exports used by this project.

declare module "../../assets/codemirror6.bundle.js" {
  // --- @codemirror/state ---
  export class EditorState {
    doc: Text;
    selection: EditorSelection;
    static create(config?: EditorStateConfig): EditorState;
    static allowMultipleSelections: Facet<boolean, boolean>;
    static readOnly: Facet<boolean, boolean>;
    sliceDoc(from?: number, to?: number): string;
    replaceSelection(text: string): TransactionSpec;
  }

  export class EditorSelection {
    main: SelectionRange;
    static single(anchor: number, head?: number): EditorSelection;
  }

  export interface SelectionRange {
    anchor: number;
    head: number;
    from: number;
    to: number;
  }

  export interface Text {
    length: number;
    lines: number;
    toString(): string;
    line(n: number): Line;
    lineAt(pos: number): Line;
  }

  export interface Line {
    from: number;
    to: number;
    number: number;
    text: string;
    length: number;
  }

  export interface TransactionSpec {
    changes?: ChangeSpec;
    selection?: EditorSelection | { anchor: number; head?: number };
    effects?: StateEffect<unknown> | StateEffect<unknown>[];
    scrollIntoView?: boolean;
  }

  export type ChangeSpec =
    | { from: number; to?: number; insert?: string }
    | ChangeSpec[];

  export interface StateEffect<T> {
    value: T;
  }

  export interface Facet<Input, Output> {
    of(value: Input): Extension;
  }

  export class Compartment {
    of(ext: Extension): Extension;
    reconfigure(ext: Extension): StateEffect<unknown>;
  }

  export type Extension = unknown;

  export interface EditorStateConfig {
    doc?: string;
    selection?: EditorSelection;
    extensions?: Extension | Extension[];
  }

  // --- @codemirror/view ---
  export class EditorView {
    state: EditorState;
    dom: HTMLElement & { CodeMirror?: unknown };
    scrollDOM: HTMLElement;
    contentDOM: HTMLElement;
    constructor(config?: { state?: EditorState; parent?: HTMLElement });
    dispatch(tr: TransactionSpec): void;
    setState(state: EditorState): void;
    focus(): void;
    coordsAtPos(pos: number): { left: number; right: number; top: number; bottom: number } | null;
    lineBlockAt(pos: number): { top: number; bottom: number; from: number; to: number };
    lineBlockAtHeight(height: number): { from: number; to: number; top: number; bottom: number };
    scrollTo(x: number | null, y: number | null): void;

    static lineWrapping: Extension;
    static editable: Facet<boolean, boolean>;
    static contentAttributes: Facet<Record<string, string>, Record<string, string>>;
    static updateListener: Facet<(update: ViewUpdate) => void, readonly ((update: ViewUpdate) => void)[]>;
    static domEventHandlers(handlers: Record<string, (view: EditorView, event: Event) => boolean | void>): Extension;
  }

  export interface ViewUpdate {
    docChanged: boolean;
    selectionSet: boolean;
    state: EditorState;
    view: EditorView;
  }

  // --- @codemirror/commands ---
  export function undo(view: EditorView): boolean;
  export function redo(view: EditorView): boolean;
  export const defaultKeymap: readonly KeyBinding[];
  export const historyKeymap: readonly KeyBinding[];
  export const searchKeymap: readonly KeyBinding[];

  export interface KeyBinding {
    key?: string;
    run?: (view: EditorView) => boolean;
  }

  // --- @codemirror/language ---
  export class LanguageDescription {
    static of(spec: {
      name: string;
      alias?: string[];
      support: Extension;
    }): LanguageDescription;
  }

  export class HighlightStyle {
    static define(specs: readonly { tag: Tag | Tag[]; [prop: string]: unknown }[]): Extension;
  }

  export function syntaxHighlighting(style: Extension): Extension;

  // --- @lezer/highlight ---
  export interface Tag {}

  export const tags: {
    heading: Tag;
    heading1: Tag;
    heading2: Tag;
    heading3: Tag;
    strong: Tag;
    emphasis: Tag;
    link: Tag;
    url: Tag;
    quote: Tag;
    monospace: Tag;
    keyword: Tag;
    controlKeyword: Tag;
    definitionKeyword: Tag;
    moduleKeyword: Tag;
    operatorKeyword: Tag;
    modifier: Tag;
    atom: Tag;
    bool: Tag;
    number: Tag;
    integer: Tag;
    float: Tag;
    string: Tag;
    comment: Tag;
    lineComment: Tag;
    blockComment: Tag;
    docComment: Tag;
    contentSeparator: Tag;
    tagName: Tag;
    attributeName: Tag;
    attributeValue: Tag;
    propertyName: Tag;
    special(tag: Tag): Tag;
    definition(tag: Tag): Tag;
  };

  // --- @codemirror/lang-* ---
  export function markdown(config?: { codeLanguages?: LanguageDescription[] }): Extension;
  export function javascript(config?: { typescript?: boolean; jsx?: boolean }): Extension;
  export function html(): Extension;
  export function css(): Extension;

  // --- @codemirror/view extensions ---
  export function lineNumbers(): Extension;
  export function highlightSpecialChars(): Extension;
  export function drawSelection(): Extension;
  export function dropCursor(): Extension;
  export function rectangularSelection(): Extension;
  export function crosshairCursor(): Extension;
  export function highlightActiveLine(): Extension;
  export function highlightActiveLineGutter(): Extension;
  export function history(): Extension;
  export function keymap(bindings: { of(bindings: readonly KeyBinding[]): Extension }): Extension;

  // keymap is exported as an object with .of()
  export const keymap: {
    of(bindings: readonly KeyBinding[]): Extension;
  };
}
