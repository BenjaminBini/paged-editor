// chat-sidebar.js — Chat sidebar UI for AI agent conversations

import { cm } from '../editor/codemirror-editor.js';
import { escapeHtml } from '../infrastructure/text-utils.js';

// ── DOM refs ────────────────────────────────────────────────────────────────

const sidebar: HTMLElement | null = document.getElementById("chatSidebar");
const agentTabs: HTMLElement | null = document.getElementById("chatAgentTabs");
const messagesEl: HTMLElement | null = document.getElementById("chatMessages");
const input: HTMLTextAreaElement | null = document.getElementById("chatInput") as HTMLTextAreaElement | null;
const sendBtn: HTMLButtonElement | null = document.getElementById("chatSendBtn") as HTMLButtonElement | null;
const contextPill: HTMLElement | null = document.getElementById("chatContextPill");

// ── State ───────────────────────────────────────────────────────────────────

type Agent = { key: string; name: string };
type Context = { text: string; lineStart: number; lineEnd: number; label: string | null };

let activeAgentKey: string | null = null;
let agents: Agent[] = [];           // [{ key, name }]
let pendingContext: Context | null = null;  // { text, lineStart, lineEnd, label } or null

// ── Callbacks (set by app.js) ───────────────────────────────────────────────

let _onSend: ((agentKey: string, prompt: string, selection: Context | null) => void) | null = null;
let _onAnswer: ((agentKey: string, questionId: string, value: string) => void) | null = null;
let _getConversation: ((agentKey: string) => Array<{ type: string; [key: string]: any }>) | null = null;
let _getSection: (() => Context | null) | null = null;

export function onSend(fn: (agentKey: string, prompt: string, selection: Context | null) => void): void { _onSend = fn; }
export function onAnswer(fn: (agentKey: string, questionId: string, value: string) => void): void { _onAnswer = fn; }
export function setGetConversation(fn: (agentKey: string) => Array<{ type: string; [key: string]: any }>): void { _getConversation = fn; }
export function setGetSection(fn: () => Context | null): void { _getSection = fn; }

// ── Show / hide ─────────────────────────────────────────────────────────────

export function show(): void {
  if (sidebar) sidebar.classList.add("open");
}

export function hide(): void {
  if (sidebar) sidebar.classList.remove("open");
}

export function isVisible(): boolean {
  return sidebar?.classList.contains("open") || false;
}

// ── Agent management ────────────────────────────────────────────────────────

export function setAgents(agentList: Agent[]): void {
  agents = agentList;
  if (agents.length > 0 && !activeAgentKey) {
    activeAgentKey = agents[0].key;
  }
  // If active agent disconnected, switch to first available
  if (activeAgentKey && !agents.find((a: Agent) => a.key === activeAgentKey)) {
    activeAgentKey = agents.length > 0 ? agents[0].key : null;
  }
  renderTabs();
  updateInputState();
  renderMessages();
}

export function getActiveAgentKey(): string | null { return activeAgentKey; }

// ── Focus chat with context ─────────────────────────────────────────────────

export function focusWithContext(context: Context): void {
  if (!input) return;
  pendingContext = context;
  renderContextPill();
  input.focus();
}

export function focusForAgent(agentKey: string): void {
  if (agents.find(a => a.key === agentKey)) {
    activeAgentKey = agentKey;
    renderTabs();
    renderMessages();
  }
  updateInputState();
  if (input) input.focus();
}

// ── Refresh messages (called when conversation updates) ─────────────────────

export function refresh(): void {
  renderMessages();
}

// ── Tab rendering ───────────────────────────────────────────────────────────

function renderTabs(): void {
  if (!agentTabs) return;
  agentTabs.innerHTML = "";

  if (agents.length <= 1 && agents.length > 0) {
    // Single agent — just show name, no tabs
    const el = document.createElement("div");
    el.className = "chat-agent-tab active";
    el.innerHTML = '<span class="chat-agent-dot"></span>' + escapeHtml(agents[0].name);
    agentTabs.appendChild(el);
    return;
  }

  for (const agent of agents) {
    const el = document.createElement("div");
    el.className = "chat-agent-tab" + (agent.key === activeAgentKey ? " active" : "");
    el.innerHTML = '<span class="chat-agent-dot"></span>' + escapeHtml(agent.name);
    el.onclick = () => {
      activeAgentKey = agent.key;
      renderTabs();
      renderMessages();
    };
    agentTabs.appendChild(el);
  }
}

// ── Message rendering ───────────────────────────────────────────────────────

function renderMessages(): void {
  if (!messagesEl) return;
  messagesEl.innerHTML = "";

  if (!activeAgentKey || !_getConversation) {
    messagesEl.innerHTML = '<div class="chat-empty">No conversation yet</div>';
    return;
  }

  const conv = _getConversation(activeAgentKey);
  if (!conv || conv.length === 0) {
    messagesEl.innerHTML = '<div class="chat-empty">Start a conversation</div>';
    return;
  }

  const agentName = agents.find(a => a.key === activeAgentKey)?.name || "Agent";

  for (const entry of conv) {
    if (entry.type === "request") {
      const msg = document.createElement("div");
      msg.className = "chat-msg user";
      msg.innerHTML = '<div class="chat-msg-label">You</div>' + escapeHtml(entry.prompt);
      messagesEl.appendChild(msg);

      // Show context pill if selection was attached
      if (entry.selection?.text) {
        const pill = document.createElement("div");
        pill.className = "chat-context-pill";
        const preview = entry.selection.text.length > 80
          ? entry.selection.text.substring(0, 80) + "..."
          : entry.selection.text;
        pill.textContent = "\uD83D\uDCCE Lines " + (entry.selection.lineStart + 1) + "-" + (entry.selection.lineEnd + 1) + ': "' + preview + '"';
        messagesEl.appendChild(pill);
      }
    } else if (entry.type === "message") {
      const msg = document.createElement("div");
      msg.className = "chat-msg agent";
      msg.innerHTML = '<div class="chat-msg-label">' + escapeHtml(agentName) + '</div>' + escapeHtml(entry.text);
      messagesEl.appendChild(msg);
    } else if (entry.type === "question") {
      const msg = document.createElement("div");
      msg.className = "chat-msg agent";
      msg.innerHTML = '<div class="chat-msg-label">' + escapeHtml(agentName) + '</div>' + escapeHtml(entry.text);

      // Add choices or reply input if not yet answered
      if (!entry.answered) {
        if (entry.choices && entry.choices.length > 0) {
          const choices = document.createElement("div");
          choices.className = "chat-choices";
          for (const choice of entry.choices) {
            const btn = document.createElement("button");
            btn.className = "chat-choice-btn";
            btn.textContent = choice;
            btn.onclick = () => {
              if (_onAnswer && activeAgentKey) _onAnswer(activeAgentKey, entry.id, choice);
              entry.answered = true;
              renderMessages();
            };
            choices.appendChild(btn);
          }
          msg.appendChild(choices);
        } else {
          const replyDiv = document.createElement("div");
          replyDiv.className = "chat-inline-reply";
          const replyInput = document.createElement("input");
          replyInput.placeholder = "Your answer...";
          const replyBtn = document.createElement("button");
          replyBtn.textContent = "Reply";
          const doReply = () => {
            const val = replyInput.value.trim();
            if (!val) return;
            if (_onAnswer && activeAgentKey) _onAnswer(activeAgentKey, entry.id, val);
            entry.answered = true;
            renderMessages();
          };
          replyBtn.onclick = doReply;
          replyInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") { e.preventDefault(); doReply(); }
          });
          replyDiv.appendChild(replyInput);
          replyDiv.appendChild(replyBtn);
          msg.appendChild(replyDiv);
        }
      }
      messagesEl.appendChild(msg);
    } else if (entry.type === "answer") {
      const msg = document.createElement("div");
      msg.className = "chat-msg user";
      msg.innerHTML = '<div class="chat-msg-label">You</div>' + escapeHtml(entry.value);
      messagesEl.appendChild(msg);
    } else if (entry.type === "status") {
      const msg = document.createElement("div");
      msg.className = "chat-msg status";
      msg.innerHTML = '<div class="ai-spinner"></div>' + escapeHtml(entry.text);
      messagesEl.appendChild(msg);
    } else if (entry.type === "propose") {
      const msg = document.createElement("div");
      msg.className = "chat-msg edit-note";
      msg.textContent = "Proposed changes to " + (entry.filePath ? entry.filePath.split("/").pop() : "file");
      messagesEl.appendChild(msg);
    } else if (entry.type === "proposal_result") {
      const msg = document.createElement("div");
      msg.className = "chat-msg edit-note";
      if (entry.accepted) {
        msg.textContent = "\u2713 Changes accepted";
      } else {
        msg.textContent = "\u2717 Changes rejected: " + (entry.reason || "");
      }
      messagesEl.appendChild(msg);
    }
  }

  // Auto-scroll to bottom
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Context pill ────────────────────────────────────────────────────────────

function renderContextPill(): void {
  if (!contextPill) return;
  if (!pendingContext) {
    contextPill.style.display = "none";
    return;
  }
  contextPill.style.display = "";
  const preview = pendingContext.text.length > 60
    ? pendingContext.text.substring(0, 60) + "..."
    : pendingContext.text;
  contextPill.textContent = pendingContext.label
    ? "\uD83D\uDCCE " + pendingContext.label
    : "\uD83D\uDCCE Lines " + (pendingContext.lineStart + 1) + "-" + (pendingContext.lineEnd + 1) + ': "' + preview + '"';
}

// ── Compute context from cursor position ────────────────────────────────────

function getAutoContext(): Context | null {
  if (!cm) return null;

  // Check for text selection first
  const sel = cm.getSelection();
  if (sel) {
    const from = cm.getCursor("from");
    const to = cm.getCursor("to");
    return {
      text: sel,
      lineStart: from.line,
      lineEnd: to.line,
      label: null as string | null,
    };
  }

  // No selection — get H1 section
  if (_getSection) return _getSection();
  return null;
}

// ── Input state ─────────────────────────────────────────────────────────────

function updateInputState(): void {
  if (!input || !sendBtn) return;
  const hasAgent = activeAgentKey && agents.length > 0;
  const hasFile = cm && cm.getValue().length > 0;

  if (!hasAgent) {
    input.disabled = true;
    sendBtn.disabled = true;
    input.placeholder = "No agent connected";
  } else if (!hasFile) {
    input.disabled = true;
    sendBtn.disabled = true;
    input.placeholder = "Open a file to start";
  } else {
    input.disabled = false;
    sendBtn.disabled = false;
    input.placeholder = "Ask about your document...";
  }
}

// ── Send ────────────────────────────────────────────────────────────────────

function doSend(): void {
  if (!input || !activeAgentKey || !_onSend) return;
  const prompt = input.value.trim();
  if (!prompt) return;

  // Use pending context (from spark button) or auto-compute
  const context = pendingContext || getAutoContext();
  pendingContext = null;
  renderContextPill();

  _onSend(activeAgentKey, prompt, context);
  input.value = "";
}

// ── Event listeners ─────────────────────────────────────────────────────────

if (sendBtn) sendBtn.onclick = doSend;
if (input) {
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      doSend();
    }
  });
}

