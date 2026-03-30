// ai-collab.js — AI agent collaboration module

import { computeDiff, renderDiffHtml } from './diff-merge.js';

const api = window.electronAPI;

// ── State ───────────────────────────────────────────────────────────────────

const agents = new Map();       // key -> { name, connected: true }
const pendingKeys = new Map();  // key -> { created: Date }
const conversations = new Map(); // key -> [{ type, ...data }]
let wsPort = 0;
let wsHost = "localhost";

// ── Diff review state ──────────────────────────────────────────────────────
let _diffReviewResolve = null;
let _diffReviewAgentKey = null;

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
    // Dismiss diff review if this agent's proposal was being reviewed
    if (_diffReviewAgentKey === key) {
      const view = document.getElementById("diffReviewView");
      if (view) view.hidden = true;
      _cm.getWrapperElement().style.display = "";
      _diffReviewResolve = null;
      _diffReviewAgentKey = null;
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

  if (msg.type === "propose") {
    conv.push({ type: "propose", requestId: msg.requestId, filePath: msg.filePath });
    conversations.set(key, conv);
    notifyConversationUpdate(key);
    showDiffReview(key, msg);
    return;
  } else if (msg.type === "message") {
    conv.push({ type: "message", text: msg.text, requestId: msg.requestId });
    conversations.set(key, conv);
    notifyConversationUpdate(key);
  } else if (msg.type === "question") {
    conv.push({ type: "question", ...msg });
    conversations.set(key, conv);
    notifyConversationUpdate(key);
  } else if (msg.type === "status") {
    // Remove previous status for this request
    const idx = conv.findLastIndex(e => e.type === "status" && e.requestId === msg.requestId);
    if (idx >= 0) conv.splice(idx, 1);
    conv.push({ type: "status", text: msg.text, requestId: msg.requestId });
    conversations.set(key, conv);
    notifyConversationUpdate(key);
  }
}

// ── Diff review view ──────────────────────────────────────────────────────

function showDiffReview(agentKey, msg) {
  if (!_cm) return;
  _diffReviewAgentKey = agentKey;

  const agent = agents.get(agentKey);
  const agentName = agent ? agent.name : "Agent";
  const filePath = msg.filePath;
  const fileName = filePath ? filePath.split("/").pop() : "file";
  const oldContent = _cm.getValue();
  const newContent = msg.newContent;

  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const diff = computeDiff(oldLines, newLines);

  // Populate diff review view
  const view = document.getElementById("diffReviewView");
  const titleEl = document.getElementById("diffReviewTitle");
  const fileEl = document.getElementById("diffReviewFile");
  const body = document.getElementById("diffReviewBody");
  const footer = document.getElementById("diffReviewFooter");

  titleEl.textContent = `Changes proposed by ${agentName}`;
  fileEl.textContent = fileName;
  body.innerHTML = renderDiffHtml(diff);

  // Reset footer to accept/reject buttons
  footer.innerHTML = `
    <button class="diff-review-btn reject" id="diffReviewReject">Reject</button>
    <button class="diff-review-btn accept" id="diffReviewAccept">Accept</button>
  `;

  // Show diff view, hide CodeMirror
  view.hidden = false;
  _cm.getWrapperElement().style.display = "none";

  // Scroll to first change
  const firstChange = body.querySelector(".diff-add, .diff-del");
  if (firstChange) setTimeout(() => firstChange.scrollIntoView({ block: "center" }), 50);

  function finish(result) {
    _diffReviewResolve = null;
    _diffReviewAgentKey = null;

    // Restore editor
    view.hidden = true;
    _cm.getWrapperElement().style.display = "";

    if (result.action === "accept") {
      // Write to disk, update editor
      api.writeFile(result.filePath, result.newContent).then(() => {
        const cursor = _cm.getCursor();
        const scrollInfo = _cm.getScrollInfo();
        _cm.setValue(result.newContent);
        const maxLine = _cm.lineCount() - 1;
        _cm.setCursor({ line: Math.min(cursor.line, maxLine), ch: cursor.ch });
        _cm.scrollTo(scrollInfo.left, scrollInfo.top);
      });
      api.sendToAgent(agentKey, { type: "proposal_accepted", requestId: msg.requestId });
      const c = conversations.get(agentKey) || [];
      c.push({ type: "proposal_result", accepted: true, requestId: msg.requestId });
      conversations.set(agentKey, c);
    } else {
      api.sendToAgent(agentKey, {
        type: "proposal_rejected",
        requestId: msg.requestId,
        reason: result.reason,
      });
      const c = conversations.get(agentKey) || [];
      c.push({ type: "proposal_result", accepted: false, reason: result.reason, requestId: msg.requestId });
      conversations.set(agentKey, c);
    }

    notifyConversationUpdate(agentKey);
  }

  _diffReviewResolve = finish;

  document.getElementById("diffReviewAccept").onclick = () => {
    finish({ action: "accept", newContent, filePath });
  };

  document.getElementById("diffReviewReject").onclick = () => {
    showRejectFeedback(footer);
  };

  function showRejectFeedback(footerEl) {
    footerEl.innerHTML = `
      <div class="diff-review-feedback">
        <input type="text" id="diffRejectReason" placeholder="Why are you rejecting this change?" autofocus />
        <button id="diffRejectSend">Send</button>
      </div>
    `;
    const input = document.getElementById("diffRejectReason");
    const sendBtn = document.getElementById("diffRejectSend");

    sendBtn.onclick = () => {
      const reason = input.value.trim();
      if (!reason) { input.focus(); return; }
      finish({ action: "reject", reason });
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { sendBtn.click(); }
    });
    input.focus();
  }
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
  // Escape while reviewing a proposal → trigger reject feedback
  const diffView = document.getElementById("diffReviewView");
  if (diffView && !diffView.hidden) {
    const footer = document.getElementById("diffReviewFooter");
    // Only trigger reject if not already showing feedback
    if (!footer.querySelector(".diff-review-feedback")) {
      const rejectBtn = document.getElementById("diffReviewReject");
      if (rejectBtn) rejectBtn.click();
    }
    return;
  }
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

// ── Utility ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
