// ai-collab.js — AI agent collaboration module

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

  if (msg.type === "message") {
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
