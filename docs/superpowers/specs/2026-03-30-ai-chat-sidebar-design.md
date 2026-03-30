# AI Chat Sidebar

## Overview

Replace floating popovers and prompt popups with a persistent chat sidebar on the right side of the app. Each connected agent gets its own chat tab. The sidebar auto-shows when an agent connects and auto-hides when the last agent disconnects. The spark button now focuses the chat input with the current selection as context instead of opening a floating prompt.

## Layout

```
┌──────────────────────────────────────────────────────┐
│ Toolbar                                              │
├────────┬───────────┬───────────┬─────────────────────┤
│ File   │ Editor    │ Preview   │ Chat Sidebar        │
│ Sidebar│ (tabs)    │ (paged.js)│ (per-agent tabs)    │
│        │           │           │                     │
│        │           │           │ [messages]           │
│        │           │           │                     │
│        │           │           │ [input + send]       │
├────────┴───────────┴───────────┴─────────────────────┤
```

- **Position**: rightmost panel, after preview
- **Width**: ~250px, fixed (not resizable)
- **Background**: `#171726` (matches file sidebar)

## Chat Sidebar Structure

### Header — agent tabs

When multiple agents are connected, tabs appear at the top (one per agent). Each tab shows:
- Green dot (connected indicator)
- Agent name
- Click to switch chat

Single agent: no tab bar needed, just show agent name + dot in the header.

### Message area — scrollable

Messages rendered top-to-bottom, auto-scroll to latest. Message types:

**User message** (right-aligned or dark bg `#0f172a`):
- User's prompt text
- Optional context pill below: `📎 Selection: lines 5-6 "The project will be..."` or `📎 Section: "Planning"` (dashed border, muted color)

**Agent message** (left-aligned or slightly lighter bg `#1a2744`):
- Agent name label (small, muted)
- Message text (pre-wrap)

**Agent question** (same as agent message, plus):
- If choices provided: inline choice buttons
- If free-text: inline reply input + send button

**Status** ("Thinking..."):
- Inline spinner + status text, replaces previous status for same request
- Not a permanent message — disappears when agent responds

**Edit/patch notification**:
- Brief inline note: "Claude proposed an edit (lines 5-12)"
- Diff review stays as a modal overlay (not in chat)
- After accept/reject, a status line appears: "Edit accepted" / "Edit rejected"

### Input area — bottom

- Textarea with placeholder text
- Send button (or Cmd+Enter)
- Context indicator above input when context is attached: shows what will be sent as context
- Disabled state when no file open or no agent connected (greyed out, placeholder says "No agent connected" or "Open a file to start")

## Context Attachment

### With text selected
When user has text selected in the editor:
- The context pill shows the selection text (truncated) and line range
- Sent as `selection` in the request message (existing protocol)

### Without text selected
When no selection, derive context from cursor position:
- Find the H1 heading the cursor is within (everything from that `#` to the next `#` or end of file)
- The context pill shows the section title (e.g. `📎 Section: "Planning"`)
- Sent as `selection` with the full H1 section text and its line range

### No file open
- Chat input disabled
- Placeholder: "Open a file to start"

## Spark Button Changes

The spark button (`✦ AI`) still appears near text selections, but instead of opening a floating prompt popover:
1. Click → focuses the chat input
2. Attaches the current selection as context
3. User types their prompt in the chat input and sends

If multiple agents: spark button shows a small picker (inline dropdown) to choose which agent tab to activate, then focuses chat input.

## Floating Popovers — Removal

All floating popovers are removed:
- `showSparkPrompt` → replaced by focusing chat input with context
- `showWaitingPopover` → replaced by inline "Thinking..." in chat
- `showAgentPopover` → replaced by agent message in chat
- `showQuestionPopover` → replaced by inline question in chat
- `showAgentPicker` → replaced by small dropdown near spark button or always uses active chat tab
- `showConversationHistory` overlay → no longer needed, chat IS the conversation

The `createPopover`, `clampPopover`, `removeActivePopover` helpers are removed.

## Agent Section in Left Sidebar

The agent section (list + "+" button) in the left sidebar stays — it's the place to add/manage agents. Clicking an agent name in the left sidebar switches to that agent's chat tab in the right sidebar.

## Module Changes

### `js/ai-collab.js` refactor
- Remove all popover code (`createPopover`, `clampPopover`, `showSparkPrompt`, `showWaitingPopover`, `showAgentPopover`, `showQuestionPopover`, `showConversationHistory`)
- Remove `activePopover` state
- Keep: agent state, message handling, `sendRequest`, `sendAnswer`, diff modal, patch parsing
- Add: exports for chat sidebar to call (`getConversation`, `onConversationUpdate` callback)

### New: `js/chat-sidebar.js`
- Owns the chat sidebar DOM
- Renders messages from conversation state
- Handles input, context attachment, send
- Manages agent tabs
- Auto-show/hide on agent connect/disconnect
- Exports: `showChatSidebar()`, `hideChatSidebar()`, `focusChatInput(context)`

### `css/ai-collab.css` changes
- Remove all `.ai-popover-*` styles
- Remove `.ai-history-*` styles
- Add `.chat-sidebar`, `.chat-message`, `.chat-input`, `.chat-context-pill` styles
- Keep: `.agent-section`, `.agent-item`, spark button, diff modal, edit flash styles

### `index.html` changes
- Add `<div class="chat-sidebar" id="chatSidebar">` after the preview pane, inside `.container`
- Remove spark button HTML (will be created dynamically or kept but rewired)

## Disabled State

When chat is disabled (no file open or no agent):
- Input area greyed out
- Send button disabled
- Placeholder text explains why
- Messages area shows a subtle empty state

## CSS Variables

Use existing color scheme:
- Sidebar bg: `#171726`
- Header bg: `#1e1e2e`
- User message bg: `#0f172a`
- Agent message bg: `#1a2744`
- Input bg: `#0f172a`
- Border: `#2d2d3f`
- Text: `#cdd6f4`
- Muted: `#64748b`
