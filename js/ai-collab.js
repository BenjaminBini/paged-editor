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
  });

  api.on("agent-message", ({ key, message }) => {
    handleAgentMessage(key, message);
  });

  renderAgentList();
  setupSparkButton();
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

  if (msg.type === "edit") {
    conv.push({ type: "edit", ...msg });
    conversations.set(key, conv);
    applyEdit(key, msg);
  } else if (msg.type === "message") {
    conv.push({ type: "message", text: msg.text, requestId: msg.requestId });
    conversations.set(key, conv);
    showAgentPopover(key, msg);
  } else if (msg.type === "question") {
    conv.push({ type: "question", ...msg });
    conversations.set(key, conv);
    showQuestionPopover(key, msg);
  } else if (msg.type === "status") {
    updateWaitingStatus(key, msg);
  }
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
    showAgentPopover(key, {
      type: "message",
      text: "Edit rejected: the text at the specified location has changed.",
      requestId: msg.requestId,
    });
    return;
  }

  // Show diff review modal instead of auto-applying
  const agent = agents.get(key);
  const agentName = agent ? agent.name : "Agent";
  showAgentDiffModal(agentName, currentText, msg.newText, msg.lineStart, msg.lineEnd)
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
    });
}

// ── Agent diff review modal ────────────────────────────────────────────────

let agentDiffResolve = null;

function showAgentDiffModal(agentName, oldText, newText, lineStart, lineEnd) {
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
    acceptBtn.onclick = () => { modal.classList.remove("open"); resolve("accept"); };
    rejectBtn.onclick = () => { modal.classList.remove("open"); resolve("reject"); };
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
  return `Connect to the paged editor by calling editor_connect with:
- url: ws://${wsHost}:${wsPort}
- key: ${key}
`;
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
    el.querySelector(".agent-name").onclick = () => showConversationHistory(key);
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

// ── Spark IA button ─────────────────────────────────────────────────────────

let sparkBtn = null;
let sparkVisible = false;

function setupSparkButton() {
  sparkBtn = document.getElementById("sparkBtn");
  if (!sparkBtn || !_cm) return;

  _cm.on("cursorActivity", updateSparkVisibility);
  document.addEventListener("mouseup", () => setTimeout(updateSparkVisibility, 10));
}

function updateSparkVisibility() {
  if (!_cm || !sparkBtn) return;

  const sel = _cm.getSelection();
  const connected = getConnectedAgents();

  if (!sel || connected.length === 0) {
    hideSparkButton();
    return;
  }

  // Position spark button near the selection end
  const cursor = _cm.getCursor("to");
  const coords = _cm.cursorCoords(cursor, "page");

  sparkBtn.style.top = (coords.bottom + 4) + "px";
  sparkBtn.style.left = (coords.left) + "px";
  sparkBtn.classList.add("visible");
  sparkVisible = true;

  sparkBtn.onclick = () => {
    const selection = getSelectionInfo();
    if (!selection) return;

    if (connected.length === 1) {
      showSparkPrompt(connected[0].key, selection);
    } else {
      showAgentPicker(connected, selection);
    }
  };
}

function hideSparkButton() {
  if (sparkBtn) sparkBtn.classList.remove("visible");
  sparkVisible = false;
}

function getSelectionInfo() {
  if (!_cm) return null;
  const from = _cm.getCursor("from");
  const to = _cm.getCursor("to");
  const text = _cm.getSelection();
  if (!text) return null;
  return {
    text,
    lineStart: from.line,
    lineEnd: to.line,
    chStart: from.ch,
    chEnd: to.ch,
  };
}

// ── Spark prompt popover ────────────────────────────────────────────────────

let activePopover = null;

function removeActivePopover() {
  if (activePopover) {
    activePopover.remove();
    activePopover = null;
  }
}

function showSparkPrompt(agentKey, selection) {
  removeActivePopover();
  hideSparkButton();

  const coords = _cm.cursorCoords(_cm.getCursor("to"), "page");
  const popover = createPopover(coords);

  const agent = agents.get(agentKey);
  const agentName = agent ? agent.name : "Agent";

  popover.innerHTML = `
    <div class="ai-popover-header">Ask ${escapeHtml(agentName)}</div>
    <textarea class="ai-popover-input" placeholder="What should I do with this selection?" rows="3"></textarea>
    <div class="ai-popover-actions">
      <button class="ai-popover-cancel">Cancel</button>
      <button class="ai-popover-send">Send</button>
    </div>
  `;

  const input = popover.querySelector(".ai-popover-input");
  const sendBtn = popover.querySelector(".ai-popover-send");
  const cancelBtn = popover.querySelector(".ai-popover-cancel");

  cancelBtn.onclick = () => removeActivePopover();

  const doSend = () => {
    const prompt = input.value.trim();
    if (!prompt) return;
    const requestId = sendRequest(agentKey, prompt, selection);
    removeActivePopover();
    showWaitingPopover(agentKey, requestId, selection, coords);
  };

  sendBtn.onclick = doSend;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      doSend();
    }
    if (e.key === "Escape") removeActivePopover();
  });

  clampPopover(popover);
  activePopover = popover;
  setTimeout(() => input.focus(), 10);
}

function showAgentPicker(connectedAgents, selection) {
  removeActivePopover();
  hideSparkButton();

  const coords = _cm.cursorCoords(_cm.getCursor("to"), "page");
  const popover = createPopover(coords);

  popover.innerHTML = `
    <div class="ai-popover-header">Choose an agent</div>
    <div class="ai-popover-agent-list"></div>
  `;

  const list = popover.querySelector(".ai-popover-agent-list");
  for (const { key, name } of connectedAgents) {
    const btn = document.createElement("button");
    btn.className = "ai-popover-agent-pick";
    btn.textContent = name;
    btn.onclick = () => {
      removeActivePopover();
      showSparkPrompt(key, selection);
    };
    list.appendChild(btn);
  }

  clampPopover(popover);
  activePopover = popover;
}

function showWaitingPopover(agentKey, requestId, selection, coords) {
  removeActivePopover();

  const popover = createPopover(coords);
  const agent = agents.get(agentKey);
  const agentName = agent ? agent.name : "Agent";

  popover.innerHTML = `
    <div class="ai-popover-header">${escapeHtml(agentName)}</div>
    <div class="ai-popover-waiting"><div class="ai-spinner"></div> Thinking...</div>
  `;
  popover.dataset.requestId = requestId;
  popover.dataset.agentKey = agentKey;

  clampPopover(popover);
  activePopover = popover;
}

function updateWaitingStatus(key, msg) {
  // Update the waiting popover in-place if it matches
  if (!activePopover) return;
  if (msg.requestId && activePopover.dataset.requestId !== msg.requestId) return;

  const waitingEl = activePopover.querySelector(".ai-popover-waiting");
  if (waitingEl) {
    waitingEl.innerHTML = `<div class="ai-spinner"></div> ${escapeHtml(msg.text)}`;
  }
}

// ── Agent response popovers ─────────────────────────────────────────────────

function showAgentPopover(key, msg) {
  const agent = agents.get(key);
  const agentName = agent ? agent.name : "Agent";

  // Always remove any existing popover before showing a new one
  removeActivePopover();

  // If there's already an active popover waiting for this request, replace it
  if (activePopover && activePopover.dataset.requestId === msg.requestId) {
    const coords = {
      bottom: parseInt(activePopover.style.top),
      left: parseInt(activePopover.style.left),
    };
    removeActivePopover();

    const popover = createPopover(coords);
    popover.innerHTML = `
      <div class="ai-popover-header">${escapeHtml(agentName)}</div>
      <div class="ai-popover-message">${escapeHtml(msg.text)}</div>
      <div class="ai-popover-actions">
        <button class="ai-popover-cancel">Close</button>
      </div>
    `;
    popover.querySelector(".ai-popover-cancel").onclick = () => removeActivePopover();
    clampPopover(popover);
    activePopover = popover;
    return;
  }

  // New popover — anchor to a sensible position
  const coords = _cm ? _cm.cursorCoords(_cm.getCursor(), "page") : { bottom: 200, left: 400 };
  const popover = createPopover(coords);
  popover.innerHTML = `
    <div class="ai-popover-header">${escapeHtml(agentName)}</div>
    <div class="ai-popover-message">${escapeHtml(msg.text)}</div>
    <div class="ai-popover-actions">
      <button class="ai-popover-cancel">Close</button>
    </div>
  `;
  popover.querySelector(".ai-popover-cancel").onclick = () => removeActivePopover();
  clampPopover(popover);
  activePopover = popover;
}

function showQuestionPopover(key, msg) {
  const agent = agents.get(key);
  const agentName = agent ? agent.name : "Agent";

  // Always remove any existing popover before showing a new one
  removeActivePopover();

  // Replace waiting popover if matching
  let coords;
  if (activePopover && activePopover.dataset.requestId === msg.requestId) {
    coords = { bottom: parseInt(activePopover.style.top), left: parseInt(activePopover.style.left) };
    removeActivePopover();
  } else {
    coords = _cm ? _cm.cursorCoords(_cm.getCursor(), "page") : { bottom: 200, left: 400 };
  }

  const popover = createPopover(coords);
  let actionsHtml = "";

  if (msg.choices && msg.choices.length > 0) {
    actionsHtml = `<div class="ai-popover-choices">
      ${msg.choices.map(c => `<button class="ai-popover-choice">${escapeHtml(c)}</button>`).join("")}
    </div>`;
  } else {
    actionsHtml = `
      <textarea class="ai-popover-input" placeholder="Your answer..." rows="2"></textarea>
      <div class="ai-popover-actions">
        <button class="ai-popover-cancel">Cancel</button>
        <button class="ai-popover-send">Reply</button>
      </div>
    `;
  }

  popover.innerHTML = `
    <div class="ai-popover-header">${escapeHtml(agentName)}</div>
    <div class="ai-popover-message">${escapeHtml(msg.text)}</div>
    ${actionsHtml}
  `;

  if (msg.choices && msg.choices.length > 0) {
    popover.querySelectorAll(".ai-popover-choice").forEach((btn, i) => {
      btn.onclick = () => {
        sendAnswer(key, msg.id, msg.choices[i]);
        removeActivePopover();
      };
    });
  } else {
    const input = popover.querySelector(".ai-popover-input");
    const sendBtn = popover.querySelector(".ai-popover-send");
    const cancelBtn = popover.querySelector(".ai-popover-cancel");
    cancelBtn.onclick = () => removeActivePopover();
    sendBtn.onclick = () => {
      const val = input.value.trim();
      if (val) {
        sendAnswer(key, msg.id, val);
        removeActivePopover();
      }
    };
  }

  clampPopover(popover);
  activePopover = popover;
}

// ── Conversation history popover ────────────────────────────────────────────

function showConversationHistory(key) {
  const agent = agents.get(key);
  if (!agent) return;
  const conv = conversations.get(key) || [];
  if (conv.length === 0) return;

  removeActivePopover();

  // Show as a modal-style overlay
  const overlay = document.createElement("div");
  overlay.className = "ai-history-overlay";

  const panel = document.createElement("div");
  panel.className = "ai-history-panel";

  let html = `<div class="ai-history-header">
    <span>Conversation with ${escapeHtml(agent.name)}</span>
    <button class="ai-history-close">&times;</button>
  </div><div class="ai-history-body">`;

  for (const entry of conv) {
    if (entry.type === "request") {
      html += `<div class="ai-history-entry user"><strong>You:</strong> ${escapeHtml(entry.prompt)}</div>`;
    } else if (entry.type === "message") {
      html += `<div class="ai-history-entry agent"><strong>${escapeHtml(agent.name)}:</strong> ${escapeHtml(entry.text)}</div>`;
    } else if (entry.type === "question") {
      html += `<div class="ai-history-entry agent"><strong>${escapeHtml(agent.name)}:</strong> ${escapeHtml(entry.text)}</div>`;
    } else if (entry.type === "answer") {
      html += `<div class="ai-history-entry user"><strong>You:</strong> ${escapeHtml(entry.value)}</div>`;
    } else if (entry.type === "edit") {
      html += `<div class="ai-history-entry agent edit"><strong>${escapeHtml(agent.name)} edited lines ${entry.lineStart}-${entry.lineEnd}</strong></div>`;
    }
  }

  html += "</div>";
  panel.innerHTML = html;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  panel.querySelector(".ai-history-close").onclick = () => overlay.remove();
}

// ── Popover helper ──────────────────────────────────────────────────────────

function createPopover(coords) {
  const popover = document.createElement("div");
  popover.className = "ai-popover";
  popover._coords = coords;          // stash for clampPopover
  return popover;
}

function clampPopover(popover) {
  const coords = popover._coords || { bottom: 200, left: 400, top: 180 };
  document.body.appendChild(popover);

  const rect = popover.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pw = rect.width || 320;
  const ph = rect.height || 200;

  let top = coords.bottom + 4;
  let left = coords.left;

  if (top + ph > vh - 8) top = Math.max(8, (coords.top || coords.bottom - 20) - ph - 4);
  if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8);

  popover.style.top = top + "px";
  popover.style.left = left + "px";
}

// ── Utility ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
