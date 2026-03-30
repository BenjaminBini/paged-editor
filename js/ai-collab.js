// ai-collab.js — AI agent collaboration module

import { computeDiff, renderDiffHtml } from './diff-merge.js';

const api = window.electronAPI;

// ── State ───────────────────────────────────────────────────────────────────

const agents = new Map();       // key -> { name, connected: true }
const pendingKeys = new Map();  // key -> { created: Date }
const conversations = new Map(); // key -> [{ type, ...data }]
let wsPort = 0;
let wsHost = "localhost";

// ── External dependencies (set by app.js) ───────────────────────────────────

let _cm = null;
let _getFilePath = null;

// ── Conversation hooks ──────────────────────────────────────────────────────

let _onConversationUpdate = null;
export function onConversationUpdate(fn) { _onConversationUpdate = fn; }

function notifyConversationUpdate(key) {
  if (_onConversationUpdate) _onConversationUpdate(key);
}

let _onAgentsChanged = null;
export function onAgentsChanged(fn) { _onAgentsChanged = fn; }

let _onAgentClick = null;
export function onAgentClick(fn) { _onAgentClick = fn; }

export function getConversation(key) {
  return conversations.get(key) || [];
}

export function init(cm, getFilePath) {
  _cm = cm;
  _getFilePath = getFilePath;
  api.getWsPort().then(port => { wsPort = port; });
  api.getWsHost().then(host => { wsHost = host; });

  // Listen for agent events from main process
  api.on("agent-connected", ({ key, name }) => {
    agents.set(key, { name, connected: true });
    pendingKeys.delete(key);
    conversations.set(key, conversations.get(key) || []);
    renderAgentList();
    if (_onAgentsChanged) _onAgentsChanged(getConnectedAgents());
    // If the modal is open waiting for this agent, show success animation
    if (currentModalKey === key) {
      showAgentModalConnected();
    }
  });

  api.on("agent-disconnected", ({ key }) => {
    const agent = agents.get(key);
    if (agent) {
      agent.connected = false;
      renderAgentList();
    }
    if (_onAgentsChanged) _onAgentsChanged(getConnectedAgents());
    // Close the agent prompt modal if it was waiting for this agent
    if (currentModalKey === key) {
      closeAgentModal();
    }
    // Close the agent diff modal if it was reviewing an edit from this agent
    if (agentDiffKey === key) {
      const diffModal = document.getElementById("agentDiffModal");
      if (diffModal) diffModal.classList.remove("open");
      if (agentDiffResolve) { agentDiffResolve("reject"); agentDiffResolve = null; }
      agentDiffKey = null;
    }
  });

  api.on("agent-message", ({ key, message }) => {
    handleAgentMessage(key, message);
  });

  renderAgentList();
}

// ── Key generation ──────────────────────────────────────────────────────────

export async function addAgent() {
  const key = await api.generateAgentKey();
  pendingKeys.set(key, { created: new Date() });
  showAgentPromptModal(key);
  renderAgentList();
}

// ── Protocol: handle incoming agent messages ────────────────────────────────

function handleAgentMessage(key, msg) {
  const conv = conversations.get(key) || [];

  if (msg.type === "read") {
    handleReadRequest(key, msg);
  } else if (msg.type === "edit") {
    conv.push({ type: "edit", ...msg });
    conversations.set(key, conv);
    applyEdit(key, msg);
  } else if (msg.type === "message") {
    conv.push({ type: "message", text: msg.text, requestId: msg.requestId });
    conversations.set(key, conv);
    notifyConversationUpdate(key);
  } else if (msg.type === "question") {
    conv.push({ type: "question", ...msg });
    conversations.set(key, conv);
    notifyConversationUpdate(key);
  } else if (msg.type === "patch") {
    conv.push({ type: "patch", ...msg });
    conversations.set(key, conv);
    applyPatch(key, msg);
  } else if (msg.type === "status") {
    const statusConv = conversations.get(key) || [];
    // Remove previous status for this request
    const idx = statusConv.findLastIndex(e => e.type === "status" && e.requestId === msg.requestId);
    if (idx >= 0) statusConv.splice(idx, 1);
    statusConv.push({ type: "status", text: msg.text, requestId: msg.requestId });
    conversations.set(key, statusConv);
    notifyConversationUpdate(key);
  }
}

// ── Read requests ──────────────────────────────────────────────────────────

function handleReadRequest(key, msg) {
  if (!_cm) return;
  const content = _cm.getValue();
  const filePath = _getFilePath ? _getFilePath() : null;
  const fileName = filePath ? filePath.split("/").pop() : "untitled.md";

  const response = {
    type: "read_response",
    readId: msg.readId,
    file: { path: filePath, name: fileName, content },
  };

  // If line range requested, also include the slice
  if (msg.lineStart != null && msg.lineEnd != null) {
    const lines = content.split("\n");
    const start = Math.max(0, msg.lineStart);
    const end = Math.min(lines.length - 1, msg.lineEnd);
    response.lines = { lineStart: start, lineEnd: end, text: lines.slice(start, end + 1).join("\n") };
  }

  api.sendToAgent(key, response);
}

// ── Apply edits ─────────────────────────────────────────────────────────────

function applyEdit(key, msg) {
  if (!_cm) return;

  // Verify oldText matches
  const from = { line: msg.lineStart, ch: 0 };
  const to = { line: msg.lineEnd, ch: _cm.getLine(msg.lineEnd)?.length || 0 };
  const currentText = _cm.getRange(from, to);

  if (currentText !== msg.oldText) {
    api.sendToAgent(key, {
      type: "edit_error",
      requestId: msg.requestId,
      message: "oldText does not match current content at specified lines",
    });
    const errConv = conversations.get(key) || [];
    errConv.push({ type: "message", text: "Edit rejected: the text at the specified location has changed.", requestId: msg.requestId });
    conversations.set(key, errConv);
    notifyConversationUpdate(key);
    return;
  }

  // Show diff review modal instead of auto-applying
  const agent = agents.get(key);
  const agentName = agent ? agent.name : "Agent";
  showAgentDiffModal(key, agentName, currentText, msg.newText, msg.lineStart, msg.lineEnd)
    .then(action => {
      if (action === "accept") {
        // Re-verify text hasn't changed while modal was open
        const nowText = _cm.getRange(from, to);
        if (nowText !== msg.oldText) {
          api.sendToAgent(key, {
            type: "edit_error",
            requestId: msg.requestId,
            message: "Content changed while review was pending",
          });
          return;
        }

        _cm.replaceRange(msg.newText, from, to);

        // Flash highlight on changed lines
        const newLineEnd = msg.lineStart + msg.newText.split("\n").length - 1;
        for (let i = msg.lineStart; i <= newLineEnd; i++) {
          _cm.addLineClass(i, "background", "ai-edit-flash");
        }
        setTimeout(() => {
          for (let i = msg.lineStart; i <= newLineEnd; i++) {
            _cm.removeLineClass(i, "background", "ai-edit-flash");
          }
        }, 1500);

        api.sendToAgent(key, { type: "edit_ok", requestId: msg.requestId });
      } else {
        api.sendToAgent(key, {
          type: "edit_error",
          requestId: msg.requestId,
          message: "Edit rejected by user",
        });
      }
      const conv = conversations.get(key) || [];
      conv.push({ type: "edit_result", accepted: action === "accept" });
      conversations.set(key, conv);
      notifyConversationUpdate(key);
    });
}

// ── Apply patch (unified diff) ─────────────────────────────────────────────

function applyPatch(key, msg) {
  if (!_cm) return;

  const hunks = parseUnifiedDiff(msg.patch);
  if (hunks.length === 0) {
    api.sendToAgent(key, {
      type: "edit_error",
      requestId: msg.requestId,
      message: "No valid hunks found in the patch",
    });
    return;
  }

  const fileLines = _cm.getValue().split("\n");
  const ops = patchToOperations(hunks, fileLines);

  // Validate all operations before showing review
  for (const op of ops) {
    const currentText = _cm.getRange(
      { line: op.lineStart, ch: 0 },
      { line: op.lineEnd, ch: _cm.getLine(op.lineEnd)?.length || 0 }
    );
    if (currentText !== op.oldText) {
      api.sendToAgent(key, {
        type: "edit_error",
        requestId: msg.requestId,
        message: `Patch hunk mismatch at lines ${op.lineStart + 1}-${op.lineEnd + 1}: content has diverged`,
      });
      return;
    }
  }

  // For the review modal, combine all operations into a single old/new view
  const allOldText = ops.slice().reverse().map(op => op.oldText).join("\n...\n");
  const allNewText = ops.slice().reverse().map(op => op.newText).join("\n...\n");
  const firstLine = Math.min(...ops.map(op => op.lineStart));
  const lastLine = Math.max(...ops.map(op => op.lineEnd));

  const agent = agents.get(key);
  const agentName = agent ? agent.name : "Agent";

  showAgentDiffModal(key, agentName, allOldText, allNewText, firstLine, lastLine)
    .then(action => {
      if (action === "accept") {
        // Apply operations bottom-to-top (already sorted)
        for (const op of ops) {
          const from = { line: op.lineStart, ch: 0 };
          const to = { line: op.lineEnd, ch: _cm.getLine(op.lineEnd)?.length || 0 };

          // Re-verify before applying
          const nowText = _cm.getRange(from, to);
          if (nowText !== op.oldText) {
            api.sendToAgent(key, {
              type: "edit_error",
              requestId: msg.requestId,
              message: "Content changed while review was pending",
            });
            return;
          }

          _cm.replaceRange(op.newText, from, to);

          // Flash highlight on changed lines
          const newLineEnd = op.lineStart + op.newText.split("\n").length - 1;
          for (let i = op.lineStart; i <= newLineEnd; i++) {
            _cm.addLineClass(i, "background", "ai-edit-flash");
          }
          setTimeout(() => {
            for (let i = op.lineStart; i <= newLineEnd; i++) {
              _cm.removeLineClass(i, "background", "ai-edit-flash");
            }
          }, 1500);
        }

        api.sendToAgent(key, { type: "edit_ok", requestId: msg.requestId });
      } else {
        api.sendToAgent(key, {
          type: "edit_error",
          requestId: msg.requestId,
          message: "Patch rejected by user",
        });
      }
      const conv = conversations.get(key) || [];
      conv.push({ type: "edit_result", accepted: action === "accept" });
      conversations.set(key, conv);
      notifyConversationUpdate(key);
    });
}

// ── Agent diff review modal ────────────────────────────────────────────────

let agentDiffResolve = null;
let agentDiffKey = null;

function showAgentDiffModal(agentKey, agentName, oldText, newText, lineStart, lineEnd) {
  agentDiffKey = agentKey;
  const modal = document.getElementById("agentDiffModal");
  const title = document.getElementById("agentDiffTitle");
  const hint = document.getElementById("agentDiffHint");
  const container = document.getElementById("agentDiffContainer");
  const acceptBtn = document.getElementById("agentDiffAccept");
  const rejectBtn = document.getElementById("agentDiffReject");

  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const diff = computeDiff(oldLines, newLines);

  title.textContent = `Edit proposed by ${agentName}`;
  hint.textContent = `Lines ${lineStart + 1}–${lineEnd + 1} — review the changes below.`;
  container.innerHTML = renderDiffHtml(diff);
  modal.classList.add("open");

  // Scroll the diff container to the first change
  const firstChange = container.querySelector(".diff-add, .diff-del");
  if (firstChange) firstChange.scrollIntoView({ block: "center" });

  return new Promise(resolve => {
    agentDiffResolve = resolve;
    acceptBtn.onclick = () => { modal.classList.remove("open"); agentDiffKey = null; resolve("accept"); };
    rejectBtn.onclick = () => { modal.classList.remove("open"); agentDiffKey = null; resolve("reject"); };
  });
}

// ── Send request to agent ───────────────────────────────────────────────────

export function sendRequest(key, prompt, selection) {
  if (!_cm) return;

  const content = _cm.getValue();
  const filePath = _getFilePath ? _getFilePath() : null;
  const fileName = filePath ? filePath.split("/").pop() : "untitled.md";

  // Context: 5 lines before and after selection
  const ctxBefore = [];
  for (let i = Math.max(0, selection.lineStart - 5); i < selection.lineStart; i++) {
    ctxBefore.push(_cm.getLine(i));
  }
  const ctxAfter = [];
  for (let i = selection.lineEnd + 1; i <= Math.min(_cm.lineCount() - 1, selection.lineEnd + 5); i++) {
    ctxAfter.push(_cm.getLine(i));
  }

  const requestId = crypto.randomUUID();
  const message = {
    type: "request",
    id: requestId,
    prompt,
    selection: {
      text: selection.text,
      lineStart: selection.lineStart,
      lineEnd: selection.lineEnd,
      chStart: selection.chStart,
      chEnd: selection.chEnd,
    },
    context: {
      before: ctxBefore.join("\n"),
      after: ctxAfter.join("\n"),
    },
    file: {
      path: filePath,
      name: fileName,
      content,
    },
  };

  const conv = conversations.get(key) || [];
  conv.push({ type: "request", prompt, requestId, selection });
  conversations.set(key, conv);

  api.sendToAgent(key, message);
  return requestId;
}

// ── Send answer to agent question ───────────────────────────────────────────

export function sendAnswer(key, questionId, value) {
  api.sendToAgent(key, { type: "answer", questionId, value });
  const conv = conversations.get(key) || [];
  conv.push({ type: "answer", questionId, value });
  conversations.set(key, conv);
}

// ── Get connected agents ────────────────────────────────────────────────────

export function getConnectedAgents() {
  const result = [];
  for (const [key, agent] of agents) {
    if (agent.connected) result.push({ key, name: agent.name });
  }
  return result;
}

// ── Disconnect agent ────────────────────────────────────────────────────────

function disconnectAgent(key) {
  api.revokeAgentKey(key);
  agents.delete(key);
  pendingKeys.delete(key);
  renderAgentList();
}

// ── Prompt template ─────────────────────────────────────────────────────────

function buildAgentPrompt(key) {
  return `/ao-analyst:editor-connect ws://${wsHost}:${wsPort} ${key}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// UI — all DOM manipulation below
// ══════════════════════════════════════════════════════════════════════════════

// ── Sidebar: agents list ────────────────────────────────────────────────────

const agentSection = document.getElementById("agentSection");
const agentList = document.getElementById("agentList");
const btnAddAgent = document.getElementById("btnAddAgent");

if (btnAddAgent) btnAddAgent.onclick = () => addAgent();

function renderAgentList() {
  if (!agentList || !agentSection) return;

  const connected = getConnectedAgents();
  const pending = pendingKeys.size;

  agentList.innerHTML = "";

  for (const { key, name } of connected) {
    const el = document.createElement("div");
    el.className = "agent-item connected";
    el.innerHTML = `<span class="agent-dot"></span><span class="agent-name">${escapeHtml(name)}</span><button class="agent-disconnect" title="Disconnect agent">&times;</button>`;
    el.querySelector(".agent-name").onclick = () => {
      if (_onAgentClick) _onAgentClick(key);
    };
    el.querySelector(".agent-disconnect").onclick = (e) => {
      e.stopPropagation();
      disconnectAgent(key);
    };
    agentList.appendChild(el);
  }

  for (const [key] of pendingKeys) {
    const el = document.createElement("div");
    el.className = "agent-item pending";
    el.innerHTML = `<span class="agent-dot"></span><span class="agent-name">Waiting for connection...</span>`;
    el.onclick = () => showAgentPromptModal(key);
    agentList.appendChild(el);
  }
}

// ── Modal: agent prompt ─────────────────────────────────────────────────────

const agentModal = document.getElementById("agentModal");
const agentPromptText = document.getElementById("agentPromptText");
const btnCopyPrompt = document.getElementById("btnCopyPrompt");
const btnCloseAgentModal = document.getElementById("btnCloseAgentModal");
const agentModalContent = document.getElementById("agentModalContent");
const agentModalSuccess = document.getElementById("agentModalSuccess");

let currentModalKey = null;

if (btnCloseAgentModal) btnCloseAgentModal.onclick = () => closeAgentModal();

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  // Close modals & overlays in priority order
  const diffModal = document.getElementById("agentDiffModal");
  if (diffModal?.classList.contains("open")) {
    diffModal.classList.remove("open");
    if (agentDiffResolve) { agentDiffResolve("reject"); agentDiffResolve = null; }
    agentDiffKey = null;
    return;
  }
  const historyOverlay = document.querySelector(".ai-history-overlay");
  if (historyOverlay) { historyOverlay.remove(); return; }
  if (agentModal?.classList.contains("open")) { closeAgentModal(); return; }
});

function showAgentPromptModal(key) {
  if (!agentModal || !agentPromptText) return;
  currentModalKey = key;
  agentPromptText.textContent = buildAgentPrompt(key);
  // Reset to prompt view
  if (agentModalContent) agentModalContent.hidden = false;
  if (agentModalSuccess) agentModalSuccess.hidden = true;
  agentModal.classList.add("open");

  if (btnCopyPrompt) {
    btnCopyPrompt.onclick = () => {
      navigator.clipboard.writeText(agentPromptText.textContent);
      btnCopyPrompt.textContent = "Copied!";
      setTimeout(() => { btnCopyPrompt.textContent = "Copy Prompt"; }, 2000);
    };
  }
}

function showAgentModalConnected() {
  if (!agentModalContent || !agentModalSuccess) return;
  agentModalContent.hidden = true;
  // Re-trigger animations: remove class, force reflow, add class
  agentModalSuccess.classList.remove("animate");
  agentModalSuccess.hidden = false;
  void agentModalSuccess.offsetHeight; // force reflow
  agentModalSuccess.classList.add("animate");
  // Auto-close after animation plays
  setTimeout(() => closeAgentModal(), 1800);
}

function closeAgentModal() {
  if (agentModal) agentModal.classList.remove("open");
  currentModalKey = null;
  if (agentModalContent) agentModalContent.hidden = false;
  if (agentModalSuccess) {
    agentModalSuccess.hidden = true;
    agentModalSuccess.classList.remove("animate");
  }
}

// ── Unified diff parser ────────────────────────────────────────────────────

/**
 * Parse a unified diff string into an array of hunks.
 * Each hunk: { oldStart, oldCount, newStart, newCount, lines[] }
 * Each line: { type: "ctx"|"add"|"del", text }
 */
function parseUnifiedDiff(patch) {
  const hunks = [];
  const lines = patch.split("\n");
  let current = null;

  for (const line of lines) {
    // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      current = {
        oldStart: parseInt(hunkMatch[1], 10),
        oldCount: hunkMatch[2] != null ? parseInt(hunkMatch[2], 10) : 1,
        newStart: parseInt(hunkMatch[3], 10),
        newCount: hunkMatch[4] != null ? parseInt(hunkMatch[4], 10) : 1,
        lines: [],
      };
      hunks.push(current);
      continue;
    }

    if (!current) continue;

    if (line.startsWith("-")) {
      current.lines.push({ type: "del", text: line.substring(1) });
    } else if (line.startsWith("+")) {
      current.lines.push({ type: "add", text: line.substring(1) });
    } else if (line.startsWith(" ")) {
      current.lines.push({ type: "ctx", text: line.substring(1) });
    }
    // Skip "\ No newline at end of file" and other noise
  }

  return hunks;
}

/**
 * Given parsed hunks and the current file lines, compute the ranges to replace.
 * Returns an array of operations: { lineStart, lineEnd, oldText, newText }
 * Line numbers are 0-based (CodeMirror convention).
 * Hunks are applied bottom-to-top to avoid line shifts.
 */
function patchToOperations(hunks, fileLines) {
  const ops = [];

  for (const hunk of hunks) {
    // Unified diff uses 1-based line numbers; convert to 0-based
    const startLine0 = hunk.oldStart - 1;

    const oldLines = [];
    const newLines = [];

    for (const l of hunk.lines) {
      if (l.type === "ctx") {
        oldLines.push(l.text);
        newLines.push(l.text);
      } else if (l.type === "del") {
        oldLines.push(l.text);
      } else if (l.type === "add") {
        newLines.push(l.text);
      }
    }

    // Verify context lines match current content (fuzzy anchor)
    let anchorOffset = 0;
    const firstCtx = hunk.lines.find(l => l.type === "ctx");
    if (firstCtx) {
      const expectedLine = startLine0;
      // Search nearby for the context line if it shifted
      for (let delta = 0; delta <= 10; delta++) {
        for (const sign of [0, 1, -1]) {
          const probe = expectedLine + delta * (sign || 1);
          if (probe >= 0 && probe < fileLines.length && fileLines[probe] === firstCtx.text) {
            anchorOffset = probe - expectedLine;
            break;
          }
        }
        if (anchorOffset !== 0) break;
      }
    }

    const adjustedStart = startLine0 + anchorOffset;
    const adjustedEnd = adjustedStart + oldLines.length - 1;

    ops.push({
      lineStart: adjustedStart,
      lineEnd: adjustedEnd,
      oldText: oldLines.join("\n"),
      newText: newLines.join("\n"),
    });
  }

  // Sort bottom-to-top so line shifts don't affect earlier hunks
  ops.sort((a, b) => b.lineStart - a.lineStart);
  return ops;
}

// ── Utility ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
