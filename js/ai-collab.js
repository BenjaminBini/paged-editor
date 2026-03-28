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

1. Open a WebSocket connection to: \`ws://${wsHost}:${wsPort}\`
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

**Status** — update the user on your progress (shown in the waiting popover):
\`\`\`json
{"type": "status", "requestId": "<request-id>", "text": "Searching DCE documents..."}
\`\`\`
- Send a status update as soon as you receive a request (\`"Received, processing..."\`) so the user knows you're working on it.
- Send additional status updates for each major step (e.g., \`"Analyzing context..."\`, \`"Searching documentation..."\`, \`"Writing edit..."\`).

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

## Reactive Connection Setup

After authenticating, you MUST immediately set up a **background file watcher** so you react to requests in real time without the user having to prompt you.

1. Write a Node.js bridge script that:
   - Connects to the WebSocket at \`ws://${wsHost}:${wsPort}\`
   - Authenticates with the provided key
   - Writes all incoming messages to \`/tmp/ws_editor_inbox.jsonl\` (append mode)
   - Polls \`/tmp/ws_editor_outbox.jsonl\` every 500ms and sends any lines over the WebSocket
2. Run the bridge in the background using Bash with \`run_in_background\`.
3. **Immediately** start a background file watcher (using \`tail -n 0 -f /tmp/ws_editor_inbox.jsonl\`) that exits when a new \`"type":"request"\` line appears. Use Bash with \`run_in_background\` so you are **automatically notified** when a request arrives.
4. When notified, read the request, process it, send your response(s) by writing to \`/tmp/ws_editor_outbox.jsonl\`, then **restart the watcher** for the next request.

This ensures you respond to editor requests as soon as they arrive, without the user needing to tell you a request is pending.

## Guidelines

- **Always send a status update immediately** when you start processing a request, before doing any work. This is critical for the user experience — it confirms reception.
- Keep edits minimal and precise — change only what's needed.
- Always verify \`oldText\` matches the exact content from the \`file.content\` at the specified lines before sending an edit.
- You can send multiple responses to a single request (e.g., status + edit + message explaining it).
- Stay connected — you'll receive new requests as the user selects text and asks for help.
- After processing each request, always restart the background watcher for the next one.
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
  document.body.appendChild(popover);

  // Measure popover size after adding to DOM
  const rect = popover.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pw = rect.width || 320;
  const ph = rect.height || 200;

  // Clamp to viewport
  let top = coords.bottom + 4;
  let left = coords.left;

  if (top + ph > vh - 8) top = Math.max(8, coords.top - ph - 4);
  if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8);

  popover.style.top = top + "px";
  popover.style.left = left + "px";
  popover.remove();
  return popover;
}

// ── Utility ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
