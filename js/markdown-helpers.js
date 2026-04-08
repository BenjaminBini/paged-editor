// markdown-helpers.js — Pure HTML/text helpers for the markdown rendering pipeline.

export const COLOR_PAIRS = [
  ["#2a5fa0", "#4a8fd4"],
  ["#3d2f78", "#6a5aaf"],
  ["#9e1f63", "#d44a9a"],
  ["#cc7a1a", "#f0a840"],
  ["#007a92", "#20b8d0"],
];

export function stripLeadingNumber(html) {
  return html.replace(/^\d+(?:\.\d+)*\.?\s+/, "");
}

export function slugify(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}

export function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

export function buildUnderline(pair) {
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
