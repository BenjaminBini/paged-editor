import { escapeHtml } from "./utils.js";

const splitLines = t => t === "" ? [] : t.split("\n");

// ── Diff algorithm (Myers-like, minimal) ──────────────────────────
export function computeDiff(oldLines, newLines) {
  // Simple LCS-based diff producing context, add, and del entries
  const n = oldLines.length, m = newLines.length;
  // Guard: for very large files the O(n*m) LCS table is too expensive.
  // Fall back to treating the entire content as a single conflict block.
  if (n > 5000 || m > 5000) {
    const diff = [];
    for (let i = 0; i < n; i++) diff.push({ type: "del", text: oldLines[i], oldLine: i + 1 });
    for (let j = 0; j < m; j++) diff.push({ type: "add", text: newLines[j], newLine: j + 1 });
    return diff;
  }
  // Build LCS table. Use Int32Array (not Uint16Array) to avoid overflow when
  // the LCS length exceeds 65535.
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] = oldLines[i-1] === newLines[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
  // Backtrack to produce diff
  const diff = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i-1] === newLines[j-1]) {
      diff.unshift({ type: "ctx", text: oldLines[i-1], oldLine: i, newLine: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      diff.unshift({ type: "add", text: newLines[j-1], newLine: j });
      j--;
    } else {
      diff.unshift({ type: "del", text: oldLines[i-1], oldLine: i });
      i--;
    }
  }
  return diff;
}

// ── Word-level diff for inline highlighting ─────────────────────

// Tokenize a line into words and whitespace chunks for fine-grained comparison
function tokenize(line) {
  return line.match(/\S+|\s+/g) || [];
}

// LCS-based word diff returning HTML with <span class="diff-word"> around changed tokens
function renderWordDiff(oldLine, newLine, cls) {
  const oldToks = tokenize(oldLine);
  const newToks = tokenize(newLine);
  const n = oldToks.length, m = newToks.length;
  // Build LCS table
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] = oldToks[i-1] === newToks[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
  // Backtrack to produce token-level diff
  const ops = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldToks[i-1] === newToks[j-1]) {
      ops.unshift({ type: "eq", old: oldToks[i-1], new: newToks[j-1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      ops.unshift({ type: "add", new: newToks[j-1] });
      j--;
    } else {
      ops.unshift({ type: "del", old: oldToks[i-1] });
      i--;
    }
  }
  // Render: unchanged tokens as plain text, changed tokens wrapped in <span>
  if (cls === "diff-del") {
    return ops.filter(o => o.type !== "add").map(o =>
      o.type === "del" ? '<span class="diff-word">' + escapeHtml(o.old) + '</span>' : escapeHtml(o.old)
    ).join("");
  } else {
    return ops.filter(o => o.type !== "del").map(o =>
      o.type === "add" ? '<span class="diff-word">' + escapeHtml(o.new) + '</span>' : escapeHtml(o.new)
    ).join("");
  }
}

export function renderDiffHtml(diff) {
  // Show diff with 3 lines of context around changes
  const CTX = 3;
  const changeIdx = new Set();
  diff.forEach((d, i) => { if (d.type !== "ctx") changeIdx.add(i); });
  // Expand context around changes
  const visible = new Set();
  changeIdx.forEach(i => {
    for (let k = Math.max(0, i - CTX); k <= Math.min(diff.length - 1, i + CTX); k++) visible.add(k);
  });
  // Pre-compute del/add pairs for word-level highlighting.
  // A pair is a del immediately followed by an add (modified line).
  const wordDiffPairs = new Set();
  for (let i = 0; i < diff.length - 1; i++) {
    if (diff[i].type === "del" && diff[i+1].type === "add") {
      wordDiffPairs.add(i);
      wordDiffPairs.add(i + 1);
    }
  }
  let html = "";
  let lastShown = -1;
  diff.forEach((d, i) => {
    if (!visible.has(i)) return;
    if (lastShown >= 0 && i - lastShown > 1) {
      html += '<div class="diff-line diff-hdr">···</div>';
    }
    lastShown = i;
    const prefix = d.type === "add" ? "+" : d.type === "del" ? "-" : " ";
    const cls = d.type === "add" ? "diff-add" : d.type === "del" ? "diff-del" : "diff-ctx";
    let content;
    if (wordDiffPairs.has(i)) {
      // Render with word-level highlights
      const pairIdx = d.type === "del" ? i + 1 : i - 1;
      const oldText = d.type === "del" ? d.text : diff[pairIdx].text;
      const newText = d.type === "add" ? d.text : diff[pairIdx].text;
      content = renderWordDiff(oldText, newText, cls);
    } else {
      content = escapeHtml(d.text);
    }
    html += '<div class="diff-line ' + cls + '">' + prefix + " " + content + "</div>";
  });
  if (!html) html = '<div class="diff-line diff-ctx">(No differences)</div>';
  return html;
}

// ── Three-way merge ──────────────────────────────────────────────
// base = savedContent (common ancestor), local = editor, remote = disk/Drive
export function threeWayMerge(baseText, localText, remoteText) {
  // "".split("\n") yields [""] not [] — guard against that.
  const baseLines = splitLines(baseText);
  const localLines = splitLines(localText);
  const remoteLines = splitLines(remoteText);

  // Compute diffs: base→local and base→remote
  const localEdits = diffToEditMap(baseLines, localLines);
  const remoteEdits = diffToEditMap(baseLines, remoteLines);

  const result = [];
  let hasConflicts = false;
  // bi iterates 0..baseLines.length (inclusive) so that end-of-file
  // pure insertions (keyed at baseLines.length) are processed.
  let bi = 0;

  while (bi <= baseLines.length) {
    const lEdit = localEdits.get(bi);
    const rEdit = remoteEdits.get(bi);

    // ── Step 1: pure insertions (oldCount === 0) at position bi ──
    // These are new lines injected before base[bi] by one or both sides.
    const lIns = (lEdit && lEdit.oldCount === 0) ? lEdit : null;
    const rIns = (rEdit && rEdit.oldCount === 0) ? rEdit : null;
    if (lIns || rIns) {
      if (lIns && rIns) {
        if (JSON.stringify(lIns.newLines) === JSON.stringify(rIns.newLines)) {
          for (const line of lIns.newLines) result.push(line);
        } else {
          hasConflicts = true;
          result.push("<<<<<<< LOCAL");
          for (const line of lIns.newLines) result.push(line);
          result.push("=======");
          for (const line of rIns.newLines) result.push(line);
          result.push(">>>>>>> REMOTE");
        }
      } else if (lIns) {
        for (const line of lIns.newLines) result.push(line);
      } else {
        for (const line of rIns.newLines) result.push(line);
      }
    }

    // ── Step 2: stop once we're past the last base line ──
    if (bi === baseLines.length) break;

    // ── Step 3: handle the base line at bi (replacement/deletion or unchanged) ──
    const lRepl = (lEdit && lEdit.oldCount > 0) ? lEdit : null;
    const rRepl = (rEdit && rEdit.oldCount > 0) ? rEdit : null;

    if (!lRepl && !rRepl) {
      // Both sides left this line unchanged — emit it.
      result.push(baseLines[bi]);
      bi++;
    } else if (lRepl && !rRepl) {
      // Only local changed — accept local edit.
      for (const line of lRepl.newLines) result.push(line);
      bi += lRepl.oldCount;
    } else if (!lRepl && rRepl) {
      // Only remote changed — accept remote edit.
      for (const line of rRepl.newLines) result.push(line);
      bi += rRepl.oldCount;
    } else {
      // Both sides changed the same base region — conflict.
      // Advance bi by max(oldCounts) to consume every base line that
      // either side touched, preventing them being re-emitted later.
      if (JSON.stringify(lRepl.newLines) === JSON.stringify(rRepl.newLines)) {
        for (const line of lRepl.newLines) result.push(line);
      } else {
        hasConflicts = true;
        result.push("<<<<<<< LOCAL");
        for (const line of lRepl.newLines) result.push(line);
        result.push("=======");
        for (const line of rRepl.newLines) result.push(line);
        result.push(">>>>>>> REMOTE");
      }
      bi += Math.max(lRepl.oldCount, rRepl.oldCount);
    }
  }

  return { text: result.join("\n"), hasConflicts };
}

// Build a map: baseLineIndex → { oldCount, newLines[] } for each changed hunk.
//
// Keys are 0-based base-line indices.  Two kinds of entry are produced:
//   oldCount > 0  — the hunk replaces/deletes oldCount base lines starting at key
//   oldCount === 0 — pure insertion; new lines are injected before base[key]
//                    (key === baseLines.length means append at end of file)
//
// A mixed hunk (dels interleaved with adds) is always anchored by its first
// del, so the key reliably points to the first base line consumed.
function diffToEditMap(baseLines, modifiedLines) {
  // "".split("\n") yields [""] — guard so empty files produce zero-length arrays.
  const bLines = baseLines.length > 0 ? baseLines : splitLines("");
  const mLines = modifiedLines.length > 0 ? modifiedLines : splitLines("");
  const diff = computeDiff(bLines, mLines);
  const edits = new Map();
  let i = 0;
  while (i < diff.length) {
    if (diff[i].type === "ctx") { i++; continue; }

    // Determine where this hunk starts in the base (0-indexed).
    // If the hunk opens with a del, use that del's 1-indexed oldLine - 1.
    // If it opens with an add (pure insertion), use the preceding ctx line's
    // 1-indexed oldLine as the key — that value equals the 0-indexed index of
    // the next base line, which is exactly where the insertion belongs.
    // At the very start of the file (no preceding ctx) the key is 0.
    let startBase;
    if (diff[i].type === "del") {
      startBase = diff[i].oldLine - 1;
    } else {
      // pure add — find startBase from the preceding ctx entry (if any)
      startBase = (i > 0 && diff[i - 1].type === "ctx") ? diff[i - 1].oldLine : 0;
    }

    let oldCount = 0;
    const newLines = [];
    while (i < diff.length && diff[i].type !== "ctx") {
      if (diff[i].type === "del") oldCount++;
      if (diff[i].type === "add") newLines.push(diff[i].text);
      i++;
    }
    // Use the actual oldCount — do NOT coerce 0 to 1.
    // oldCount === 0 signals a pure insertion to threeWayMerge.
    edits.set(startBase, { oldCount, newLines });
  }
  return edits;
}

// ── Conflict resolution state ────────────────────────────────────
export let gdModifiedTime = null; // modifiedTime from Drive when file was loaded
let conflictResolve = null; // promise resolver for conflict modal

export function closeDiffModal() {
  document.getElementById("diffModal").classList.remove("open");
  if (conflictResolve) { conflictResolve("cancel"); conflictResolve = null; }
}
export function resolveConflict(action) {
  document.getElementById("diffModal").classList.remove("open");
  if (conflictResolve) { conflictResolve(action); conflictResolve = null; }
}

export function showDiffModal(localText, remoteText, fileName, hint) {
  const oldLines = localText.split("\n");
  const newLines = remoteText.split("\n");
  const diff = computeDiff(oldLines, newLines);
  document.getElementById("diffTitle").textContent = "Conflict — " + fileName;
  document.getElementById("diffHint").textContent = hint ||
    "This file was modified externally since you loaded it. Lines prefixed with − are your version, + are the disk version.";
  document.getElementById("diffContainer").innerHTML = renderDiffHtml(diff);
  document.getElementById("diffModal").classList.add("open");
  return new Promise(resolve => { conflictResolve = resolve; });
}
