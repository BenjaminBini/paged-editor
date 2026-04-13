// utils.js — Shared utility functions.

export function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  m[1].split("\n").forEach((line) => {
    const kv = line.match(/^(\w+)\s*:\s*"?(.+?)"?\s*$/);
    if (kv) fm[kv[1]] = kv[2];
  });
  return { fm, body: text.slice(m[0].length) };
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
