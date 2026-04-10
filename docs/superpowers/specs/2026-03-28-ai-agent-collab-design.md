# AI Agent Collaboration via WebSocket

## Overview

Add real-time AI agent collaboration to the paged-editor Electron app. A WebSocket server runs in the main process, allowing external AI agents (Claude Code, etc.) to connect, receive editing requests from the user, and respond with markdown edits, messages, or questions displayed inline.

## Architecture

Three layers:

1. **`main.js`** — WebSocket server (`ws` library) in Electron main process, auto-assigned port
2. **`preload.js`** — Exposes WebSocket port to renderer via IPC
3. **`js/ai-collab.js`** — New renderer module: agent connection management, UI (sidebar agents list, spark button, inline popovers)

## WebSocket Protocol

All messages are JSON. Each message has a `type` field.

### Authentication (agent connects)

```
Agent → Editor:  { "type": "auth", "key": "<unique-key>", "name": "Claude" }
Editor → Agent:  { "type": "auth_ok" }
```

- `key` is a unique token generated when the user clicks "Add Agent"
- `name` is chosen by the agent, displayed in the sidebar
- If the key is invalid: `{ "type": "auth_error", "message": "Invalid key" }`

### User request (spark IA)

```
Editor → Agent:  {
  "type": "request",
  "id": "<unique-request-id>",
  "prompt": "Make this more concise",
  "selection": {
    "text": "selected text here",
    "lineStart": 10,
    "lineEnd": 12,
    "chStart": 0,
    "chEnd": 15
  },
  "context": {
    "before": "3 lines before selection",
    "after": "3 lines after selection"
  },
  "file": {
    "path": "/path/to/file.md",
    "name": "file.md",
    "content": "full file content here"
  }
}
```

### Agent responses

**Edit** — replace text in the editor:
```
Agent → Editor:  {
  "type": "edit",
  "requestId": "<matches request id>",
  "lineStart": 10,
  "lineEnd": 12,
  "oldText": "original text",
  "newText": "replacement text"
}
```

The `oldText` field is used for safety: the editor verifies it matches before applying. If not, the edit is rejected with an error message back to the agent.

**Message** — display text to the user:
```
Agent → Editor:  {
  "type": "message",
  "requestId": "<matches request id>",
  "text": "Here's what I changed and why..."
}
```

**Question** — ask the user something:
```
Agent → Editor:  {
  "type": "question",
  "requestId": "<matches request id>",
  "id": "<unique-question-id>",
  "text": "Which tone do you prefer?",
  "choices": ["Formal", "Casual"]
}
```

`choices` is optional. If absent, the user gets a free-text input. If present, the user picks from the list.

**User answer:**
```
Editor → Agent:  {
  "type": "answer",
  "questionId": "<matches question id>",
  "value": "Formal"
}
```

### Agent-initiated messages

Agents can also send unsolicited messages (not tied to a request):
```
Agent → Editor:  { "type": "message", "text": "I noticed a typo on line 42" }
```

### Disconnection

When an agent disconnects (WebSocket close), the editor removes it from the sidebar. No explicit "disconnect" message needed.

## UI Components

### 1. Sidebar — Agents section

Below the file list and outline in `#fileSidebar`:

- Section header: "Agents" with an "+" button to add an agent
- List of connected agents: green dot + agent name
- Click on an agent name opens the conversation history popover for that agent
- Section hidden when no agents are connected and no keys are pending

### 2. "Add Agent" modal

Triggered by the "+" button. Contains:

- A generated unique key (crypto.randomUUID())
- A pre-formatted prompt to copy, containing:
  - The WebSocket port and address (`ws://localhost:<port>`)
  - The authentication key
  - The full protocol specification
  - Instructions: connect, authenticate with a chosen name, listen for requests, respond with edits/messages/questions
- A "Copy prompt" button
- The key is stored and valid until explicitly revoked or the app restarts

### 3. Spark IA button

- Appears as a floating button when text is selected in CodeMirror
- Positioned near the selection (above or below)
- On click:
  - If one agent connected: opens prompt input directly
  - If multiple agents: shows agent picker first, then prompt input
- Prompt input: small popover with a text field + "Send" button
- After sending: the popover shows a spinner until the agent responds

### 4. Response popovers

- Anchored to the line where the original selection was
- Shows agent messages, edits (with accept/reject), and questions
- For edits: shows a diff preview with "Accept" / "Reject" buttons
- For questions: shows the question text + choices (buttons) or free-text input
- Conversation history: accessible by clicking on agent name in sidebar, shows all exchanges in a scrollable popover

### 5. Edit highlighting

When an edit is accepted/applied:
- The changed lines get a brief yellow flash highlight (CSS animation, ~1s)
- The edit is applied to CodeMirror programmatically

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `ws` dependency |
| `main.js` | Modify | Add WebSocket server, IPC for port + agent key management |
| `preload.js` | Modify | Expose `getWsPort`, `generateAgentKey`, `getAgentPrompt` |
| `js/ai-collab.js` | Create | All renderer-side logic: agent state, UI, protocol handling |
| `js/app.js` | Modify | Import and wire ai-collab module |
| `index.html` | Modify | Add agent sidebar section, modal markup, CSS link |
| `css/ai-collab.css` | Create | Styles for all AI collab UI components |

## Security Considerations

- WebSocket listens on `localhost` only (127.0.0.1)
- Each agent must authenticate with a valid key before any other message is accepted
- Keys are single-use (one agent per key) and expire on app restart
- The `oldText` field in edits prevents stale/wrong replacements

## Generated Prompt Template

The prompt shown in the "Add Agent" modal should instruct the AI agent to:

1. Open a WebSocket connection to `ws://localhost:<port>`
2. Send an `auth` message with the provided key and a chosen display name
3. Wait for `auth_ok`
4. Listen for `request` messages and respond with `edit`, `message`, or `question`
5. Include the full JSON protocol spec for reference
6. Emphasize: always include `requestId` in responses, verify `oldText` matches before proposing edits, keep edits minimal and precise
