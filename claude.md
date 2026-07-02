# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

# Canvas Power Tools — Claude Instructions

This file gives Claude context about the Canvas Power Tools project.
Read it fully before writing any code, suggesting any architecture, or
making any decisions. Do not contradict decisions documented here without
flagging the conflict explicitly.

---

## What This Project Is

Canvas Power Tools is a Chrome browser extension (Manifest V3) that gives
teachers a faster, smarter interface for Canvas LMS. It is a multi-page
extension where each Tool opens as its own extension page. A homepage acts
as the tool picker. Navigation between Tools is a full page transition via
chrome.runtime.getURL(). A shared AppNav component provides consistent
header navigation across all pages.

This is not a toy project or a learning exercise. It is a real product
intended for public release on the Chrome Web Store. Code quality,
accessibility, security, and privacy are non-negotiable requirements.

---

## Design Documents

All design decisions are documented in the /design_docs folder. Read the relevant
document before writing code for any feature. Never guess at a design
decision that might be documented.

| Document | Contents |
|---|---|
| 01-project-overview.md | Architecture, storage schema, file structure, tech stack, distribution |
| 02-bulk-assignment-editor.md | Assignments → Bulk Edit Tool design |
| 03-assignment-templates.md | Assignments → Templates Tool design |
| 04-onboarding-and-settings.md | Onboarding flow and Settings page design |
| 05-roadmap.md | Full feature roadmap by version |
| 06-technical-infrastructure.md | API layer, storage migration, virtual scrolling, DOM resilience |
| 08-settings-reference.md | Complete settings schema and storage structure |
| 09-dev-environment.md | Development environment setup |
| 10-ui-standards-and-patterns.md | UI standards, accessibility, design system, color palette |
| 11-pin-and-security-system.md | PIN gate, audit log, security architecture |
| 12-speedgrader-suite.md | SpeedGrader injected components |
| 13-accommodation-override-manager.md | People → Accommodations Tool design |
| 14-communication-tools.md | Communication Module design |
| 15-v2-feature-designs.md | V2 feature sketches for remaining Tools |
| 16-popup-window-delivery.md | Deferred: popup window delivery for Templates and Copy Assignments |

---

## Architecture

```
Canvas Power Tools (Chrome MV3 Extension)
│
├── Homepage (src/shell/)
│   └── Tool picker grid — navigates to individual Tool pages
│
├── Tool pages (src/pages/<tool>/)
│   └── Each Tool is a separate extension page with its own React root
│       Navigation: window.location.href = chrome.runtime.getURL(path)
│
├── Tool components (src/modules/<module>/)
│   └── The actual React components for each Tool, imported by pages/
│
├── Shared components (src/components/)
│   └── AppNav, CourseSelector, Toast, Modal, PreviewDiff, etc.
│
├── Content scripts (injected into Canvas pages)
│   └── Inject trigger buttons only — no API calls, no feature logic
│
├── SpeedGrader components (src/speedgrader/)
│   └── Injected into Canvas's SpeedGrader page — not part of the extension pages
│
└── Chrome storage
    ├── chrome.storage.local — primary data store (5MB limit)
    └── chrome.storage.sync  — settings and indexes only (100KB total, 8KB per item)
```

---

## Module / Tool / Component Terminology

These terms are used consistently throughout the codebase and documents.
Never use alternative terms (page, screen, section, view) for these concepts.

**Module** — a top-level navigation section in the sidebar.
Examples: Assignments, Grading, Communication, People, Content, Setup

**Tool** — an individual feature within a Module.
Examples: Bulk Edit, Templates, Rubrics (within Assignments)

**Component** — a reusable UI or logic element shared across Tools.
Examples: PreviewDiff, Toast, MultiSelect, PinPrompt, SkeletonRow

---

## Tech Stack

| Technology | Version constraint | Purpose |
|---|---|---|
| JavaScript | ES6+ | Primary language. TypeScript migration is a future consideration — do not introduce it without discussion. |
| React | Current stable | UI framework |
| Tailwind CSS | Current stable | Styling. Use utility classes only — no custom CSS except for CSS custom properties (design tokens). |
| Vite | Current stable | Build tool |
| CRXJS | Current stable | Chrome extension Vite plugin |
| @tanstack/react-virtual | Current stable | Virtual scrolling for large tables |
| Lucide React | Current stable | Icon library |
| npm | — | Package manager |

Do not introduce new dependencies without discussion. Every dependency adds
maintenance burden and potential security exposure.

---

## File and Folder Conventions

```
src/
├── shell/           Homepage — tool picker grid (index.html + index.jsx)
├── pages/           One subfolder per Tool — each is a standalone extension page
│   ├── bulk-editor/   index.html + index.jsx (mounts the React root)
│   ├── grading/
│   ├── groups/
│   ├── templates/
│   ├── duplicate/
│   ├── rubrics/
│   └── student-groups/
├── modules/         Tool components — one subfolder per Module
│   ├── assignments/ All components for Assignment Module Tools
│   ├── grading/
│   ├── communication/
│   ├── people/
│   ├── content/
│   └── setup/
├── components/      Shared reusable Components
├── api/             Canvas API modules (one file per resource)
├── storage/         Storage management (encryption, preferences, change logs)
├── security/        PIN system and audit log
├── dom/             DOM resilience (selectors, engine, health check)
├── config/          Shared configuration (tools.jsx — single source of truth for Tool registry)
├── styles/          Global CSS and design tokens
├── utils/           Shared utility functions
├── background/      MV3 service worker
├── content_scripts/ Canvas page injection scripts
├── speedgrader/     SpeedGrader injection components
├── settings/        Settings page (index.html + index.jsx)
└── popup/           Extension popup (popup.html + popup.jsx)
```

**Naming conventions:**
- React components: PascalCase. File name matches component name. `BulkEdit.jsx`
- Utility modules: camelCase. `auth.js`, `request.js`, `migrations.js`
- CSS custom properties: kebab-case with `--color-`, `--space-`, `--text-` prefixes
- Route paths: kebab-case. `/assignments/bulk-edit`, `/grading/overview`
- Storage keys: camelCase. `changeLogs`, `domLog`, `auditLog`

---

## Coding Standards

### General

- Write code a junior developer can read and understand
- Every function does one thing
- Functions longer than 40 lines are a signal to decompose
- No magic numbers — use named constants
- No commented-out code in commits
- No console.log in production code — use the logging utility

### JavaScript

- Use `const` by default. Use `let` only when reassignment is necessary
- Arrow functions for callbacks and short functions
- Named exports preferred over default exports for utilities
- Default exports for React components
- Async/await over .then() chains
- Always handle promise rejections — no unhandled promise rejections
- Destructure objects and arrays when it improves readability

### React

- Functional components with hooks only — no class components
- One component per file
- Props are destructured in the function signature
- Side effects in useEffect with correct dependency arrays
- Never mutate state directly
- Keys in lists are stable IDs, never array indexes

### Tailwind CSS

- Use design token CSS custom properties for colors, text sizes, and spacing — not raw Tailwind color classes
- This ensures accent color and text size changes propagate correctly
- Example: `className="bg-[var(--color-surface)] text-[var(--color-text-body)]"`
- Avoid arbitrary values (the `[...]` syntax) except for CSS custom properties

### Accessibility (mandatory)

- Every interactive element is keyboard accessible
- Every icon has an aria-label or is aria-hidden with accompanying visible text
- Modals use role="dialog" aria-modal="true" aria-labelledby
- Modals trap focus while open and restore focus on close
- Dynamic content injected into an aria-live region
- Virtual scrolling tables carry aria-rowcount and aria-rowindex
- All text meets 4.5:1 contrast ratio on its background
- Use :focus-visible for focus rings, not :focus
- Never use color as the sole indicator of meaning
- All layout measurements use rem units, never px

### Sizing Units

- `rem` for all text, padding, margin, and layout that should scale with text size
- `px` only for borders (1px, 2px) and focus outlines (3px)
- Never use `px` for font-size, padding, or height/width on content elements

---

## Git Workflow

### Commit Message Format

Follow the Conventional Commits specification exactly.

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

**Types:**
- `feat` — a new feature or Tool
- `fix` — a bug fix
- `docs` — documentation changes only
- `style` — formatting, missing semicolons, whitespace — no logic change
- `refactor` — code change that neither fixes a bug nor adds a feature
- `perf` — performance improvement
- `test` — adding or correcting tests
- `chore` — build process, dependency updates, configuration
- `a11y` — accessibility improvements
- `sec` — security improvements

**Scope** is the Module or system affected:
`assignments`, `grading`, `communication`, `people`, `content`, `setup`,
`shell`, `api`, `storage`, `dom`, `security`, `settings`, `speedgrader`

**Examples:**
```
feat(assignments): add bulk date shift to bulk edit tool
fix(api): handle rate limit 403 response with backoff
a11y(shell): add aria-current to active sidebar tool
refactor(storage): extract migration runner to separate module
chore(deps): update @tanstack/react-virtual to 3.2.0
docs(assignments): update bulk edit design document
sec(security): add PIN lockout after 4 failed attempts
```

**Summary line rules:**
- 50 characters maximum
- Lowercase after the colon
- No period at the end
- Imperative mood — "add" not "added", "fix" not "fixed"

### Branch Naming

```
feature/<scope>/<short-description>
fix/<scope>/<short-description>
refactor/<scope>/<short-description>
docs/<description>
chore/<description>
```

Examples:
```
feature/assignments/bulk-date-shift
fix/api/rate-limit-backoff
a11y/shell/sidebar-keyboard-navigation
docs/update-roadmap
```

### When to Commit

Commit at every logical stopping point — not just when a feature is
complete. A good commit answers the question "what changed and why?" If
you cannot describe the change in one short summary line, the commit
is too large.

**Always commit before:**
- Switching to a different file or system
- Taking a break
- Running a test that might reveal the current state is wrong
- Attempting a refactor

**Never commit:**
- Broken code that does not run
- Commented-out blocks of old code
- console.log statements
- Merge conflicts markers
- Changes to multiple unrelated systems in one commit

### Branch Strategy

- `main` — production-ready code only. Never commit directly to main.
- `develop` — integration branch. Features merge here first.
- Feature branches — cut from `develop`, merge back to `develop` via PR.
- Releases — cut from `develop` when a version is ready, merge to `main`.

### Pull Requests

Every merge to `develop` goes through a pull request, even when working
alone. PRs create a record of why a change was made, not just what changed.

PR description must include:
- What changed
- Why it changed
- How to test it
- Any design document updated

### Bug Tracking with GitHub CLI

All bugs are tracked as GitHub issues. Always use the `gh` CLI — never
create or manage issues through the GitHub web UI or any other tool.

**Creating a bug:**
```
gh issue create --title "fix(scope): short description" --label bug --body "$(cat <<'EOF'
## Steps to reproduce
1.
2.

## Expected behavior

## Actual behavior

## Notes
EOF
)"
```

**Listing open bugs:**
```
gh issue list --label bug --state open
```

**Viewing a specific bug:**
```
gh issue view <number>
```

**Closing a bug when fixed:**
```
gh issue close <number> --comment "Fixed in <commit-sha> — <one-line summary>"
```

**Linking a commit to an issue:**
Include `Closes #<number>` or `Fixes #<number>` in the commit body so
GitHub closes the issue automatically when the commit lands on the default branch.

**Rules:**
- Every bug discovered during development gets a GitHub issue before work begins on the fix.
- If a bug is found and deferred, label it `deferred` and leave a comment explaining why.
- Do not close an issue until the fix is committed and verified.

---

## Security Rules

These are non-negotiable. Violating them requires explicit documented
justification.

1. The API token is always retrieved from encrypted storage immediately
   before use. It is never stored in React state, a JavaScript variable,
   or anywhere outside chrome.storage.local.

2. No student PII (names, grades, emails, IDs) is ever written to
   chrome.storage.local or chrome.storage.sync. It is fetched on demand
   and discarded.

3. No disability data, accommodation reason, or sensitive student
   information is stored anywhere in the extension under any circumstances.

4. Every write operation to Canvas is gated by the PIN system
   (usePinGate hook) and logged to the audit log.

5. No data is transmitted to any server other than the teacher's own
   Canvas instance, except for the optional anonymous telemetry payload
   which contains no PII and is documented in Doc 06.

6. No external scripts, CDNs, or third-party resources are loaded at
   runtime. All dependencies are bundled at build time.

---

## Privacy Rules

1. No analytics libraries. No tracking. No error reporting services that
   transmit user data. The only external data transmission is Canvas API
   calls and optional anonymous telemetry.

2. The privacy policy (PRIVACY.md) must be updated whenever a new category
   of data is stored or transmitted.

3. chrome.storage.sync holds only settings and lightweight indexes —
   never full content with potentially sensitive data.

---

## Canvas API Rules

1. All Canvas API calls go through the request wrapper in `src/api/request.js`.
   No feature code makes raw fetch calls.

2. Every API response is mapped to an internal data shape before being
   used in UI code. Raw Canvas API shapes never reach components.

3. Pagination is handled by `canvasGetAll()`. Never assume a single API
   response contains all results.

4. Rate limit errors (403) are handled by the request queue automatically.
   Feature code does not need to handle rate limiting.

5. The Canvas API uses ISO 8601 UTC timestamps. Always convert to local
   time for display and back to UTC for writes.

---

## Accessibility Rules

1. WCAG 2.1 AA compliance is required for every shipped feature.

2. All layout uses rem units. Never px for text, padding, or content sizing.

3. Every interactive element is keyboard accessible — reachable by Tab,
   operable by Enter or Space.

4. All text meets 4.5:1 contrast ratio. Verify with a contrast checker
   before shipping any new color combination.

5. Test every feature with keyboard-only navigation before marking it done.

6. Run axe DevTools on every Tool before shipping. Resolve all critical
   and serious violations.

---

## What Claude Should Always Do

- Read the relevant design document before writing any feature code
- Follow Conventional Commits format for every suggested commit message
- Use rem units for all sizing — never px for content
- Reference CSS custom properties for colors, not Tailwind color classes
- Gate write operations with usePinGate and log to the audit log
- Map Canvas API responses to internal shapes before using them in UI code
- Handle loading, empty, and error states for every data-fetching operation
- Add aria attributes to every interactive element
- Write functions that do one thing
- Name things clearly — never abbreviate unless the abbreviation is universal
- Create a GitHub issue with `gh issue create` before fixing any discovered bug
- Close GitHub issues with `gh issue close` only after the fix is committed and verified

## What Claude Should Never Do

- Write raw fetch calls to Canvas outside of src/api/
- Store the API token anywhere outside chrome.storage.local
- Store student PII in any form of persistence
- Use px units for font-size, padding, margin, or content sizing
- Introduce a new npm dependency without flagging it for discussion
- Write TypeScript — this project uses JavaScript ES6+
- Use class components in React
- Use array indexes as React list keys
- Add console.log to production code
- Write a commit that covers more than one logical change
- Commit directly to main or develop without a pull request
- Hardcode hex color values in components — use CSS custom properties
