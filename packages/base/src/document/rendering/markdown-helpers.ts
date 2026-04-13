// markdown-helpers.js — Pure HTML/text helpers for the markdown rendering pipeline.

export const COLOR_PAIRS: [string, string][] = [
  ["#2a5fa0", "#4a8fd4"],
  ["#3d2f78", "#6a5aaf"],
  ["#9e1f63", "#d44a9a"],
  ["#cc7a1a", "#f0a840"],
  ["#007a92", "#20b8d0"],
];

export function stripLeadingNumber(html: string): string {
  return html.replace(/^\d+(?:\.\d+)*\.?\s+/, "");
}

export function slugify(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

/**
 * Detect partie number from markdown body (H1 "Partie N") or filename prefix ("01-...").
 * Returns 0 if no partie number found.
 */
export function detectPartieNum(body: string, fileName: string): number {
  const m = body.match(/^#\s+Partie\s+(\d+)/im);
  if (m) return parseInt(m[1], 10);
  const fnMatch = fileName.match(/^(\d+)/);
  return fnMatch ? parseInt(fnMatch[1], 10) : 0;
}

/**
 * Get color pair index from partie number. Returns 0 if no partie.
 */
export function getColorIndex(partieNum: number): number {
  return partieNum > 0 ? (partieNum - 1) % COLOR_PAIRS.length : 0;
}

/**
 * Wrap parsed HTML in a <section> element with color CSS vars.
 */
export function wrapSection(html: string, colorIdx: number): string {
  const pair = COLOR_PAIRS[colorIdx % COLOR_PAIRS.length];
  return `<section class="level2" data-color-index="${colorIdx % 5}" style="--section-color:${pair[0]};--section-color-light:${pair[1]}">\n${html}\n</section>`;
}

export function buildUnderline(pair: [string, string]): string {
  return (
    '<span class="beorn-underline">' +
    '<span class="beorn-solid" style="background:linear-gradient(90deg,' +
    pair[0] +
    "," +
    pair[1] +
    ')"></span>' +
    '<span class="beorn-chunk" style="width:50px;background:' +
    pair[1] +
    ';opacity:0.88"></span>' +
    '<span class="beorn-chunk" style="width:32px;background:' +
    pair[1] +
    ';opacity:0.76"></span>' +
    '<span class="beorn-chunk" style="width:18px;background:' +
    pair[1] +
    ';opacity:0.64"></span>' +
    '<span class="beorn-chunk" style="width:8px;background:' +
    pair[1] +
    ';opacity:0.50"></span>' +
    '<span class="beorn-chunk" style="width:4px;height:4px;border-radius:50%;background:' +
    pair[1] +
    ';opacity:0.35"></span>' +
    "</span>"
  );
}
