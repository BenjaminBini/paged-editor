# AI Agent Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow external AI agents to connect via WebSocket and collaboratively edit markdown with the user through an inline popover UI.

**Architecture:** WebSocket server in Electron main process (`ws` library), IPC bridge to renderer, new `ai-collab.js` module handling agent state + all UI (sidebar agents list, spark button on selection, inline popovers for messages/questions/edits).

**Tech Stack:** Electron IPC, `ws` (Node WebSocket library), CodeMirror 5 API, vanilla JS/CSS

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` | Modify | Add `ws` dependency |
| `main.js` | Modify | WebSocket server, IPC for port/keys |
| `preload.js` | Modify | Expose WS port + key management to renderer |
| `js/ai-collab.js` | Create | All renderer logic: agent state, protocol, UI |
| `js/app.js` | Modify | Import ai-collab, wire to editor |
| `index.html` | Modify | Add agent sidebar section, modal markup, CSS link |
| `css/ai-collab.css` | Create | All AI collab styles |

---

### Task 1: Install `ws` and set up WebSocket server in main process

**Files:**
- Modify: `package.json`
- Modify: `main.js:1-10` (requires), `main.js:200-215` (lifecycle)

- [ ] **Step 1: Install ws**

Run: `cd /Users/benjaminbini/dev/projects/paged-editor && npm install ws`

- [ ] **Step 2: Add WebSocket server to main.js**

Add requires at top of `main.js`:

```javascript
const { WebSocketServer } = require("ws");
const crypto = require("crypto");
```

Add agent key state after `appState` declaration (after line 7):

```javascript
// ── Agent keys & WebSocket ──────────────────────────────────────────────────
const agentKeys = new Map(); // key -> { used: false }
let wss = null;
let wsPort = 0;
const agentConnections = new Map(); // key -> { ws, name }
```

- [ ] **Step 3: Add WebSocket server startup in lifecycle**

Replace the `app.whenReady` block (lines 202-210) with:

```javascript
app.whenReady().then(async () => {
  await loadAppState();
  createWindow();
  buildMenu();

  // Start WebSocket server on random available port
  wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  wsPort = wss.address().port;
  console.log("AI collab WebSocket server on port", wsPort);

  wss.on("connection", (ws) => {
    let authenticatedKey = null;

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (!authenticatedKey) {
        // Must authenticate first
        if (msg.type === "auth" && msg.key && agentKeys.has(msg.key) && !agentKeys.get(msg.key).used) {
          authenticatedKey = msg.key;
          agentKeys.get(msg.key).used = true;
          const name = msg.name || "Agent";
          agentConnections.set(msg.key, { ws, name });
          ws.send(JSON.stringify({ type: "auth_ok" }));
          mainWindow?.webContents.send("agent-connected", { key: msg.key, name });
        } else {
          ws.send(JSON.stringify({ type: "auth_error", message: "Invalid or already used key" }));
          ws.close();
        }
        return;
      }

      // Authenticated — forward to renderer
      mainWindow?.webContents.send("agent-message", { key: authenticatedKey, message: msg });
    });

    ws.on("close", () => {
      if (authenticatedKey) {
        agentConnections.delete(authenticatedKey);
        mainWindow?.webContents.send("agent-disconnected", { key: authenticatedKey });
      }
    });
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
```

- [ ] **Step 4: Add IPC handlers for agent key management**

Add after the existing IPC handlers block (after line 96):

```javascript
ipcMain.handle("get-ws-port", () => wsPort);

ipcMain.handle("generate-agent-key", () => {
  const key = crypto.randomUUID();
  agentKeys.set(key, { used: false });
  return key;
});

ipcMain.handle("revoke-agent-key", (_e, key) => {
  agentKeys.delete(key);
  const conn = agentConnections.get(key);
  if (conn) {
    conn.ws.close();
    agentConnections.delete(key);
  }
});

ipcMain.handle("send-to-agent", (_e, key, message) => {
  const conn = agentConnections.get(key);
  if (conn && conn.ws.readyState === 1) {
    conn.ws.send(JSON.stringify(message));
    return true;
  }
  return false;
});
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json main.js
git commit -m "feat: add WebSocket server for AI agent collaboration"
```

---

### Task 2: Expose WebSocket APIs in preload

**Files:**
- Modify: `preload.js:3-25`

- [ ] **Step 1: Add agent APIs to preload.js**

Add these entries inside the `contextBridge.exposeInMainWorld("electronAPI", { ... })` object, after the existing entries:

```javascript
  // AI agent collaboration
  getWsPort: () => ipcRenderer.invoke("get-ws-port"),
  generateAgentKey: () => ipcRenderer.invoke("generate-agent-key"),
  revokeAgentKey: (key) => ipcRenderer.invoke("revoke-agent-key", key),
  sendToAgent: (key, message) => ipcRenderer.invoke("send-to-agent", key, message),
```

Add these channels to the `validChannels` array in the `on` method:

```javascript
"agent-connected", "agent-disconnected", "agent-message",
```

- [ ] **Step 2: Commit**

```bash
git add preload.js
git commit -m "feat: expose AI agent IPC APIs in preload"
```

---

### Task 3: Create the ai-collab.js module — agent state & protocol

**Files:**
- Create: `js/ai-collab.js`

- [ ] **Step 1: Create js/ai-collab.js with agent state management and protocol handling**

```javascript
// ai-collab.js — AI agent collaboration module

const api = window.electronAPI;

// ── State ───────────────────────────────────────────────────────────────────

const agents = new Map();       // key -> { name, connected: true }
const pendingKeys = new Map();  // key -> { created: Date }
const conversations = new Map(); // key -> [{ type, ...data }]
let wsPort = 0;

// ── External dependencies (set by app.js) ───────────────────────────────────

let _cm = null;
let _getFilePath = null;

export function init(cm, getFilePath) {
  _cm = cm;
  _getFilePath = getFilePath;
  api.getWsPort().then(port => { wsPort = port; });

  // Listen for agent events from main process
  api.on("agent-connected", ({ key, name }) => {
    agents.set(key, { name, connected: true });
    pendingKeys.delete(key);
    conversations.set(key, conversations.get(key) || []);
    renderAgentList();
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
    // Reject — tell agent
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

  // Apply the edit
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

  // Confirm to agent
  api.sendToAgent(key, { type: "edit_ok", requestId: msg.requestId });
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

// ── Prompt template ─────────────────────────────────────────────────────────

function buildAgentPrompt(key) {
  return `# AI Agent Collaboration — Paged Editor

You are connecting to a Markdown editor as a collaborative AI agent.

## Connection

1. Open a WebSocket connection to: \`ws://localhost:${wsPort}\`
2. Send an authentication message:
\`\`\`json
{"type": "auth", "key": "${key}", "name": "YOUR_NAME_HERE"}
\`\`\`
3. Wait for \`{"type": "auth_ok"}\` before proceeding.

## Protocol

You will receive **request** messages from the user:
\`\`\`json
{
  "type": "request",
  "id": "<unique-id>",
  "prompt": "User's instruction",
  "selection": {
    "text": "selected text",
    "lineStart": 10, "lineEnd": 12,
    "chStart": 0, "chEnd": 15
  },
  "context": { "before": "lines before", "after": "lines after" },
  "file": { "path": "/path/to/file.md", "name": "file.md", "content": "full content" }
}
\`\`\`

### Responding

You can respond with one or more of these message types. Always include the \`requestId\` matching the request's \`id\`.

**Edit** — replace text in the editor:
\`\`\`json
{
  "type": "edit",
  "requestId": "<request-id>",
  "lineStart": 10, "lineEnd": 12,
  "oldText": "exact current text at those lines",
  "newText": "replacement text"
}
\`\`\`
- \`oldText\` MUST exactly match what is currently at \`lineStart\`–\`lineEnd\` (the full content of those lines). If it doesn't match, the edit is rejected.
- The editor will confirm with \`{"type": "edit_ok"}\` or \`{"type": "edit_error", "message": "..."}\`.

**Message** — display text to the user:
\`\`\`json
{"type": "message", "requestId": "<request-id>", "text": "Your message here"}
\`\`\`

**Question** — ask the user (optionally with choices):
\`\`\`json
{
  "type": "question",
  "requestId": "<request-id>",
  "id": "<unique-question-id>",
  "text": "Your question?",
  "choices": ["Option A", "Option B"]
}
\`\`\`
- \`choices\` is optional. If omitted, the user gets a free-text input.
- The user's response: \`{"type": "answer", "questionId": "<question-id>", "value": "..."}\`

## Guidelines

- Keep edits minimal and precise — change only what's needed.
- Always verify \`oldText\` matches the exact content from the \`file.content\` at the specified lines before sending an edit.
- You can send multiple responses to a single request (e.g., an edit + a message explaining it).
- Stay connected — you'll receive new requests as the user selects text and asks for help.
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

  if (connected.length === 0 && pending === 0) {
    agentSection.style.display = "none";
    return;
  }

  agentSection.style.display = "";
  agentList.innerHTML = "";

  for (const { key, name } of connected) {
    const el = document.createElement("div");
    el.className = "agent-item connected";
    el.innerHTML = `<span class="agent-dot"></span><span class="agent-name">${escapeHtml(name)}</span>`;
    el.onclick = () => showConversationHistory(key);
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

if (btnCloseAgentModal) btnCloseAgentModal.onclick = () => closeAgentModal();

function showAgentPromptModal(key) {
  if (!agentModal || !agentPromptText) return;
  agentPromptText.textContent = buildAgentPrompt(key);
  agentModal.classList.add("open");

  if (btnCopyPrompt) {
    btnCopyPrompt.onclick = () => {
      navigator.clipboard.writeText(agentPromptText.textContent);
      btnCopyPrompt.textContent = "Copied!";
      setTimeout(() => { btnCopyPrompt.textContent = "Copy Prompt"; }, 2000);
    };
  }
}

function closeAgentModal() {
  if (agentModal) agentModal.classList.remove("open");
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

  document.body.appendChild(popover);
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

  document.body.appendChild(popover);
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

  document.body.appendChild(popover);
  activePopover = popover;
}

// ── Agent response popovers ─────────────────────────────────────────────────

function showAgentPopover(key, msg) {
  const agent = agents.get(key);
  const agentName = agent ? agent.name : "Agent";

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
    document.body.appendChild(popover);
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
  document.body.appendChild(popover);
  activePopover = popover;
}

function showQuestionPopover(key, msg) {
  const agent = agents.get(key);
  const agentName = agent ? agent.name : "Agent";

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

  document.body.appendChild(popover);
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
  popover.style.top = (coords.bottom + 4) + "px";
  popover.style.left = coords.left + "px";
  return popover;
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
git add js/ai-collab.js
git commit -m "feat: add ai-collab.js module — agent state, protocol, and UI"
```

---

### Task 4: Add HTML markup for agent UI

**Files:**
- Modify: `index.html:19` (add CSS link)
- Modify: `index.html:135-145` (sidebar agent section)
- Modify: `index.html:78-90` (add agent modal after diff modal)

- [ ] **Step 1: Add CSS link in head**

After line 24 (`<link rel="stylesheet" href="css/modals.css" />`), add:

```html
  <link rel="stylesheet" href="css/ai-collab.css" />
```

- [ ] **Step 2: Add agent section in sidebar**

After the `outlineSection` div (after `</div>` on line 144), add inside `#fileSidebar`:

```html
      <div class="agent-section" id="agentSection" style="display:none;">
        <div class="agent-header">
          <span>Agents</span>
          <button id="btnAddAgent" title="Add an AI agent">+</button>
        </div>
        <div class="agent-list" id="agentList"></div>
      </div>
```

- [ ] **Step 3: Add "Add Agent" button in toolbar or always-visible location**

Add after the sidebar closing tag but also ensure we have a spark button. Before the closing `</body>` tag (before line 186), add:

```html
  <!-- AI collaboration elements -->
  <button class="spark-btn" id="sparkBtn" title="Ask AI agent">&#9733; AI</button>

  <div class="modal-overlay" id="agentModal">
    <div class="modal" style="width:600px;">
      <h3>Add an AI Agent</h3>
      <p style="font-size:12px;color:#94a3b8;margin-bottom:12px;">Copy this prompt and paste it into your AI agent (e.g. Claude Code). The agent will connect automatically.</p>
      <pre class="agent-prompt-text" id="agentPromptText"></pre>
      <div class="btn-row">
        <button class="btn-cancel" id="btnCloseAgentModal">Close</button>
        <button class="btn-save" id="btnCopyPrompt">Copy Prompt</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add HTML markup for AI agent sidebar, spark button, and modal"
```

---

### Task 5: Create ai-collab.css

**Files:**
- Create: `css/ai-collab.css`

- [ ] **Step 1: Create css/ai-collab.css**

```css
/* ── Agent sidebar section ─────────────────────────────────────────────────── */

.agent-section {
  border-top: 1px solid #2d2d3f;
  flex-shrink: 0;
}

.agent-header {
  height: 28px; background: #1e1e2e; color: #a0a0c0;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 10px; font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em;
  border-bottom: 1px solid #2d2d3f;
}

.agent-header button {
  background: none; border: none; color: #a0a0c0; cursor: pointer;
  font-size: 16px; line-height: 1; padding: 0 4px;
}
.agent-header button:hover { color: #cdd6f4; }

.agent-list { padding: 4px 0; }

.agent-item {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 10px; cursor: pointer; font-size: 12px; color: #8888aa;
  transition: all 0.1s;
}
.agent-item:hover { background: #1e1e2e; color: #cdd6f4; }

.agent-dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}
.agent-item.connected .agent-dot { background: #a6e3a1; }
.agent-item.pending .agent-dot { background: #f0a840; animation: pulse 1.5s infinite; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.agent-name {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ── Agent prompt modal ────────────────────────────────────────────────────── */

.agent-prompt-text {
  background: #0f172a; border: 1px solid #334155; border-radius: 8px;
  padding: 12px; color: #cdd6f4; font-size: 11px; line-height: 1.5;
  font-family: "JetBrains Mono", monospace;
  max-height: 400px; overflow-y: auto; white-space: pre-wrap; word-break: break-word;
}

/* ── Spark IA button ───────────────────────────────────────────────────────── */

.spark-btn {
  position: fixed; z-index: 500;
  display: none; padding: 4px 10px;
  background: #3373b3; color: #fff; border: none; border-radius: 6px;
  font-size: 11px; font-weight: 600; cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  transition: opacity 0.15s, transform 0.15s;
}
.spark-btn.visible { display: block; }
.spark-btn:hover { background: #4a8ad4; transform: translateY(-1px); }

/* ── Popovers ──────────────────────────────────────────────────────────────── */

.ai-popover {
  position: fixed; z-index: 600;
  background: #1e293b; border: 1px solid #334155; border-radius: 10px;
  padding: 12px 14px; min-width: 280px; max-width: 420px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  color: #e2e8f0; font-size: 12px;
}

.ai-popover-header {
  font-size: 11px; font-weight: 700; color: #94a3b8;
  text-transform: uppercase; letter-spacing: 0.05em;
  margin-bottom: 8px; padding-bottom: 6px;
  border-bottom: 1px solid #334155;
}

.ai-popover-input {
  width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 6px;
  padding: 8px 10px; color: #e2e8f0; font-size: 12px;
  font-family: "JetBrains Mono", monospace; resize: vertical;
  margin-bottom: 8px;
}
.ai-popover-input:focus { outline: none; border-color: #3373b3; }

.ai-popover-actions {
  display: flex; gap: 6px; justify-content: flex-end;
}

.ai-popover-cancel, .ai-popover-send, .ai-popover-choice {
  padding: 5px 14px; border-radius: 6px; border: none;
  font-size: 11px; font-weight: 600; cursor: pointer;
}
.ai-popover-cancel { background: #334155; color: #e2e8f0; }
.ai-popover-send { background: #3373b3; color: #fff; }

.ai-popover-choices {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;
}
.ai-popover-choice {
  background: #334155; color: #e2e8f0; transition: background 0.1s;
}
.ai-popover-choice:hover { background: #3373b3; color: #fff; }

.ai-popover-message {
  line-height: 1.5; margin-bottom: 8px; white-space: pre-wrap;
}

.ai-popover-waiting {
  display: flex; align-items: center; gap: 8px; color: #94a3b8;
  padding: 8px 0;
}

.ai-popover-agent-list {
  display: flex; flex-direction: column; gap: 4px;
}
.ai-popover-agent-pick {
  padding: 6px 12px; background: #334155; color: #e2e8f0;
  border: none; border-radius: 6px; cursor: pointer; font-size: 12px;
  text-align: left;
}
.ai-popover-agent-pick:hover { background: #3373b3; color: #fff; }

/* ── Spinner ───────────────────────────────────────────────────────────────── */

.ai-spinner {
  width: 14px; height: 14px; border: 2px solid #334155;
  border-top-color: #3373b3; border-radius: 50%;
  animation: ai-spin 0.6s linear infinite;
}
@keyframes ai-spin { to { transform: rotate(360deg); } }

/* ── Edit flash highlight ──────────────────────────────────────────────────── */

.ai-edit-flash {
  background: rgba(243, 196, 56, 0.15) !important;
  transition: background 1.5s ease-out;
}

/* ── Conversation history overlay ──────────────────────────────────────────── */

.ai-history-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  z-index: 1000; display: flex; align-items: center; justify-content: center;
}

.ai-history-panel {
  background: #1e293b; border-radius: 12px; width: 500px; max-height: 70vh;
  display: flex; flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

.ai-history-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid #334155;
  font-size: 13px; font-weight: 700; color: #fff;
}
.ai-history-close {
  background: none; border: none; color: #64748b; cursor: pointer;
  font-size: 18px; padding: 0 4px;
}
.ai-history-close:hover { color: #cdd6f4; }

.ai-history-body {
  flex: 1; overflow-y: auto; padding: 12px 16px;
}

.ai-history-entry {
  padding: 6px 10px; margin-bottom: 6px; border-radius: 6px;
  font-size: 12px; line-height: 1.5; white-space: pre-wrap;
}
.ai-history-entry.user { background: #0f172a; color: #cdd6f4; }
.ai-history-entry.agent { background: #1a2744; color: #e2e8f0; }
.ai-history-entry.edit { font-style: italic; color: #94a3b8; }
```

- [ ] **Step 2: Commit**

```bash
git add css/ai-collab.css
git commit -m "feat: add CSS styles for AI agent collaboration UI"
```

---

### Task 6: Wire ai-collab into app.js

**Files:**
- Modify: `js/app.js:1-20` (imports)
- Modify: `js/app.js:586-602` (startup)
- Modify: `js/app.js:294-313` (window globals)

- [ ] **Step 1: Add import in app.js**

Add after the existing imports (after line 19, `import './resize.js';`):

```javascript
import { init as initAiCollab, addAgent } from './ai-collab.js';
```

- [ ] **Step 2: Initialize ai-collab in startup**

In the `pagedReady.then(async () => {` block (around line 587), add after `buildRecentUI();` (line 596):

```javascript
  // Initialize AI agent collaboration
  initAiCollab(cm, () => standaloneFilePath || (activeFileIdx >= 0 && fileEntries[activeFileIdx]?.path) || null);
```

- [ ] **Step 3: Expose addAgent to window**

In the window globals section (around line 313), add:

```javascript
window.addAgent = addAgent;
```

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat: wire ai-collab module into app orchestrator"
```

---

### Task 7: Manual integration test

- [ ] **Step 1: Start the app**

Run: `cd /Users/benjaminbini/dev/projects/paged-editor && npm start`

Verify:
- App starts without errors in the console
- The sidebar shows the "Agents" section (hidden by default — correct)
- No JavaScript errors in DevTools

- [ ] **Step 2: Test the "Add Agent" flow**

Open DevTools console and run:
```javascript
window.addAgent()
```

Verify:
- A modal appears with a prompt containing `ws://localhost:<port>` and a unique key
- "Copy Prompt" button works
- The sidebar shows a pending agent with an orange pulsing dot

- [ ] **Step 3: Test WebSocket connection**

In a separate terminal, test with a simple Node script:

```javascript
const WebSocket = require("ws");
const ws = new WebSocket("ws://localhost:<PORT>");
ws.on("open", () => {
  ws.send(JSON.stringify({ type: "auth", key: "<KEY>", name: "Test Agent" }));
});
ws.on("message", (data) => console.log("Received:", data.toString()));
```

Verify:
- Agent appears in sidebar with green dot and name "Test Agent"
- Pending state disappears

- [ ] **Step 4: Test spark button and request flow**

1. Open a markdown file
2. Select some text
3. Verify the spark button appears
4. Click it, enter a prompt, send
5. From the test agent script, verify the request message is received with correct structure

- [ ] **Step 5: Test agent responses**

From the test agent script, send back:
```javascript
ws.send(JSON.stringify({ type: "message", requestId: "<id>", text: "Hello from agent!" }));
```

Verify the popover appears with the message.

- [ ] **Step 6: Commit if all passing**

```bash
git add -A
git commit -m "feat: AI agent collaboration — complete initial implementation"
```
