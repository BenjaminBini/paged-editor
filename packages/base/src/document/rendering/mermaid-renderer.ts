// mermaid-render.js — Lazy-load Mermaid, queue diagrams during parse, render with SVG caching.

const mermaidCache: Map<string, string> = new Map(); // definition string → SVG string
let _mermaidCounter: number = 0;
let _mermaidLoading: Promise<void> | null = null;

// ── Per-render queue (reset before each parse, drained after) ────────────────

let _queue: string[] = [];

export function resetMermaidQueue(): void {
  _queue = [];
}

export function pushToMermaidQueue(definition: string): number {
  _queue.push(definition);
  return _queue.length - 1; // returns the index for the placeholder
}

export function getMermaidQueue(): string[] {
  return [..._queue];
}

const MERMAID_CONFIG: Record<string, unknown> = {
  startOnLoad: false,
  securityLevel: "strict",
  look: "handDrawn",
  htmlLabels: false,
  theme: "base",
  flowchart: {
    htmlLabels: false,
    useMaxWidth: true,
  },
  themeVariables: {
    primaryColor: "#e8f0fa",
    primaryBorderColor: "#3373b3",
    primaryTextColor: "#193658",
    secondaryColor: "#eef8fa",
    secondaryBorderColor: "#0096ae",
    secondaryTextColor: "#193658",
    tertiaryColor: "#f3f0fa",
    tertiaryBorderColor: "#493a8b",
    tertiaryTextColor: "#193658",
    lineColor: "#94a3b8",
    textColor: "#2d3748",
    fontFamily: '"Hanken Grotesk", Arial, sans-serif',
    fontSize: "13px",
    nodeBorder: "#3373b3",
    mainBkg: "#e8f0fa",
    edgeLabelBackground: "#fff",
    clusterBkg: "#f8f9fc",
    clusterBorder: "#e2e8f0",
    titleColor: "#193658",
  },
};

function ensureMermaid(): Promise<void> {
  if (typeof mermaid !== "undefined") return Promise.resolve();
  if (_mermaidLoading) return _mermaidLoading;
  _mermaidLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    script.onload = async () => {
      await document.fonts?.ready?.catch?.(() => {});
      // Access via globalThis to avoid TS narrowing mermaid to `never`
      // after the `typeof mermaid !== "undefined"` early-return above.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).mermaid.initialize(MERMAID_CONFIG);
      resolve(undefined);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return _mermaidLoading;
}

// Preload Mermaid in the background so it's ready before the first diagram
ensureMermaid();

export async function resolveMermaid(html: string, queue: string[]): Promise<string> {
  if (queue.length === 0) return html;
  await ensureMermaid();

  let result = html;
  for (let i = 0; i < queue.length; i++) {
    const definition = queue[i];

    // Cache hit → inject cached SVG
    const cached = mermaidCache.get(definition);
    if (cached) {
      result = result.replace(
        `data-mermaid-idx="${i}"></div>`,
        `>${cached}</div>`,
      );
      continue;
    }

    // Cache miss → render, cache, inject
    try {
      const id = "mermaid-pre-" + _mermaidCounter++;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { svg } = await (globalThis as any).mermaid.render(id, definition);
      mermaidCache.set(definition, svg);
      result = result.replace(
        `data-mermaid-idx="${i}"></div>`,
        `>${svg}</div>`,
      );
    } catch (e) {
      console.warn("Mermaid render error:", e);
    }
  }
  return result;
}
