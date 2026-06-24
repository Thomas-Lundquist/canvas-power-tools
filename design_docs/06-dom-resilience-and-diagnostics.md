# Canvas Power Tools — 06: DOM Resilience and Diagnostics

---

## The Problem

Browser extensions that inject UI into third-party websites are inherently
fragile. If the target website updates its HTML structure, CSS class names,
or page layout, the extension's ability to find and interact with page elements
breaks. Canvas (Instructure) ships updates regularly.

A naive implementation finds elements like this:

```javascript
// Brittle — breaks silently if Canvas renames this class
document.querySelector('.assignment-list-container')
```

If Instructure renames that class in a Canvas update, this returns null and
the extension either does nothing or throws an error. The teacher has no idea
why the tool stopped working.

The solution is a resilient DOM selection system that tries multiple strategies
to find each element, logs failures, and surfaces them to both the teacher and
the developer.

---

## Core Concept — Selector Cascade

Instead of one rigid selector per element, each Canvas UI element has a
prioritized list of strategies. The engine tries them in order from most
specific to most general. If one fails, it tries the next.

```javascript
const strategies = [
  '.assignment-list-container',           // CSS class — fast but fragile
  '[data-testid="assignment-list"]',      // data attribute — more stable
  '[data-component="AssignmentList"]',    // component attribute — stable
  'nav[aria-label="Assignments"]',        // semantic/ARIA — very stable
  structuralFallback                      // heuristic — last resort
]
```

The first strategy that returns a valid element wins.

---

## The Four Strategy Tiers

### Tier 1 — CSS Class Selectors
Fastest to write and query. Most fragile — class names change frequently
during Canvas UI updates. Always tried first because speed matters, but
never relied on exclusively.

```javascript
document.querySelector('.assignment-list-container')
```

### Tier 2 — Data Attributes
Modern web applications often use data-testid or data-component attributes
for testing. These are more stable than class names because developers are
less likely to change them — doing so would break their own test suite.

```javascript
document.querySelector('[data-testid="assignment-list"]')
document.querySelector('[data-component="AssignmentList"]')
```

### Tier 3 — Semantic HTML and ARIA
HTML structural elements and accessibility attributes change the least
frequently of all selectors. A nav element is still a nav element even after
a Canvas redesign. These selectors often work across major Canvas UI changes.

```javascript
document.querySelector('nav[aria-label="Course Navigation"]')
document.querySelector('main[role="main"]')
document.querySelector('h1[data-automation="assignment-title"]')
```

### Tier 4 — Structural Heuristics
When all other strategies fail, the engine attempts to find the element by
its relationship to other elements or by its content. This is the most
flexible and the most complex strategy.

```javascript
// Find the list that follows an h2 containing "Assignments"
findByProximity('h2', 'Assignments', 'nextSibling', 'ul')

// Find a ul with at least 3 li children that each contain
// an element with an href matching the assignments URL pattern
findByStructure('ul', {
  minChildren: 3,
  childContains: '[href*="/assignments/"]'
})
```

Structural heuristics are defined per selector key and customized for each
Canvas UI pattern.

---

## Selector Registry — selectors.js

All selectors live in one central file. This is the only file that needs to
be updated when Canvas changes its UI. Every other part of the codebase
calls the selector engine by key name — nothing queries the DOM directly.

```javascript
// src/dom/selectors.js

export const SELECTORS = {

  assignmentList: {
    description: "Main assignment list on the Assignments page",
    pagePattern: "/courses/*/assignments",
    strategies: [
      '.assignment-list-container',
      '[data-testid="assignment-list"]',
      '[data-component="AssignmentList"]',
      '#assignment-list',
    ],
    fallback: 'structural',
    structuralHint: {
      container: 'div',
      childSelector: '.assignment',
      minChildren: 1
    }
  },

  courseNavigation: {
    description: "Left sidebar course navigation menu",
    pagePattern: "/courses/*",
    strategies: [
      'nav.course-menu',
      '[data-testid="course-navigation"]',
      'nav[aria-label="Course Navigation"]',
      '#section-tabs',
    ],
    fallback: 'structural',
    structuralHint: {
      container: 'nav',
      childSelector: 'a[href*="/courses/"]',
      minChildren: 3
    }
  },

  assignmentTitle: {
    description: "Title of an individual assignment detail page",
    pagePattern: "/courses/*/assignments/*",
    strategies: [
      '.assignment-title',
      '[data-testid="assignment-title"]',
      'h1.title',
      'h1[class*="title"]',
    ],
    fallback: 'proximity',
    proximityHint: {
      anchor: 'h1',
      position: 'self'
    }
  },

  gradebookContainer: {
    description: "Main gradebook table container",
    pagePattern: "/courses/*/gradebook",
    strategies: [
      '.gradebook-container',
      '[data-testid="gradebook"]',
      '#gradebook',
      '[data-component="Gradebook"]',
    ],
    fallback: 'structural',
    structuralHint: {
      container: 'div',
      childSelector: '[class*="gradebook"]',
      minChildren: 1
    }
  }

}
```

New selectors are added to this file as new features are built. When Canvas
breaks a selector, only the strategies array for that key needs updating.

---

## Selector Engine — selector-engine.js

The engine that processes the registry and returns elements.

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

  // Try each strategy in priority order
  for (let i = 0; i < config.strategies.length; i++) {
    const strategy = config.strategies[i]
    const element = document.querySelector(strategy)

    if (element) {
      // Log if we had to fall back from the primary strategy
      if (i > 0) {
        logRecovery({
          selectorKey,
          strategyIndex: i,
          strategyUsed: strategy,
          method: 'css_fallback',
          canvasVersion: detectCanvasVersion(),
          pageUrl: window.location.pathname
        })
      }
      return element
    }
  }

  // All CSS/attribute strategies failed — try structural fallback
  if (config.fallback === 'structural' && config.structuralHint) {
    const element = structuralSearch(config.structuralHint)
    if (element) {
      logRecovery({
        selectorKey,
        method: 'structural_fallback',
        canvasVersion: detectCanvasVersion(),
        pageUrl: window.location.pathname
      })
      return element
    }
  }

  if (config.fallback === 'proximity' && config.proximityHint) {
    const element = proximitySearch(config.proximityHint)
    if (element) {
      logRecovery({
        selectorKey,
        method: 'proximity_fallback',
        canvasVersion: detectCanvasVersion(),
        pageUrl: window.location.pathname
      })
      return element
    }
  }

  // Complete failure — log and return null
  logFailure({
    selectorKey,
    canvasVersion: detectCanvasVersion(),
    pageUrl: window.location.pathname,
    allStrategiesAttempted: config.strategies
  })

  return null
}

function structuralSearch(hint) {
  const candidates = document.querySelectorAll(hint.container)
  for (const candidate of candidates) {
    const children = candidate.querySelectorAll(hint.childSelector)
    if (children.length >= (hint.minChildren || 1)) {
      return candidate
    }
  }
  return null
}

function proximitySearch(hint) {
  const anchors = document.querySelectorAll(hint.anchor)
  for (const anchor of anchors) {
    if (hint.position === 'self') return anchor
    // Additional proximity logic as needed
  }
  return null
}
```

---

## Recovery Log — recovery-log.js

Stores selector events in chrome.storage.local. Used for the health dashboard
and for generating diagnostic reports.

```javascript
// src/dom/recovery-log.js

const MAX_LOG_ENTRIES = 100

export async function logRecovery(event) {
  const entry = {
    type: 'recovery',
    timestamp: new Date().toISOString(),
    ...event
  }
  await appendToLog(entry)
}

export async function logFailure(event) {
  const entry = {
    type: 'failure',
    timestamp: new Date().toISOString(),
    recovered: false,
    ...event
  }
  await appendToLog(entry)
}

async function appendToLog(entry) {
  const result = await chrome.storage.local.get('domLog')
  const log = result.domLog || []
  log.unshift(entry)
  // Keep only the most recent entries
  const trimmed = log.slice(0, MAX_LOG_ENTRIES)
  await chrome.storage.local.set({ domLog: trimmed })
}

export async function getLog() {
  const result = await chrome.storage.local.get('domLog')
  return result.domLog || []
}

export async function clearLog() {
  await chrome.storage.local.set({ domLog: [] })
}
```

---

## Canvas Version Detection — health-check.js

Canvas exposes version information in various places on the page. Capturing
this with every log entry makes it possible to correlate failures with specific
Canvas releases — essential for knowing which update caused a break.

```javascript
// src/dom/health-check.js

export function detectCanvasVersion() {
  // Canvas exposes version through multiple possible locations
  return (
    document.querySelector('meta[name="canvas-version"]')?.content ||
    window.ENV?.CANVAS_VERSION ||
    window.ENV?.canvas_version ||
    document.querySelector('[data-canvas-version]')?.dataset?.canvasVersion ||
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

---

## Teacher-Facing Health Dashboard

A section in the Settings page that shows the current integration health.

```
CANVAS INTEGRATION HEALTH

Last checked: Today, 2:45 PM                    [Run Check Now]

Assignment List         OK — working normally
Course Navigation       OK — working normally
Assignment Title        Warning — using fallback selector
Gradebook               Failing — cannot locate element

Canvas Version detected: 2025.11.2
Extension Version: 1.0.0

[View Recovery Log]     [Report an Issue]
```

### Status Indicators

**OK** — primary selector found the element
**Warning** — primary selector failed but a fallback succeeded
**Failing** — all strategies failed, feature is broken

### Report an Issue Button

Generates a pre-filled GitHub issue containing:
- Extension version
- Canvas version
- Which selectors failed
- Which page patterns are affected
- Recovery log entries from the past 24 hours
- Timestamp

No PII is included. The issue is opened in the browser pointing to the
GitHub repository issues page. The teacher clicks Submit. The developer
receives a perfectly structured bug report.

### When Something Is Failing — Teacher Notice

If a selector is fully failing, a non-technical notice appears contextually
when the affected feature is used:

```
Canvas Integration Notice

Canvas Power Tools could not locate the assignment list
on this page. This may be caused by a recent Canvas update.

Your data, templates, and settings are unaffected.
Only the assignment list display is impacted.

          [Report This Issue]    [Check for Updates]
```

The teacher is never left with a broken feature and no explanation.

---

## V2 — Opt-In Anonymous Telemetry

When the backend exists in V2, teachers can opt in to sending anonymous error
reports. This feeds the developer diagnostic dashboard.

### Opt-In Toggle in Settings

```
Help improve Canvas Power Tools
Anonymously send error reports when the extension cannot
locate Canvas elements. No personal data, course content,
or student information is ever included.

[ Toggle: OFF by default ]
```

Toggle is OFF by default. The teacher must explicitly enable it.

### Telemetry Payload

Minimal. Only what is needed to diagnose the problem.

```javascript
{
  event: "selector_failure",
  selectorKey: "gradebookContainer",
  canvasVersion: "2025.11.2",
  urlPattern: "/courses/*/gradebook",    // path only, IDs stripped
  timestamp: "2025-10-03T14:32:00Z",
  extensionVersion: "1.2.0",
  recovered: false,
  strategiesAttempted: [
    ".gradebook-container",
    "[data-testid='gradebook']",
    "#gradebook"
  ]
}
```

### What Is Never Sent

- Teacher name or identity
- Institution name or Canvas URL
- Course IDs, assignment IDs, student IDs
- Any course content
- API token (ever, under any circumstances)

---

## V2 — Developer Diagnostic Dashboard

A private web dashboard that aggregates telemetry from all reporting users.

```
Canvas Power Tools — Developer Dashboard
Last updated: 10 minutes ago         [Refresh]    [Export CSV]

OVERVIEW
Active installs:          1,204
Reporting users:          847  (70%)
Events last 24 hours:     23
Open selector failures:   3

SELECTOR HEALTH
Selector              Status     Failures    Recovered    Canvas Ver
assignmentList        OK         0           —            —
courseNavigation      Warning    14          9            2025.11
gradebookContainer    Failing    31          0            2025.11
assignmentTitle       OK         2           2            2025.10

CANVAS VERSION BREAKDOWN
2025.11.x    612 users    3 active failures
2025.10.x    198 users    0 active failures
2025.09.x     37 users    0 active failures

RECENT FAILURES
Oct 3, 2:45 PM    gradebookContainer    /courses/*/gradebook
                  Canvas 2025.11.2      Not recovered    31 reports
                  [View Details]

Oct 3, 1:12 PM    courseNavigation      /courses/*/assignments
                  Canvas 2025.11.2      Recovered via fallback
                  [View Details]
```

### Failure Detail View

```
Failure Detail                                       [Close]

Selector:         gradebookContainer
Canvas Version:   2025.11.2
Page Pattern:     /courses/*/gradebook
First seen:       Oct 3, 2025 at 2:45 PM
Reports:          31 users affected
Recovered:        No

Strategies Attempted:
  .gradebook-container          Not found
  [data-testid="gradebook"]     Not found
  #gradebook                    Not found
  Structural fallback           Not found

Suggested Action:
All strategies failed on Canvas 2025.11.2.
Open the gradebook page on a Canvas 2025.11.2 instance,
inspect the DOM, find the new container element,
and update gradebookContainer strategies in selectors.js.

[Open GitHub Issue]    [Mark as Investigating]    [Mark Resolved]
```

### Extension Versions in the Wild

```
v1.2.0    89%    Current
v1.1.0     8%    Outdated
v1.0.0     3%    Outdated
```

Helps decide when to deprecate support for old selector patterns and
encourages users to update.

---

## The Full Fix Cycle

When a Canvas update breaks a selector, the complete fix process is:

```
Canvas ships update
        ↓
Selector engine detects failures automatically
Teacher sees non-technical notice
One-click issue report if needed
        ↓
Anonymous reports flow to developer dashboard
(if teacher has opted in)
        ↓
Developer sees which selector broke,
on which Canvas version,
affecting how many users
        ↓
Developer inspects the Canvas page
finds the new selector or structure
updates one or two lines in selectors.js
        ↓
New extension version built and shipped
        ↓
Dashboard confirms failure rate drops to zero
```

Total fix time once the system is in place: under one hour in most cases.
