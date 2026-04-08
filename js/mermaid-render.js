// mermaid-render.js — Lazy-load Mermaid, queue diagrams during parse, render with SVG caching.

const mermaidCache = new Map(); // definition string → SVG string
let _mermaidCounter = 0;
let _mermaidLoading = null;

// ── Per-render queue (reset before each parse, drained after) ────────────────

let _queue = [];

export function resetMermaidQueue() {
  _queue = [];
}

export function pushToMermaidQueue(definition) {
  _queue.push(definition);
  return _queue.length - 1; // returns the index for the placeholder
}

export function getMermaidQueue() {
  return [..._queue];
}

function ensureMermaid() {
  if (typeof mermaid !== "undefined") return Promise.resolve();
  if (_mermaidLoading) return _mermaidLoading;
  _mermaidLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
    script.onload = () => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        look: "handDrawn",
        theme: "base",
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
          fontFamily: '"Hanken Grotesk", -apple-system, sans-serif',
          fontSize: "13px",
          nodeBorder: "#3373b3",
          mainBkg: "#e8f0fa",
          edgeLabelBackground: "#fff",
          clusterBkg: "#f8f9fc",
          clusterBorder: "#e2e8f0",
          titleColor: "#193658",
        },
      });
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return _mermaidLoading;
}

export async function resolveMermaid(html, queue) {
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
      const { svg } = await mermaid.render(id, definition);
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
