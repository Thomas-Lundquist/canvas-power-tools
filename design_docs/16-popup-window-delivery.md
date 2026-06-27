# Canvas Power Tools — 16: Popup Window Delivery (Deferred)

**Status: Theoretical — not yet implemented.**

This document captures a planned UX improvement for tools triggered from within
Canvas. It is recorded here so the idea is not lost and the implementation path
is clear when the time comes.

---

## Problem

When a teacher clicks the Power Tools inject button inside a Canvas module, they
are pulled away into a separate browser tab. They complete the task, then have
to navigate back to Canvas. Canvas does not reflect the change until the page
reloads. This creates unnecessary friction for short in-Canvas workflows — the
teacher did less work overall, but it felt like more of a chore.

Canvas itself solves this for its own dialogs (file picker, media selector) by
using `window.open()` popup windows that float above the page without replacing
it. We should do the same for tools triggered from within Canvas.

---

## Scope

**Applies to: Templates and Copy Assignments only.**

These two tools are naturally triggered from inside Canvas mid-workflow. The
teacher expects to stay in context and return quickly.

Other tools — Bulk Editor, Grading Dashboard, Rubric Manager, Assignment Groups,
Student Groups — remain as full-page tabs. These are work-session tools where
the teacher intentionally leaves Canvas, and full-page width is valuable. The
architecture makes switching any of them to popups trivial in the future if
needed.

---

## Proposed Implementation

### The mechanism

`chrome.windows.create({ type: 'popup', url, width, height })` opens a
borderless floating window with no address bar or browser chrome — exactly like
Canvas's own dialogs. Tool component code is entirely untouched; the only
changes are in how the tools are launched.

### Popup sizing

| Tool | Width | Height |
|---|---|---|
| Templates | 900 | 700 |
| Copy Assignments | 800 | 650 |

### Post-action: close and refresh Canvas

After a successful deploy or copy, the popup should close automatically and the
originating Canvas tab should reload so the new assignment appears immediately.

- Tool page sends `chrome.runtime.sendMessage({ type: 'TOOL_COMPLETE' })`
- Service worker reloads the originating Canvas tab and closes the popup window
- The originating tab ID is passed when the popup is opened and tracked in the
  service worker

---

## Files that would change

| File | Change |
|---|---|
| `src/config/tools.jsx` | Add `popupWidth` and `popupHeight` to the `templates` and `duplicate` entries. Absence of these fields on other tools signals "open as tab." |
| `src/background/service-worker.js` | Update `OPEN_PAGE` handler to call `chrome.windows.create()` if the tool has popup dimensions; otherwise `chrome.tabs.create()` as today. Accept `originatingTabId` in the payload. Add `TOOL_COMPLETE` handler to reload the originating tab and close the popup. |
| `src/content_scripts/ui-injector.js` | Include `originatingTabId` when sending `OPEN_PAGE` so the service worker knows which tab to reload. |
| `src/modules/assignments/DeployTemplate.jsx` | On successful deploy, send `TOOL_COMPLETE` before showing the success state. |
| `src/modules/assignments/CopyFlow.jsx` | On successful copy, send `TOOL_COMPLETE`. |

## Files that would not change

- All other tool pages and components
- `src/shell/index.jsx` and `src/popup/popup.jsx` — homepage and toolbar popup
  open tools as tabs; this behavior is correct and unchanged
- API layer, storage, settings

---

## Why this is easy to defer

The entire change lives in how tools are launched, not in what they do. The
existing tool pages load correctly inside a popup window without modification.
Switching any future tool to popup delivery is a two-line addition to
`tools.jsx` plus a `TOOL_COMPLETE` call at the appropriate success handler.
