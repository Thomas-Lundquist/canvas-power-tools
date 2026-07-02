# Canvas Power Tools — 06: Technical Infrastructure

---

## Overview

This document covers the technical systems that underpin every Module and
Tool in Canvas Power Tools. It is developer-facing. Feature documents
reference this document for implementation details but do not duplicate
them.

The systems covered here are:
- Canvas API Layer — authentication, request handling, pagination, rate
  limiting, error classification, and per-resource API modules
- Storage and Migration — schema versioning and safe data migration
- Performance — virtual scrolling for large data sets
- DOM Resilience — resilient Canvas element detection and health monitoring
- Operational Concerns — token verification, offline behavior, and
  concurrent tab handling

---

## Canvas API Layer

### Architecture

All Canvas API calls originate from extension pages (the single-page
application shell) or from the background service worker. Content scripts
injected into Canvas pages make no API calls. This separation prevents
CORS issues and keeps API logic isolated from DOM manipulation code.

Every API call passes through the base request wrapper, which handles
authentication, pagination, rate limiting, and error classification
uniformly. No feature code makes raw fetch calls to Canvas.

---

### Authentication — auth.js

```javascript
// src/api/auth.js

import { getDecryptedToken } from '../storage/encryption.js'

export async function getAuthHeaders() {
  const token = await getDecryptedToken()
  if (!token) throw new AuthError('No API token. Complete setup first.')
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

export async function verifyToken(canvasUrl, token) {
  const response = await fetch(`${canvasUrl}/api/v1/users/self`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (response.status === 401) throw new AuthError('Token invalid or expired.')
  if (!response.ok) throw new ApiError(`Verification failed: ${response.status}`)
  const user = await response.json()
  return {
    id: user.id,
    name: user.name,
    shortName: user.short_name
  }
}
```

**Token verification strategy:** Verification does not use timed background
checks. Chrome MV3 service workers are not persistent — they shut down after
approximately 30 seconds of inactivity and cannot reliably run scheduled
tasks. Verification happens at two specific moments instead:

1. On every extension open — a lightweight verification call runs in the
   background. If it fails, the token failure modal appears before the
   teacher attempts any action.
2. On any 401 response — any API call returning 401 immediately triggers
   the token failure flow regardless of when the last verification occurred.

This is more reliable than timed verification and requires no persistent
background process.

---

### Base Request Wrapper — request.js

The wrapper handles six concerns uniformly so feature code does not need
to think about them:

1. Authorization header injection
2. Base URL construction
3. Pagination via Canvas Link headers
4. Rate limit detection and automatic backoff
5. Error classification into typed errors
6. Response parsing

```javascript
// src/api/request.js

import { getAuthHeaders } from './auth.js'
import { getCanvasUrl } from '../storage/account.js'

// Canvas rate limit: approximately 700 requests per 10 minutes per token.
// Requests are queued and automatically retry after a backoff period.
const requestQueue = []
let rateLimitBackoffUntil = null

export async function canvasGet(path, params = {}) {
  const url = await buildUrl(path, params)
  return queueRequest({ url, method: 'GET' })
}

export async function canvasPut(path, body = {}) {
  const url = await buildUrl(path)
  return queueRequest({ url, method: 'PUT', body: JSON.stringify(body) })
}

export async function canvasPost(path, body = {}) {
  const url = await buildUrl(path)
  return queueRequest({ url, method: 'POST', body: JSON.stringify(body) })
}

export async function canvasDelete(path) {
  const url = await buildUrl(path)
  return queueRequest({ url, method: 'DELETE' })
}

// Fetches all pages of a paginated Canvas response.
// Canvas defaults to 10 results per page. The wrapper requests 100
// and follows Link headers until no next page exists.
export async function canvasGetAll(path, params = {}) {
  let allResults = []
  let url = await buildUrl(path, { ...params, per_page: 100 })

  while (url) {
    const response = await executeRequest({ url, method: 'GET' })
    const data = await response.json()
    allResults = allResults.concat(data)
    url = extractNextPageUrl(response.headers.get('Link'))
  }

  return allResults
}

async function buildUrl(path, params = {}) {
  const baseUrl = await getCanvasUrl()
  const url = new URL(`${baseUrl}${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

async function executeRequest({ url, method, body }) {
  if (rateLimitBackoffUntil && Date.now() < rateLimitBackoffUntil) {
    await sleep(rateLimitBackoffUntil - Date.now())
  }

  const headers = await getAuthHeaders()
  const response = await fetch(url, { method, headers, body })

  if (response.status === 403) {
    const backoffMs = 5000
    rateLimitBackoffUntil = Date.now() + backoffMs
    throw new RateLimitError(`Rate limited. Retrying in ${backoffMs}ms.`)
  }
  if (response.status === 401) throw new AuthError('Token invalid or expired.')
  if (response.status === 404) throw new NotFoundError(`Not found: ${url}`)
  if (!response.ok) throw new ApiError(`Request failed: ${response.status}`)

  return response
}

function extractNextPageUrl(linkHeader) {
  if (!linkHeader) return null
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
  return match ? match[1] : null
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

---

### Error Types — errors.js

Typed errors allow calling code to handle each failure mode specifically
rather than catching a generic Error.

```javascript
// src/api/errors.js

export class AuthError extends Error {
  constructor(message) { super(message); this.name = 'AuthError'; this.type = 'auth' }
}
export class RateLimitError extends Error {
  constructor(message) { super(message); this.name = 'RateLimitError'; this.type = 'rate_limit' }
}
export class NotFoundError extends Error {
  constructor(message) { super(message); this.name = 'NotFoundError'; this.type = 'not_found' }
}
export class ApiError extends Error {
  constructor(message, statusCode) {
    super(message); this.name = 'ApiError'; this.type = 'api_error'; this.statusCode = statusCode
  }
}
```

---

### API Modules

Each resource has its own module. Feature code imports from these modules,
never from the request wrapper directly.

#### courses.js

```javascript
export async function getCourses() {
  const courses = await canvasGetAll('/api/v1/courses', {
    enrollment_type: 'teacher',
    enrollment_state: 'active',
    include: ['term']
  })
  return courses.map(c => ({
    id: String(c.id),
    name: c.name,
    courseCode: c.course_code,
    term: c.term?.name || null
  }))
}
```

#### assignments.js

```javascript
export async function getAssignments(courseId) {
  const assignments = await canvasGetAll(
    `/api/v1/courses/${courseId}/assignments`,
    { include: ['assignment_group', 'module_ids'] }
  )
  return assignments.map(mapAssignment)
}

export async function updateAssignment(courseId, assignmentId, fields) {
  const response = await canvasPut(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
    { assignment: buildAssignmentPayload(fields) }
  )
  return mapAssignment(await response.json())
}

export async function bulkUpdateDates(courseId, updates) {
  // updates: [{ id, due_at, unlock_at, lock_at }]
  // Canvas's bulk_update endpoint handles date fields only.
  // Points and publish status changes require individual PUT requests.
  const response = await canvasPut(
    `/api/v1/courses/${courseId}/assignments/bulk_update`,
    updates
  )
  return response.json() // Returns a Progress object
}

export async function createAssignment(courseId, fields) {
  const response = await canvasPost(
    `/api/v1/courses/${courseId}/assignments`,
    { assignment: buildAssignmentPayload(fields) }
  )
  return mapAssignment(await response.json())
}

function mapAssignment(raw) {
  return {
    id: String(raw.id),
    courseId: String(raw.course_id),
    name: raw.name,
    description: raw.description,
    dueAt: raw.due_at,
    unlockAt: raw.unlock_at,
    lockAt: raw.lock_at,
    pointsPossible: raw.points_possible,
    published: raw.published,
    submissionTypes: raw.submission_types,
    allowedExtensions: raw.allowed_extensions,
    gradingType: raw.grading_type,
    assignmentGroupId: String(raw.assignment_group_id),
    assignmentGroupName: raw.assignment_group?.name || null,
    moduleIds: raw.module_ids || [],
    peerReviews: raw.peer_reviews,
    position: raw.position
  }
}

function buildAssignmentPayload(fields) {
  const map = {
    name: 'name', description: 'description', dueAt: 'due_at',
    unlockAt: 'unlock_at', lockAt: 'lock_at',
    pointsPossible: 'points_possible', published: 'published',
    submissionTypes: 'submission_types', gradingType: 'grading_type',
    assignmentGroupId: 'assignment_group_id', peerReviews: 'peer_reviews'
  }
  return Object.entries(fields).reduce((payload, [key, value]) => {
    if (map[key] && value !== undefined) payload[map[key]] = value
    return payload
  }, {})
}
```

#### Bulk Update Strategy

Canvas's bulk_update endpoint handles date fields (due_at, unlock_at,
lock_at) efficiently in one request. Points and publish status require
individual PUT requests per assignment.

```javascript
export async function applyBulkEdit(courseId, assignments, changes) {
  const results = { succeeded: [], failed: [] }
  const hasDateChange = changes.dueAt !== undefined ||
                        changes.unlockAt !== undefined ||
                        changes.lockAt !== undefined
  const hasOtherChange = changes.pointsPossible !== undefined ||
                         changes.published !== undefined

  if (hasDateChange) {
    const dateUpdates = assignments.map(a => ({
      id: a.id,
      due_at: resolveDate(a.dueAt, changes.dueAt),
      unlock_at: resolveDate(a.unlockAt, changes.unlockAt),
      lock_at: resolveDate(a.lockAt, changes.lockAt)
    }))
    try {
      await bulkUpdateDates(courseId, dateUpdates)
      dateUpdates.forEach(u => results.succeeded.push(u.id))
    } catch {
      // Bulk update failed — fall back to individual requests
      for (const update of dateUpdates) {
        try {
          await updateAssignment(courseId, update.id, {
            dueAt: update.due_at,
            unlockAt: update.unlock_at,
            lockAt: update.lock_at
          })
          results.succeeded.push(update.id)
        } catch (err) {
          results.failed.push({ id: update.id, error: err.message })
        }
      }
    }
  }

  if (hasOtherChange) {
    for (const assignment of assignments) {
      try {
        await updateAssignment(courseId, assignment.id, {
          pointsPossible: changes.pointsPossible,
          published: changes.published
        })
        if (!results.succeeded.includes(assignment.id)) {
          results.succeeded.push(assignment.id)
        }
      } catch (err) {
        results.failed.push({ id: assignment.id, error: err.message })
      }
    }
  }

  return results
}

function resolveDate(currentValue, change) {
  if (!change) return currentValue
  if (change.type === 'set') return change.value
  if (change.type === 'shift') {
    // Respect the shiftNullDates setting. If set to 'skip' and
    // the current value is null, return null unchanged.
    if (!currentValue) return currentValue
    const date = new Date(currentValue)
    date.setDate(date.getDate() + change.days)
    return date.toISOString()
  }
  return currentValue
}
```

---

### Complete API Endpoint Reference

| Version | Action | Method | Endpoint |
|---|---|---|---|
| V1.0 | Verify token | GET | /api/v1/users/self |
| V1.0 | List courses | GET | /api/v1/courses |
| V1.0 | List assignments | GET | /api/v1/courses/:id/assignments |
| V1.0 | Update assignment | PUT | /api/v1/courses/:id/assignments/:id |
| V1.0 | Bulk update dates | PUT | /api/v1/courses/:id/assignments/bulk_update |
| V1.0 | List assignment groups | GET | /api/v1/courses/:id/assignment_groups |
| V1.0 | List modules | GET | /api/v1/courses/:id/modules |
| V1.5 | Create assignment | POST | /api/v1/courses/:id/assignments |
| V1.5 | Duplicate assignment | POST | /api/v1/courses/:id/assignments/:id/duplicate |
| V2 | List students | GET | /api/v1/courses/:id/students |
| V2 | List sections | GET | /api/v1/courses/:id/sections |
| V2 | List submissions | GET | /api/v1/courses/:id/submissions |
| V2 | Update submission | PUT | /api/v1/courses/:id/assignments/:id/submissions/:id |
| V2 | List groups | GET | /api/v1/courses/:id/groups |
| V2 | Create group | POST | /api/v1/courses/:id/groups |
| V2 | Create assignment override | POST | /api/v1/courses/:id/assignments/:id/overrides |
| V2 | List rubrics | GET | /api/v1/courses/:id/rubrics |
| V2 | Create rubric | POST | /api/v1/courses/:id/rubrics |
| V2 | Send conversation | POST | /api/v1/conversations |
| V2 | Create announcement | POST | /api/v1/courses/:id/discussion_topics |
| V3 | List outcomes | GET | /api/v1/courses/:id/outcome_group_links |
| V3 | Import QTI content | POST | /api/v1/courses/:id/content_migrations |
| V3 | List discussions | GET | /api/v1/courses/:id/discussion_topics |
| V3 | Update module | PUT | /api/v1/courses/:id/modules/:id |
| V3 | List pages | GET | /api/v1/courses/:id/pages |

**Canvas API notes:**
- Dates use ISO 8601 UTC format: "2025-10-01T23:59:00Z"
- Sending null for a date field removes the date from the assignment
- bulk_update returns a Progress object, not the updated assignments directly
- The Conversations API sends one message per recipient

---

## Storage and Migration

### Why Migrations Are Necessary

Every extension update that adds, removes, or renames a storage field leaves
existing users with a mismatched schema. Without a migration system, new
fields are undefined, removed fields produce errors, and renamed fields
produce silent data loss. The migration system catches this before any
feature code runs.

### Version Tracking

The meta object in chrome.storage.local tracks the storage schema version
independently from the extension version. These are different because schema
changes do not always align with feature releases.

```javascript
meta: {
  version: "1.0.0",      // extension version from manifest.json
  schemaVersion: 1        // storage data structure version
}
```

### Migration Runner

Runs once on every extension open, before any other code executes.

```javascript
// src/storage/migrations.js

const MIGRATIONS = [
  {
    version: 2,
    description: "Add defaultShiftAmount to bulkEditor settings",
    migrate: async (storage) => {
      if (storage.settings?.bulkEditor &&
          storage.settings.bulkEditor.defaultShiftAmount === undefined) {
        storage.settings.bulkEditor.defaultShiftAmount = 7
      }
      return storage
    }
  }
  // New migrations are appended here with incrementing version numbers.
  // Migrations are never edited or removed — only appended.
]

export async function runMigrations() {
  const stored = await chrome.storage.local.get('meta')
  const currentVersion = stored.meta?.schemaVersion || 1
  const pending = MIGRATIONS.filter(m => m.version > currentVersion)

  if (pending.length === 0) return

  let storage = await chrome.storage.local.get(null)

  for (const migration of pending) {
    try {
      storage = await migration.migrate(storage)
    } catch (error) {
      // Log the failure but continue. The extension loads using
      // defaults for any missing fields rather than crashing.
      console.error(`Migration v${migration.version} failed:`, error)
    }
  }

  const latestVersion = pending[pending.length - 1].version
  storage.meta = { ...storage.meta, schemaVersion: latestVersion }

  await chrome.storage.local.set(storage)
  await chrome.storage.sync.set({ settings: storage.settings })
}
```

**Rules for writing migrations:**
- Always append. Never edit or delete an existing migration entry.
- Migrations must be additive or transformative. Deleting data requires
  an explicit migration entry with a documented reason.
- A failed migration is logged but does not prevent the extension from
  loading. The extension falls back to defaults for missing fields.

---

## Performance

### Virtual Scrolling

Canvas courses can have hundreds of assignments. Rendering all rows in the
DOM simultaneously causes layout thrashing and input lag at scale.

**Solution:** Render only the rows currently visible on screen plus a small
buffer. The teacher sees the full table. The browser handles only 20-30 DOM
nodes at any time.

**Library:** @tanstack/react-virtual

**Implementation — `AssignmentTable.jsx`**

The table component manages its own scroll container. By default the container
is `max-h-[34rem]` (≈ 544px). When `fillHeight` is `true` it becomes
`flex-1 min-h-0`, filling the remaining height of a flex parent — used when
the bulk editor page wants the table to grow to the full available space.

The table uses `table-layout: fixed` with Tailwind width classes on each `<th>`
column. This keeps column widths stable regardless of which rows are rendered.

The `thead` is `position: sticky; top: 0` so column headers remain visible
while scrolling.

Rather than absolutely positioning rows (which breaks table layout), the
virtualizer uses padding spacer rows — empty `<tr>` elements above and below
the visible window that reserve the correct scroll space:

```javascript
import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

const parentRef = useRef(null)

const rowVirtualizer = useVirtualizer({
  count: loading ? 0 : assignments.length,  // stays 0 while loading
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48,  // px — @tanstack/react-virtual API contract
  overscan: 5,
})

const virtualItems = rowVirtualizer.getVirtualItems()
const totalSize = rowVirtualizer.getTotalSize()
const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
const paddingBottom = virtualItems.length > 0
  ? totalSize - virtualItems[virtualItems.length - 1].end
  : 0
```

```jsx
<div ref={parentRef} className={`overflow-auto ${fillHeight ? 'flex-1 min-h-0' : 'max-h-[34rem]'}`}>
  <table
    className="w-full min-w-[61.5rem] text-sm border-collapse table-fixed"
    role="grid"
    aria-label="Assignments"
    aria-rowcount={assignments.length}
    aria-multiselectable="true"
  >
    <thead className="sticky top-0 z-10">...</thead>
    <tbody>
      {paddingTop > 0 && (
        <tr><td colSpan={totalCols} style={{ height: paddingTop }} /></tr>
      )}
      {virtualItems.map(vr => (
        <AssignmentRow
          key={assignments[vr.index].id}
          assignment={assignments[vr.index]}
          rowIndex={vr.index}   // component adds +2 for 1-indexed ARIA (header = row 1)
          ...
        />
      ))}
      {paddingBottom > 0 && (
        <tr><td colSpan={totalCols} style={{ height: paddingBottom }} /></tr>
      )}
    </tbody>
  </table>
</div>
```

**Accessibility:** The `table` carries `aria-rowcount` set to the total row
count and `aria-multiselectable="true"`. Each rendered `<tr>` carries
`aria-rowindex` (1-based; header = 1, first data row = 2) and
`aria-selected`. This tells screen readers the true table size even when
most rows are not in the DOM.

**Layout requirement for `fillHeight` mode:** The virtualizer computes
visible rows by measuring `parentRef.current.clientHeight`. For that
measurement to be bounded, every ancestor in the flex chain must have a
definite height. This means the page root **must** use `h-screen`
(`height: 100vh`), not `min-h-screen`. With `min-h-screen` the root
expands to fit content, the flex chain has no upper bound, and the
virtualizer renders all rows — making the table extend far below the
viewport. See Doc 10 — Page Layout Patterns for the complete layout
template.

**`actionBarVisible` prop:** When a fixed-position element overlays the
bottom of the table (e.g., the BulkActionBar), pass `actionBarVisible`
to `AssignmentTable`. It conditionally applies `pb-48` to the scroll
container so users can scroll through content that would otherwise be
hidden behind the overlay. This padding must live on the scroll container,
not the page root — root-level padding creates a permanent gap even when
the overlay is not visible.

**Skeleton auto-sizing:** In `fillHeight` mode the scroll container has a
bounded height that varies by viewport. A fixed number of skeleton rows
would leave visible empty space on large screens or overflow on small ones.
`AssignmentTable` uses `useLayoutEffect` to measure `parentRef.current
.clientHeight` when `loading` becomes `true` and computes the row count
as `Math.ceil(height / 48)`. The 8 skeleton width patterns cycle with
modulo so any count is supported.

**Search and filter performance:** Client-side filtering on an already-fetched
list is instant up to approximately 500 items. Text search is debounced by
150ms to avoid re-rendering on every keystroke.

```javascript
const debouncedSearch = useMemo(() => debounce(setSearchTerm, 150), [])
```

---

## DOM Resilience

### The Problem

Content scripts find Canvas UI elements by CSS selector to inject buttons
and panels. Canvas ships UI updates regularly. When a class name changes,
a selector silently returns null and the injection fails. Without a
resilience system, teachers see broken behavior with no explanation, and
the developer does not know anything broke until support requests arrive.

### Selector Cascade

Every Canvas UI element the extension interacts with has a prioritized list
of strategies rather than one rigid selector. The engine tries them in order.
The first strategy that returns a valid element wins.

**Strategy tiers, most to least stable:**

1. **Data attributes** — Canvas and modern web apps use data-testid and
   data-component for testing. Developers are less likely to change these
   because doing so breaks their own test suite.
2. **ARIA and semantic HTML** — accessibility attributes and structural HTML
   tags change less frequently than class names.
3. **CSS class selectors** — fast to query but change with every UI redesign.
   Always tried but never relied upon exclusively.
4. **Structural heuristics** — find elements by their relationship to known
   stable neighbors. Used as a last resort.

### Selector Registry — selectors.js

All selectors live in one file. When Canvas updates and breaks something,
one file is updated and every injection point is fixed.

```javascript
// src/dom/selectors.js

export const SELECTORS = {
  assignmentsToolbar: {
    description: "Toolbar on the Assignments page where the Power Tools button is injected",
    pagePattern: "/courses/*/assignments",
    strategies: [
      '[data-testid="assignments-toolbar"]',
      '[data-component="AssignmentsToolbar"]',
      '.assignments-toolbar',
      'div[class*="toolbar"][class*="assignment"]'
    ],
    fallback: 'structural',
    structuralHint: {
      container: 'div',
      childSelector: 'button',
      minChildren: 1,
      nearText: 'Assignments'
    }
  },

  assignmentDetailActions: {
    description: "Action buttons on an Assignment detail page",
    pagePattern: "/courses/*/assignments/*",
    strategies: [
      '[data-testid="assignment-actions"]',
      '.assignment-actions',
      'div[class*="assignment-header"] div[class*="actions"]'
    ],
    fallback: 'proximity',
    proximityHint: { anchor: 'h1', position: 'sibling' }
  }

  // Additional selectors added here as features require them
}
```

### Selector Engine — selector-engine.js

```javascript
// src/dom/selector-engine.js

import { SELECTORS } from './selectors.js'
import { logRecovery, logFailure } from './recovery-log.js'
import { detectCanvasVersion } from './health-check.js'

export function findElement(selectorKey) {
  const config = SELECTORS[selectorKey]
  if (!config) {
    console.warn(`Unknown selector key: ${selectorKey}`)
    return null
  }

  for (let i = 0; i < config.strategies.length; i++) {
    const element = document.querySelector(config.strategies[i])
    if (element) {
      if (i > 0) {
        logRecovery({ selectorKey, strategyIndex: i,
          method: 'css_fallback', canvasVersion: detectCanvasVersion() })
      }
      return element
    }
  }

  if (config.fallback === 'structural' && config.structuralHint) {
    const element = structuralSearch(config.structuralHint)
    if (element) {
      logRecovery({ selectorKey, method: 'structural_fallback',
        canvasVersion: detectCanvasVersion() })
      return element
    }
  }

  logFailure({ selectorKey, canvasVersion: detectCanvasVersion(),
    pageUrl: window.location.pathname,
    strategiesAttempted: config.strategies })
  return null
}

function structuralSearch(hint) {
  const candidates = document.querySelectorAll(hint.container)
  for (const candidate of candidates) {
    const children = candidate.querySelectorAll(hint.childSelector)
    if (children.length >= (hint.minChildren || 1)) return candidate
  }
  return null
}
```

### Canvas Version Detection — health-check.js

Capturing the Canvas version alongside every log entry correlates failures
with specific Canvas releases, making diagnosis fast.

```javascript
// src/dom/health-check.js

export function detectCanvasVersion() {
  return (
    document.querySelector('meta[name="canvas-version"]')?.content ||
    window.ENV?.CANVAS_VERSION ||
    'unknown'
  )
}

export async function runHealthCheck() {
  const results = {}
  for (const [key, config] of Object.entries(SELECTORS)) {
    const element = findElement(key)
    results[key] = {
      status: element ? 'ok' : 'failing',
      description: config.description,
      lastChecked: new Date().toISOString()
    }
  }
  await chrome.storage.local.set({
    healthCheckResults: results,
    healthCheckTimestamp: new Date().toISOString()
  })
  return results
}
```

### Recovery Log — recovery-log.js

```javascript
// src/dom/recovery-log.js

const MAX_LOG_ENTRIES = 100

export async function logRecovery(event) {
  await appendToLog({ type: 'recovery', timestamp: new Date().toISOString(), ...event })
}

export async function logFailure(event) {
  await appendToLog({ type: 'failure', recovered: false,
    timestamp: new Date().toISOString(), ...event })
}

async function appendToLog(entry) {
  const result = await chrome.storage.local.get('domLog')
  const log = result.domLog || []
  log.unshift(entry)
  await chrome.storage.local.set({ domLog: log.slice(0, MAX_LOG_ENTRIES) })
}
```

### Health Dashboard

A section in Settings showing the current state of every selector.

```
CANVAS INTEGRATION HEALTH

Last checked: Today, 2:45 PM                      [Run Check Now]

Assignments toolbar     OK — primary selector
Assignment detail       OK — primary selector
Gradebook toolbar       Warning — using fallback selector
SpeedGrader panel       Failing — all selectors failed

Canvas version: 2025.11.2
Extension version: 1.0.0

[View Recovery Log]     [Report an Issue]
```

**Report an Issue** opens a pre-filled GitHub issue containing: extension
version, Canvas version, failed selector keys, affected page patterns, and
the last 24 hours of the recovery log. No PII is included.

### Injection Fallback

If a primary injection target cannot be found, the content script falls
back to a floating button in the bottom right corner of the Canvas page.
This ensures the teacher always has access to the extension even during a
Canvas UI update. The fallback triggers a health warning automatically.

```javascript
function injectFallbackButton() {
  const button = document.createElement('button')
  button.textContent = 'Power Tools'
  button.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;...'
  button.dataset.fallback = 'true'
  document.body.appendChild(button)
  logFailure({ selectorKey: 'primary_injection', reason: 'fallback_activated' })
}
```

### Injection Timing

Canvas pages load content dynamically via JavaScript. The content script
waits for the target element using a MutationObserver rather than injecting
immediately on DOMContentLoaded.

```javascript
function waitForElement(selectorKey, callback, timeout = 5000) {
  const element = findElement(selectorKey)
  if (element) { callback(element); return }

  const observer = new MutationObserver(() => {
    const el = findElement(selectorKey)
    if (el) { observer.disconnect(); callback(el) }
  })

  observer.observe(document.body, { childList: true, subtree: true })

  setTimeout(() => {
    observer.disconnect()
    injectFallbackButton()
  }, timeout)
}
```

### V2 — Opt-In Telemetry

When teachers enable anonymous reporting in Settings, selector failures
send a minimal payload to a lightweight backend. This feeds the developer
diagnostic dashboard.

**Payload — no PII, no course data:**
```javascript
{
  event: "selector_failure",
  selectorKey: "assignmentsToolbar",
  canvasVersion: "2025.11.2",
  urlPattern: "/courses/*/assignments",  // IDs stripped
  timestamp: "2025-10-03T14:32:00Z",
  extensionVersion: "1.2.0",
  recovered: false
}
```

---

## Operational Concerns

### Offline Behavior

```javascript
window.addEventListener('offline', () => showOfflineState())
window.addEventListener('online', () => hideOfflineState())
```

**On load while offline:** The offline state screen is shown. No API calls
are attempted. Settings, templates, rubrics, and change logs remain
accessible from local storage.

**Going offline mid-session:** A persistent banner appears. All write
controls are disabled. The extension is read-only until connectivity
returns.

**Returning online:** The banner dismisses automatically. Any pending
unsaved changes prompt the teacher to apply them.

**Canvas unreachable but internet works:** Treated as an API error with a
specific message — "Canvas appears to be unreachable" — distinct from the
offline state message.

---

### Concurrent Tab Handling

If the teacher opens the extension in two browser tabs simultaneously,
storage writes from both tabs could conflict. A session lock prevents this.

```javascript
// src/storage/session-lock.js

const LOCK_KEY = 'sessionLock'
const LOCK_TTL = 30000       // milliseconds
const REFRESH_INTERVAL = 10000

export async function acquireSessionLock(pageKey) {
  const result = await chrome.storage.local.get(LOCK_KEY)
  const existing = result[LOCK_KEY]

  if (existing && existing.page === pageKey) {
    if (Date.now() - existing.timestamp < LOCK_TTL) return false
  }

  await chrome.storage.local.set({
    [LOCK_KEY]: { page: pageKey, timestamp: Date.now() }
  })
  return true
}

export function startLockRefresh(pageKey) {
  return setInterval(async () => {
    await chrome.storage.local.set({
      [LOCK_KEY]: { page: pageKey, timestamp: Date.now() }
    })
  }, REFRESH_INTERVAL)
}

export async function releaseLock() {
  await chrome.storage.local.remove(LOCK_KEY)
}
```

If a second tab detects an active lock, the teacher sees a warning:

```
Already Open

Canvas Power Tools is already open in another tab.
Using both simultaneously may cause unexpected behavior.

[Switch to Other Tab]    [Continue Anyway]
```

Last write wins if the teacher continues. No data corrupts but stale data
may appear in one tab.
