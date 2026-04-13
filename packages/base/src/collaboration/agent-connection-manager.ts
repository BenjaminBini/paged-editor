// ai-collab.js — AI agent collaboration module

import { computeDiff, renderDiffHtml } from '../workspace/files/diff-merge-service.js';
import { escapeHtml } from '../infrastructure/text-utils.js';
import * as platform from '../infrastructure/platform-adapter.js';

// ── State ───────────────────────────────────────────────────────────────────

const agents: Map<string, { name: string; connected: boolean }> = new Map();       // key -> { name, connected: true }
const pendingKeys: Map<string, { created: Date }> = new Map();  // key -> { created: Date }
const conversations: Map<string, Array<{ type: string; [key: string]: any }>> = new Map(); // key -> [{ type, ...data }]
let wsPort: number = 0;
let wsHost: string = "localhost";

// ── Diff review state ──────────────────────────────────────────────────────
let _diffReviewResolve: ((result: { action: string; newContent?: string; filePath?: string; reason?: string }) => void) | null = null;
let _diffReviewAgentKey: string | null = null;

// ── External dependencies (set by app.js) ───────────────────────────────────

let _cm: any = null;
let _getFilePath: (() => string | null) | null = null;

// ── Conversation hooks ──────────────────────────────────────────────────────

let _onConversationUpdate: ((key: string) => void) | null = null;
export function onConversationUpdate(fn: (key: string) => void): void { _onConversationUpdate = fn; }

function notifyConversationUpdate(key: string): void {
  if (_onConversationUpdate) _onConversationUpdate(key);
}

let _onAgentsChanged: ((agents: Array<{ key: string; name: string }>) => void) | null = null;
export function onAgentsChanged(fn: (agents: Array<{ key: string; name: string }>) => void): void { _onAgentsChanged = fn; }

let _onAgentClick: ((key: string) => void) | null = null;
export function onAgentClick(fn: (key: string) => void): void { _onAgentClick = fn; }

export function getConversation(key: string): Array<{ type: string; [key: string]: any }> {
  return conversations.get(key) || [];
}

export function init(cm: any, getFilePath: () => string | null): void {
  _cm = cm;
  _getFilePath = getFilePath;
  platform.getWsPort().then(port => { wsPort = port; });
  platform.getWsHost().then(host => { wsHost = host; });

  // Listen for agent events from main process
  platform.on("agent-connected", ({ key, name }: { key: string; name: string }) => {
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

  platform.on("agent-disconnected", ({ key }: { key: string }) => {
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

  platform.on("agent-message", ({ key, message }: { key: string; message: any }) => {
    handleAgentMessage(key, message);
  });

  renderAgentList();
}

// ── Key generation ──────────────────────────────────────────────────────────

export async function addAgent(): Promise<void> {
  const key = await platform.generateAgentKey();
  pendingKeys.set(key, { created: new Date() });
  showAgentPromptModal(key);
  renderAgentList();
}

// ── Protocol: handle incoming agent messages ────────────────────────────────

function handleAgentMessage(key: string, msg: any): void {
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
    let idx = -1;
    for (let i = conv.length - 1; i >= 0; i--) {
      if (conv[i].type === "status" && conv[i].requestId === msg.requestId) { idx = i; break; }
    }
    if (idx >= 0) conv.splice(idx, 1);
    conv.push({ type: "status", text: msg.text, requestId: msg.requestId });
    conversations.set(key, conv);
    notifyConversationUpdate(key);
  }
}

// ── Diff review view ──────────────────────────────────────────────────────

function showDiffReview(agentKey: string, msg: any): void {
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

  if (!view || !titleEl || !fileEl || !body || !footer) return;

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

  function finish(result: { action: string; newContent?: string; filePath?: string; reason?: string }): void {
    _diffReviewResolve = null;
    _diffReviewAgentKey = null;

    // Restore editor
    if (view) view.hidden = true;
    _cm.getWrapperElement().style.display = "";

    if (result.action === "accept") {
      // Write to disk, update editor
      platform.writeFile(result.filePath!, result.newContent!).then(() => {
        const cursor = _cm.getCursor();
        const scrollInfo = _cm.getScrollInfo();
        _cm.setValue(result.newContent!);
        const maxLine = _cm.lineCount() - 1;
        _cm.setCursor({ line: Math.min(cursor.line, maxLine), ch: cursor.ch });
        _cm.scrollTo(scrollInfo.left, scrollInfo.top);
      });
      platform.sendToAgent(agentKey, { type: "proposal_accepted", requestId: msg.requestId });
      const c = conversations.get(agentKey) || [];
      c.push({ type: "proposal_result", accepted: true, requestId: msg.requestId });
      conversations.set(agentKey, c);
    } else {
      platform.sendToAgent(agentKey, {
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

  const acceptBtn = document.getElementById("diffReviewAccept");
  if (acceptBtn) acceptBtn.onclick = () => {
    finish({ action: "accept", newContent, filePath });
  };

  const rejectBtn = document.getElementById("diffReviewReject");
  if (rejectBtn) rejectBtn.onclick = () => {
    showRejectFeedback(footer);
  };

  function showRejectFeedback(footerEl: HTMLElement): void {
    footerEl.innerHTML = `
      <div class="diff-review-feedback">
        <input type="text" id="diffRejectReason" placeholder="Why are you rejecting this change?" autofocus />
        <button id="diffRejectSend">Send</button>
      </div>
    `;
    const input = document.getElementById("diffRejectReason") as HTMLInputElement;
    const sendBtn = document.getElementById("diffRejectSend") as HTMLElement;

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

export function sendRequest(key: string, prompt: string, selection: { text: string; lineStart: number; lineEnd: number; chStart?: number; chEnd?: number } | null): string | undefined {
  if (!_cm) return;

  const content = _cm.getValue();
  const filePath = _getFilePath ? _getFilePath() : null;
  const fileName = filePath ? filePath.split("/").pop() : "untitled.md";

  // Context: 5 lines before and after selection
  const ctxBefore = [];
  if (selection) {
    for (let i = Math.max(0, selection.lineStart - 5); i < selection.lineStart; i++) {
      ctxBefore.push(_cm.getLine(i));
    }
  }
  const ctxAfter = [];
  if (selection) {
    for (let i = selection.lineEnd + 1; i <= Math.min(_cm.lineCount() - 1, selection.lineEnd + 5); i++) {
      ctxAfter.push(_cm.getLine(i));
    }
  }

  const requestId = crypto.randomUUID();
  const message = {
    type: "request",
    id: requestId,
    prompt,
    selection: selection ? {
      text: selection.text,
      lineStart: selection.lineStart,
      lineEnd: selection.lineEnd,
      chStart: selection.chStart,
      chEnd: selection.chEnd,
    } : null,
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

  platform.sendToAgent(key, message);
  return requestId;
}

// ── Send answer to agent question ───────────────────────────────────────────

export function sendAnswer(key: string, questionId: string, value: string): void {
  platform.sendToAgent(key, { type: "answer", questionId, value });
  const conv = conversations.get(key) || [];
  conv.push({ type: "answer", questionId, value });
  conversations.set(key, conv);
}

// ── Get connected agents ────────────────────────────────────────────────────

export function getConnectedAgents(): Array<{ key: string; name: string }> {
  const result = [];
  for (const [key, agent] of agents) {
    if (agent.connected) result.push({ key, name: agent.name });
  }
  return result;
}

// ── Disconnect agent ────────────────────────────────────────────────────────

function disconnectAgent(key: string): void {
  platform.revokeAgentKey(key);
  agents.delete(key);
  pendingKeys.delete(key);
  renderAgentList();
}

// ── Prompt template ─────────────────────────────────────────────────────────

function buildAgentPrompt(key: string): string {
  return `/ao-analyst:editor-connect ws://${wsHost}:${wsPort} ${key}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// UI — all DOM manipulation below
// ══════════════════════════════════════════════════════════════════════════════

// ── Sidebar: agents list ────────────────────────────────────────────────────

const agentSection: HTMLElement | null = document.getElementById("agentSection");
const agentList: HTMLElement | null = document.getElementById("agentList");
const btnAddAgent: HTMLElement | null = document.getElementById("btnAddAgent");

if (btnAddAgent) btnAddAgent.onclick = () => addAgent();

function renderAgentList(): void {
  if (!agentList || !agentSection) return;

  const connected = getConnectedAgents();
  const pending = pendingKeys.size;

  agentList.innerHTML = "";

  for (const { key, name } of connected) {
    const el = document.createElement("div");
    el.className = "agent-item connected";
    el.innerHTML = `<span class="agent-dot"></span><span class="agent-name">${escapeHtml(name)}</span><button class="agent-disconnect" title="Disconnect agent">&times;</button>`;
    (el.querySelector(".agent-name") as HTMLElement).onclick = () => {
      if (_onAgentClick) _onAgentClick(key);
    };
    (el.querySelector(".agent-disconnect") as HTMLElement).onclick = (e) => {
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

const agentModal: HTMLElement | null = document.getElementById("agentModal");
const agentPromptText: HTMLElement | null = document.getElementById("agentPromptText");
const btnCopyPrompt: HTMLElement | null = document.getElementById("btnCopyPrompt");
const btnCloseAgentModal: HTMLElement | null = document.getElementById("btnCloseAgentModal");
const agentModalContent: HTMLElement | null = document.getElementById("agentModalContent");
const agentModalSuccess: HTMLElement | null = document.getElementById("agentModalSuccess");

let currentModalKey: string | null = null;

if (btnCloseAgentModal) btnCloseAgentModal.onclick = () => closeAgentModal();

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  // Close modals & overlays in priority order
  // Escape while reviewing a proposal → trigger reject feedback
  const diffView = document.getElementById("diffReviewView");
  if (diffView && !diffView.hidden) {
    const footer = document.getElementById("diffReviewFooter");
    // Only trigger reject if not already showing feedback
    if (!footer?.querySelector(".diff-review-feedback")) {
      const rejectBtn = document.getElementById("diffReviewReject");
      if (rejectBtn) rejectBtn.click();
    }
    return;
  }
  if (agentModal?.classList.contains("open")) { closeAgentModal(); return; }
});

function showAgentPromptModal(key: string): void {
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

function showAgentModalConnected(): void {
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

function closeAgentModal(): void {
  if (agentModal) agentModal.classList.remove("open");
  currentModalKey = null;
  if (agentModalContent) agentModalContent.hidden = false;
  if (agentModalSuccess) {
    agentModalSuccess.hidden = true;
    agentModalSuccess.classList.remove("animate");
  }
}

