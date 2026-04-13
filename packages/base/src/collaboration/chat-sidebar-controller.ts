// chat-sidebar.js — Chat sidebar UI for AI agent conversations

import { cm } from '../editor/codemirror-editor.js';
import { escapeHtml } from '../infrastructure/text-utils.js';
import { signal, effect, batch } from '../infrastructure/signal.js';

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

const activeAgentKey = signal<string | null>(null);
const agents = signal<Agent[]>([]);
const pendingContext = signal<Context | null>(null);
const conversationVersion = signal(0);

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

// ── Tab rendering ───────────────────────────────────────────────────────────

function renderTabs(agentList: Agent[], activeKey: string | null): void {
  if (!agentTabs) return;
  agentTabs.innerHTML = "";

  if (agentList.length <= 1 && agentList.length > 0) {
    // Single agent — just show name, no tabs
    const el = document.createElement("div");
    el.className = "chat-agent-tab active";
    el.innerHTML = '<span class="chat-agent-dot"></span>' + escapeHtml(agentList[0].name);
    agentTabs.appendChild(el);
    return;
  }

  for (const agent of agentList) {
    const el = document.createElement("div");
    el.className = "chat-agent-tab" + (agent.key === activeKey ? " active" : "");
    el.innerHTML = '<span class="chat-agent-dot"></span>' + escapeHtml(agent.name);
    el.onclick = () => {
      activeAgentKey.value = agent.key;
    };
    agentTabs.appendChild(el);
  }
}

// ── Message rendering ───────────────────────────────────────────────────────

function renderMessages(activeKey: string | null): void {
  if (!messagesEl) return;
  messagesEl.innerHTML = "";

  if (!activeKey || !_getConversation) {
    messagesEl.innerHTML = '<div class="chat-empty">No conversation yet</div>';
    return;
  }

  const conv = _getConversation(activeKey);
  if (!conv || conv.length === 0) {
    messagesEl.innerHTML = '<div class="chat-empty">Start a conversation</div>';
    return;
  }

  const agentName = agents.value.find(a => a.key === activeKey)?.name || "Agent";

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
              if (_onAnswer && activeAgentKey.value) _onAnswer(activeAgentKey.value, entry.id, choice);
              entry.answered = true;
              conversationVersion.value++;
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
            if (_onAnswer && activeAgentKey.value) _onAnswer(activeAgentKey.value, entry.id, val);
            entry.answered = true;
            conversationVersion.value++;
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

function renderContextPill(context: Context | null): void {
  if (!contextPill) return;
  if (!context) {
    contextPill.style.display = "none";
    return;
  }
  contextPill.style.display = "";
  const preview = context.text.length > 60
    ? context.text.substring(0, 60) + "..."
    : context.text;
  contextPill.textContent = context.label
    ? "\uD83D\uDCCE " + context.label
    : "\uD83D\uDCCE Lines " + (context.lineStart + 1) + "-" + (context.lineEnd + 1) + ': "' + preview + '"';
}

// ── Input state ─────────────────────────────────────────────────────────────

function updateInputState(activeKey: string | null, agentList: Agent[]): void {
  if (!input || !sendBtn) return;
  const hasAgent = activeKey && agentList.length > 0;
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

// ── Effects (auto-render when state changes) ────────────────────────────────

effect(() => { renderTabs(agents.value, activeAgentKey.value); });
effect(() => {
  const _v = conversationVersion.value; // track conversationVersion
  renderMessages(activeAgentKey.value);
});
effect(() => { updateInputState(activeAgentKey.value, agents.value); });
effect(() => { renderContextPill(pendingContext.value); });

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

// ── Agent management ────────────────────────────────────────────────────────

export function setAgents(agentList: Agent[]): void {
  batch(() => {
    agents.value = agentList;
    if (agentList.length > 0 && !activeAgentKey.value) {
      activeAgentKey.value = agentList[0].key;
    }
    if (activeAgentKey.value && !agentList.find((a: Agent) => a.key === activeAgentKey.value)) {
      activeAgentKey.value = agentList.length > 0 ? agentList[0].key : null;
    }
  });
}

export function getActiveAgentKey(): string | null { return activeAgentKey.value; }

// ── Focus chat with context ─────────────────────────────────────────────────

export function focusWithContext(context: Context): void {
  if (!input) return;
  pendingContext.value = context;
  input.focus();
}

export function focusForAgent(agentKey: string): void {
  if (agents.value.find(a => a.key === agentKey)) {
    activeAgentKey.value = agentKey;
  }
  if (input) input.focus();
}

// ── Refresh messages (called when conversation updates) ─────────────────────

export function refresh(): void {
  conversationVersion.value++;
}

// ── Send ────────────────────────────────────────────────────────────────────

function doSend(): void {
  if (!input || !activeAgentKey.value || !_onSend) return;
  const prompt = input.value.trim();
  if (!prompt) return;

  // Use pending context (from spark button) or auto-compute
  const context = pendingContext.value || getAutoContext();
  pendingContext.value = null;

  _onSend(activeAgentKey.value, prompt, context);
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
