# AI Chat Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace floating AI popovers with a persistent chat sidebar, one tab per agent, with context-aware message input.

**Architecture:** New `chat-sidebar.js` module owns the chat DOM and input handling. `ai-collab.js` is refactored to remove all popover UI code, keeping only agent state, protocol handling, and conversation data with callback hooks for the chat sidebar. The sidebar auto-shows/hides with agent connections.

**Tech Stack:** Vanilla ES6 modules, existing CSS scheme, existing WebSocket agent protocol.

**Spec:** `docs/superpowers/specs/2026-03-30-ai-chat-sidebar-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `js/chat-sidebar.js` | Create | Chat sidebar DOM, message rendering, input, context, agent tabs |
| `js/ai-collab.js` | Modify | Remove popover UI, add conversation callbacks for chat-sidebar |
| `js/app.js` | Modify | Wire chat-sidebar, update spark button behavior |
| `css/ai-collab.css` | Modify | Remove popover styles, add chat sidebar styles |
| `index.html` | Modify | Add chat sidebar container, keep agent modal |

---

### Task 1: Add chat sidebar HTML container

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the chat sidebar div after the preview pane**

In `index.html`, after the `</div>` that closes `.preview-pane` (line 346) and before the closing `</div>` of `.container` (line 347), insert:

```html
      <div class="chat-sidebar" id="chatSidebar">
        <div class="chat-header" id="chatHeader">
          <div class="chat-agent-tabs" id="chatAgentTabs"></div>
        </div>
        <div class="chat-messages" id="chatMessages"></div>
        <div class="chat-input-area" id="chatInputArea">
          <div class="chat-context-pill" id="chatContextPill" style="display:none"></div>
          <textarea class="chat-input" id="chatInput" placeholder="No agent connected" disabled rows="2"></textarea>
          <div class="chat-input-actions">
            <button class="chat-send-btn" id="chatSendBtn" disabled>Send</button>
          </div>
        </div>
      </div>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add chat sidebar HTML container"
```

---

### Task 2: Add chat sidebar CSS

**Files:**
- Modify: `css/ai-collab.css`

- [ ] **Step 1: Add chat sidebar styles at the end of `css/ai-collab.css`**

Append these styles:

```css
/* ── Chat sidebar ─────────────────────────────────────────────────────────── */

.chat-sidebar {
  width: 280px; background: #171726; border-left: 1px solid #2d2d3f;
  display: none; flex-direction: column; flex-shrink: 0;
}
.chat-sidebar.open { display: flex; }

.chat-header {
  height: 32px; background: #1e1e2e; border-bottom: 1px solid #2d2d3f;
  display: flex; align-items: stretch; flex-shrink: 0;
}

.chat-agent-tabs {
  display: flex; align-items: stretch; flex: 1; overflow: hidden;
}

.chat-agent-tab {
  display: flex; align-items: center; gap: 5px;
  padding: 0 12px; cursor: pointer; font-size: 11px;
  color: #6c7086; border-bottom: 2px solid transparent;
  white-space: nowrap; transition: color 0.1s;
}
.chat-agent-tab:hover { color: #a0a0c0; }
.chat-agent-tab.active { color: #cdd6f4; border-bottom-color: #3373b3; }
.chat-agent-tab .chat-agent-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #a6e3a1; flex-shrink: 0;
}

.chat-messages {
  flex: 1; overflow-y: auto; padding: 8px; display: flex;
  flex-direction: column; gap: 6px;
}

.chat-msg {
  padding: 6px 10px; border-radius: 8px; font-size: 12px;
  line-height: 1.5; white-space: pre-wrap; word-break: break-word;
  max-width: 100%;
}
.chat-msg-label {
  font-size: 9px; font-weight: 600; color: #64748b;
  text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 2px;
}
.chat-msg.user { background: #0f172a; color: #cdd6f4; }
.chat-msg.agent { background: #1a2744; color: #e2e8f0; }
.chat-msg.status {
  background: transparent; color: #64748b; font-size: 11px;
  display: flex; align-items: center; gap: 6px; padding: 4px 10px;
}
.chat-msg.edit-note {
  background: transparent; color: #64748b; font-size: 11px;
  font-style: italic; padding: 4px 10px;
}

.chat-context-pill {
  margin: 0 8px 4px; padding: 4px 8px; border-radius: 4px;
  border: 1px dashed #334155; background: #0f172a;
  font-size: 10px; color: #64748b; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}

.chat-input-area {
  border-top: 1px solid #2d2d3f; padding: 8px;
  background: #0f172a; flex-shrink: 0;
}

.chat-input {
  width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 6px;
  padding: 6px 8px; color: #e2e8f0; font-size: 12px;
  font-family: "Hanken Grotesk", sans-serif; resize: none;
}
.chat-input:focus { outline: none; border-color: #3373b3; }
.chat-input:disabled { opacity: 0.4; cursor: not-allowed; }

.chat-input-actions {
  display: flex; justify-content: flex-end; margin-top: 4px;
}

.chat-send-btn {
  padding: 4px 14px; border-radius: 5px; border: none;
  background: #3373b3; color: #fff; font-size: 11px; font-weight: 600;
  cursor: pointer;
}
.chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.chat-send-btn:not(:disabled):hover { background: #4a8ad4; }

/* Inline question choices */
.chat-choices {
  display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px;
}
.chat-choice-btn {
  padding: 3px 10px; background: #334155; color: #e2e8f0;
  border: none; border-radius: 4px; cursor: pointer; font-size: 11px;
}
.chat-choice-btn:hover { background: #3373b3; color: #fff; }

/* Inline question reply */
.chat-inline-reply {
  display: flex; gap: 4px; margin-top: 6px;
}
.chat-inline-reply input {
  flex: 1; background: #0f172a; border: 1px solid #334155; border-radius: 4px;
  padding: 3px 6px; color: #e2e8f0; font-size: 11px;
}
.chat-inline-reply input:focus { outline: none; border-color: #3373b3; }
.chat-inline-reply button {
  padding: 3px 10px; background: #3373b3; color: #fff;
  border: none; border-radius: 4px; font-size: 11px; cursor: pointer;
}

/* Empty state */
.chat-empty {
  flex: 1; display: flex; align-items: center; justify-content: center;
  color: #4a4a6a; font-size: 11px; text-align: center; padding: 20px;
}
```

- [ ] **Step 2: Remove popover and history overlay styles**

In `css/ai-collab.css`, remove these style blocks:
- `.ai-popover` and all `.ai-popover-*` rules (lines 146-206)
- `.ai-history-overlay` and all `.ai-history-*` rules (lines 224-258)

Keep: `.agent-section`, `.agent-item`, `.spark-btn`, `.ai-spinner`, `.ai-edit-flash`, agent modal styles.

- [ ] **Step 3: Commit**

```bash
git add css/ai-collab.css
git commit -m "feat: add chat sidebar CSS, remove popover styles"
```

---

### Task 3: Create `chat-sidebar.js` module

**Files:**
- Create: `js/chat-sidebar.js`

This is the core new module. It renders messages, handles input, manages context attachment, and agent tabs.

- [ ] **Step 1: Create `js/chat-sidebar.js`**

```javascript
// chat-sidebar.js — Chat sidebar UI for AI agent conversations

import { cm } from './editor.js';

// ── DOM refs ────────────────────────────────────────────────────────────────

const sidebar = document.getElementById("chatSidebar");
const header = document.getElementById("chatHeader");
const agentTabs = document.getElementById("chatAgentTabs");
const messagesEl = document.getElementById("chatMessages");
const inputArea = document.getElementById("chatInputArea");
const input = document.getElementById("chatInput");
const sendBtn = document.getElementById("chatSendBtn");
const contextPill = document.getElementById("chatContextPill");

// ── State ───────────────────────────────────────────────────────────────────

let activeAgentKey = null;
let agents = [];           // [{ key, name }]
let pendingContext = null;  // { text, lineStart, lineEnd, label } or null

// ── Callbacks (set by app.js) ───────────────────────────────────────────────

let _onSend = null;        // (agentKey, prompt, selection) => void
let _onAnswer = null;      // (agentKey, questionId, value) => void
let _getConversation = null; // (agentKey) => [{type, ...}]
let _getSection = null;    // () => { text, lineStart, lineEnd, title } | null

export function onSend(fn) { _onSend = fn; }
export function onAnswer(fn) { _onAnswer = fn; }
export function setGetConversation(fn) { _getConversation = fn; }
export function setGetSection(fn) { _getSection = fn; }

// ── Show / hide ─────────────────────────────────────────────────────────────

export function show() {
  if (sidebar) sidebar.classList.add("open");
}

export function hide() {
  if (sidebar) sidebar.classList.remove("open");
}

export function isVisible() {
  return sidebar?.classList.contains("open") || false;
}

// ── Agent management ────────────────────────────────────────────────────────

export function setAgents(agentList) {
  agents = agentList;
  if (agents.length > 0 && !activeAgentKey) {
    activeAgentKey = agents[0].key;
  }
  // If active agent disconnected, switch to first available
  if (activeAgentKey && !agents.find(a => a.key === activeAgentKey)) {
    activeAgentKey = agents.length > 0 ? agents[0].key : null;
  }
  renderTabs();
  updateInputState();
  renderMessages();
}

export function getActiveAgentKey() { return activeAgentKey; }

// ── Focus chat with context ─────────────────────────────────────────────────

export function focusWithContext(context) {
  if (!input) return;
  pendingContext = context;
  renderContextPill();
  input.focus();
}

export function focusForAgent(agentKey) {
  if (agents.find(a => a.key === agentKey)) {
    activeAgentKey = agentKey;
    renderTabs();
    renderMessages();
  }
  updateInputState();
  if (input) input.focus();
}

// ── Refresh messages (called when conversation updates) ─────────────────────

export function refresh() {
  renderMessages();
}

// ── Tab rendering ───────────────────────────────────────────────────────────

function renderTabs() {
  if (!agentTabs) return;
  agentTabs.innerHTML = "";

  if (agents.length <= 1 && agents.length > 0) {
    // Single agent — just show name, no tabs
    const el = document.createElement("div");
    el.className = "chat-agent-tab active";
    el.innerHTML = `<span class="chat-agent-dot"></span>${escapeHtml(agents[0].name)}`;
    agentTabs.appendChild(el);
    return;
  }

  for (const agent of agents) {
    const el = document.createElement("div");
    el.className = "chat-agent-tab" + (agent.key === activeAgentKey ? " active" : "");
    el.innerHTML = `<span class="chat-agent-dot"></span>${escapeHtml(agent.name)}`;
    el.onclick = () => {
      activeAgentKey = agent.key;
      renderTabs();
      renderMessages();
    };
    agentTabs.appendChild(el);
  }
}

// ── Message rendering ───────────────────────────────────────────────────────

function renderMessages() {
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
      msg.innerHTML = `<div class="chat-msg-label">You</div>${escapeHtml(entry.prompt)}`;
      messagesEl.appendChild(msg);

      // Show context pill if selection was attached
      if (entry.selection?.text) {
        const pill = document.createElement("div");
        pill.className = "chat-context-pill";
        const preview = entry.selection.text.length > 80
          ? entry.selection.text.substring(0, 80) + "..."
          : entry.selection.text;
        pill.textContent = `📎 Lines ${entry.selection.lineStart + 1}-${entry.selection.lineEnd + 1}: "${preview}"`;
        messagesEl.appendChild(pill);
      }
    } else if (entry.type === "message") {
      const msg = document.createElement("div");
      msg.className = "chat-msg agent";
      msg.innerHTML = `<div class="chat-msg-label">${escapeHtml(agentName)}</div>${escapeHtml(entry.text)}`;
      messagesEl.appendChild(msg);
    } else if (entry.type === "question") {
      const msg = document.createElement("div");
      msg.className = "chat-msg agent";
      msg.innerHTML = `<div class="chat-msg-label">${escapeHtml(agentName)}</div>${escapeHtml(entry.text)}`;

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
              if (_onAnswer) _onAnswer(activeAgentKey, entry.id, choice);
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
            if (_onAnswer) _onAnswer(activeAgentKey, entry.id, val);
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
      msg.innerHTML = `<div class="chat-msg-label">You</div>${escapeHtml(entry.value)}`;
      messagesEl.appendChild(msg);
    } else if (entry.type === "status") {
      const msg = document.createElement("div");
      msg.className = "chat-msg status";
      msg.innerHTML = `<div class="ai-spinner"></div>${escapeHtml(entry.text)}`;
      messagesEl.appendChild(msg);
    } else if (entry.type === "edit" || entry.type === "patch") {
      const msg = document.createElement("div");
      msg.className = "chat-msg edit-note";
      msg.textContent = entry.type === "edit"
        ? `Proposed edit (lines ${entry.lineStart + 1}-${entry.lineEnd + 1})`
        : "Proposed a patch";
      messagesEl.appendChild(msg);
    } else if (entry.type === "edit_result") {
      const msg = document.createElement("div");
      msg.className = "chat-msg edit-note";
      msg.textContent = entry.accepted ? "✓ Edit accepted" : "✗ Edit rejected";
      messagesEl.appendChild(msg);
    }
  }

  // Auto-scroll to bottom
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Context pill ────────────────────────────────────────────────────────────

function renderContextPill() {
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
    ? `📎 ${pendingContext.label}`
    : `📎 Lines ${pendingContext.lineStart + 1}-${pendingContext.lineEnd + 1}: "${preview}"`;
}

// ── Compute context from cursor position ────────────────────────────────────

function getAutoContext() {
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
      label: null,
    };
  }

  // No selection — get H1 section
  if (_getSection) return _getSection();
  return null;
}

// ── Input state ─────────────────────────────────────────────────────────────

function updateInputState() {
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

function doSend() {
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

// ── Utility ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
```

- [ ] **Step 2: Commit**

```bash
git add js/chat-sidebar.js
git commit -m "feat: add chat-sidebar.js module"
```

---

### Task 4: Refactor `ai-collab.js` — remove popovers, add chat hooks

**Files:**
- Modify: `js/ai-collab.js`

Remove all popover UI code. Add callback hooks for chat-sidebar to listen to conversation updates. Keep: agent state, protocol handling, `sendRequest`, `sendAnswer`, diff modal, patch parsing.

- [ ] **Step 1: Remove popover functions and state**

Remove these functions and their associated state from `ai-collab.js`:
- `activePopover` variable and `removeActivePopover()`
- `showSparkPrompt()`
- `showAgentPicker()`
- `showWaitingPopover()`
- `updateWaitingStatus()` — replace with pushing status to conversation
- `showAgentPopover()` — replace with calling conversation update callback
- `showQuestionPopover()` — replace with calling conversation update callback
- `showConversationHistory()`
- `createPopover()`, `clampPopover()`
- `setupSparkButton()`, `updateSparkVisibility()`, `hideSparkButton()`, `getSelectionInfo()`, `sparkBtn`, `sparkVisible`

- [ ] **Step 2: Add conversation update callback**

Add a callback system so chat-sidebar can react to new messages:

```javascript
let _onConversationUpdate = null;

export function onConversationUpdate(fn) { _onConversationUpdate = fn; }

function notifyConversationUpdate(key) {
  if (_onConversationUpdate) _onConversationUpdate(key);
}
```

- [ ] **Step 3: Update `handleAgentMessage` to push status into conversation and notify**

Replace the status handler:

```javascript
} else if (msg.type === "status") {
  // Remove previous status entry for this request
  const conv = conversations.get(key) || [];
  const idx = conv.findLastIndex(e => e.type === "status" && e.requestId === msg.requestId);
  if (idx >= 0) conv.splice(idx, 1);
  conv.push({ type: "status", text: msg.text, requestId: msg.requestId });
  conversations.set(key, conv);
  notifyConversationUpdate(key);
}
```

For message and question types, add `notifyConversationUpdate(key)` after pushing to conversation.

- [ ] **Step 4: Add edit result tracking to conversation**

In `applyEdit` and `applyPatch`, after the diff modal resolves, push an `edit_result` entry:

```javascript
conv.push({ type: "edit_result", accepted: action === "accept" });
conversations.set(key, conv);
notifyConversationUpdate(key);
```

- [ ] **Step 5: Export `getConversation`**

```javascript
export function getConversation(key) {
  return conversations.get(key) || [];
}
```

- [ ] **Step 6: Remove `setupSparkButton()` call from `init()`**

In the `init()` function, remove the line `setupSparkButton();`.

- [ ] **Step 7: Update `renderAgentList` — clicking agent name focuses chat**

Replace the `el.querySelector(".agent-name").onclick` handler to call a new callback instead of `showConversationHistory`:

```javascript
let _onAgentClick = null;
export function onAgentClick(fn) { _onAgentClick = fn; }

// In renderAgentList:
el.querySelector(".agent-name").onclick = () => {
  if (_onAgentClick) _onAgentClick(key);
};
```

- [ ] **Step 8: Commit**

```bash
git add js/ai-collab.js
git commit -m "refactor: remove popovers from ai-collab, add conversation hooks"
```

---

### Task 5: Wire everything in `app.js`

**Files:**
- Modify: `js/app.js`

Connect chat-sidebar to ai-collab. Rewire spark button. Handle show/hide.

- [ ] **Step 1: Add imports**

Add to app.js imports:

```javascript
import {
  show as showChat, hide as hideChat, setAgents as setChatAgents,
  focusWithContext, focusForAgent, refresh as refreshChat,
  onSend as onChatSend, onAnswer as onChatAnswer,
  setGetConversation, setGetSection,
} from './chat-sidebar.js';
```

Update ai-collab imports to include new exports:

```javascript
import {
  init as initAiCollab, addAgent,
  getConnectedAgents, sendRequest, sendAnswer,
  onConversationUpdate, getConversation, onAgentClick,
} from './ai-collab.js';
```

- [ ] **Step 2: Wire chat-sidebar callbacks**

After the `initAiCollab` call in the startup block, add:

```javascript
// Wire chat sidebar
setGetConversation((key) => getConversation(key));

onChatSend((agentKey, prompt, context) => {
  const selection = context || { text: "", lineStart: 0, lineEnd: 0 };
  sendRequest(agentKey, prompt, selection);
});

onChatAnswer((agentKey, questionId, value) => {
  sendAnswer(agentKey, questionId, value);
});

onConversationUpdate((key) => {
  refreshChat();
});

onAgentClick((key) => {
  showChat();
  focusForAgent(key);
});

// Provide H1 section getter for auto-context
setGetSection(() => {
  if (!cm.getValue()) return null;
  const cursorLine = cm.getCursor().line;
  // Find H1 section boundaries
  let sectionStart = 0;
  let sectionEnd = cm.lineCount() - 1;
  let sectionTitle = "";
  for (let i = cursorLine; i >= 0; i--) {
    const m = cm.getLine(i)?.match(/^# (.+)/);
    if (m) {
      sectionStart = i;
      sectionTitle = m[1].trim();
      break;
    }
  }
  for (let i = sectionStart + 1; i < cm.lineCount(); i++) {
    if (/^# /.test(cm.getLine(i))) {
      sectionEnd = i - 1;
      break;
    }
  }
  const lines = [];
  for (let i = sectionStart; i <= sectionEnd; i++) lines.push(cm.getLine(i));
  return {
    text: lines.join("\n"),
    lineStart: sectionStart,
    lineEnd: sectionEnd,
    label: `Section: "${sectionTitle}"`,
  };
});
```

- [ ] **Step 3: Auto-show/hide chat on agent connect/disconnect**

Add a helper that updates chat visibility whenever agents change. Call it from the existing `agent-connected` and `agent-disconnected` handlers. Since those are in `ai-collab.js` via `init()`, we can hook into agent list changes by calling `setChatAgents` whenever agents change.

Add an `onAgentsChanged` callback to `ai-collab.js`:

In `ai-collab.js`, add:
```javascript
let _onAgentsChanged = null;
export function onAgentsChanged(fn) { _onAgentsChanged = fn; }
```

In the `agent-connected` handler, after `renderAgentList()`:
```javascript
if (_onAgentsChanged) _onAgentsChanged(getConnectedAgents());
```

In the `agent-disconnected` handler, after `renderAgentList()`:
```javascript
if (_onAgentsChanged) _onAgentsChanged(getConnectedAgents());
```

In `app.js`, wire it:
```javascript
import { onAgentsChanged } from './ai-collab.js';

onAgentsChanged((connectedAgents) => {
  setChatAgents(connectedAgents);
  if (connectedAgents.length > 0) showChat();
  else hideChat();
});
```

- [ ] **Step 4: Rewire spark button**

Replace the spark button behavior. Instead of `setupSparkButton()` in ai-collab.js (now removed), set up the spark button in app.js:

```javascript
const sparkBtn = document.getElementById("sparkBtn");
if (sparkBtn) {
  cm.on("cursorActivity", () => {
    const sel = cm.getSelection();
    const connected = getConnectedAgents();
    if (!sel || connected.length === 0) {
      sparkBtn.classList.remove("visible");
      return;
    }
    const cursor = cm.getCursor("to");
    const coords = cm.cursorCoords(cursor, "page");
    sparkBtn.style.top = (coords.bottom + 4) + "px";
    sparkBtn.style.left = coords.left + "px";
    sparkBtn.classList.add("visible");
  });
  document.addEventListener("mouseup", () => {
    setTimeout(() => {
      const sel = cm.getSelection();
      const connected = getConnectedAgents();
      if (!sel || connected.length === 0) sparkBtn.classList.remove("visible");
    }, 10);
  });

  sparkBtn.onclick = () => {
    sparkBtn.classList.remove("visible");
    const from = cm.getCursor("from");
    const to = cm.getCursor("to");
    const text = cm.getSelection();
    if (!text) return;
    const context = { text, lineStart: from.line, lineEnd: to.line };

    const connected = getConnectedAgents();
    if (connected.length === 1) {
      focusForAgent(connected[0].key);
      focusWithContext(context);
    } else if (connected.length > 1) {
      // Activate chat for first agent, let user switch tabs
      showChat();
      focusWithContext(context);
    }
  };
}
```

- [ ] **Step 5: Commit**

```bash
git add js/app.js js/ai-collab.js
git commit -m "feat: wire chat sidebar to ai-collab and spark button"
```

---

### Task 6: Clean up — remove dead code

**Files:**
- Modify: `js/ai-collab.js`
- Modify: `css/ai-collab.css`

- [ ] **Step 1: Verify all popover code is removed from ai-collab.js**

Search for any remaining references to `popover`, `activePopover`, `sparkBtn`, `sparkVisible`, `clampPopover`, `createPopover`, `showConversationHistory`. Remove any found.

- [ ] **Step 2: Verify all popover CSS is removed from ai-collab.css**

Search for `.ai-popover`, `.ai-history-overlay`, `.ai-history-panel`. Remove any found.

- [ ] **Step 3: Commit**

```bash
git add js/ai-collab.js css/ai-collab.css
git commit -m "chore: clean up remaining popover dead code"
```

---

### Task 7: Manual smoke test

- [ ] **Step 1: Test chat sidebar appearance**

1. Launch app, no agent → chat sidebar hidden
2. Click "+" to add agent, connect → chat sidebar appears with agent name
3. Disconnect agent → chat sidebar hides

- [ ] **Step 2: Test messaging**

1. Connect agent, type message in chat, Cmd+Enter → message appears in chat, agent receives it
2. Agent responds → response appears in chat
3. Agent sends question → inline choices or reply input appear

- [ ] **Step 3: Test context**

1. Select text, click spark button → chat focused with context pill showing selection
2. No selection, cursor in H1 section → send message → context is full H1 section
3. No file open → chat input disabled

- [ ] **Step 4: Test diff modal**

1. Agent sends edit → diff modal opens (not inline in chat)
2. Accept → "Edit accepted" note in chat
3. Reject → "Edit rejected" note in chat

- [ ] **Step 5: Test multi-agent**

1. Connect two agents → tabs appear in chat header
2. Click tabs → switches conversation
3. Click agent name in left sidebar → switches to that agent's chat tab

- [ ] **Step 6: Commit fixes**

```bash
git add -A
git commit -m "fix: smoke test fixes for chat sidebar"
```
