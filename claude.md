# Canvas Power Tools — CLAUDE.md

## What This Project Is

Canvas Power Tools is a Chrome MV3 extension giving teachers a faster interface for Canvas LMS. Each Tool is a separate extension page; a homepage acts as the tool picker. Navigation is a full page transition via `chrome.runtime.getURL()`. A shared `AppNav` component provides header navigation across all pages.

This is a real product for Chrome Web Store release. Code quality, accessibility, security, and privacy are non-negotiable.

---

## Design Documents

Read the relevant doc before writing any feature code. Never guess at a documented design decision.

| Document | Contents |
|---|---|
| 01-project-overview.md | Architecture, storage schema, file structure, tech stack, distribution |
| 02-bulk-assignment-editor.md | Assignments → Bulk Edit Tool |
| 03-assignment-templates.md | Assignments → Templates Tool |
| 04-onboarding-and-settings.md | Onboarding and Settings page |
| 05-roadmap.md | Feature roadmap by version |
| 06-technical-infrastructure.md | API layer, storage migration, virtual scrolling, DOM resilience |
| 08-settings-reference.md | Settings schema and storage structure |
| 09-dev-environment.md | Development environment setup |
| 10-ui-standards-and-patterns.md | UI standards, accessibility, design system, color palette |
| 11-pin-and-security-system.md | PIN gate, audit log, security architecture |
| 12-speedgrader-suite.md | SpeedGrader injected components |
| 13-accommodation-override-manager.md | People → Accommodations Tool |
| 14-communication-tools.md | Communication Module |
| 15-feature-designs.md | Feature designs: Grading, People, and other tools |
| 16-popup-window-delivery.md | Deferred: popup window delivery |

---

## Terminology

Never substitute page/screen/section/view for these terms.

- **Module** — top-level sidebar section (Assignments, Grading, Communication, People, Content, Setup)
- **Tool** — individual feature within a Module (Bulk Edit, Templates, Rubrics)
- **Component** — reusable UI/logic element (PreviewDiff, Toast, MultiSelect, PinPrompt)

---

## Tech Stack

| Technology | Notes |
|---|---|
| JavaScript ES6+ | **No TypeScript** — do not introduce without discussion |
| React | Functional components + hooks only |

Do not introduce new dependencies without discussion.

---

## Naming Conventions


- React components: PascalCase, filename matches (`BulkEdit.jsx`)
- Utility modules: camelCase (`auth.js`, `request.js`)
- CSS custom properties: `--color-`, `--space-`, `--text-` prefixes
- Storage keys: camelCase (`changeLogs`, `domLog`)

---

## Coding Standards

- No `console.log` in production — use the logging utility
- Default exports for React components; named exports for utilities

**Tailwind / CSS:** Use CSS custom properties for all colors, text sizes, and spacing — not raw Tailwind color classes.
```
className="bg-[var(--color-surface)] text-[var(--color-text-body)]"
```

**Units:** `rem` for all text, padding, margin, and layout. `px` only for borders (1–2px) and focus outlines (3px). Never `px` for font-size or content sizing.

**Accessibility (WCAG 2.1 AA required):**
- Every interactive element keyboard accessible (Tab to reach, Enter/Space to activate)
- Icons: `aria-label` or `aria-hidden` with visible text
- Modals: `role="dialog" aria-modal="true" aria-labelledby`; trap focus; restore on close
- Dynamic content in `aria-live` region
- Virtual scroll tables: `aria-rowcount` + `aria-rowindex`
- 4.5:1 contrast ratio minimum; never color as the sole indicator of meaning
- `:focus-visible` for focus rings, not `:focus`

---

## Git Workflow

**Commit format:** `<type>(<scope>): <summary>` — 50 char max, lowercase, no period, imperative mood

Types: `feat` `fix` `docs` `style` `refactor` `perf` `test` `chore` `a11y` `sec`

Scopes: `assignments` `grading` `communication` `people` `content` `setup` `shell` `api` `storage` `dom` `security` `settings` `speedgrader`

**Branch naming:** `feat/<scope>/<description>`, `fix/<scope>/<description>`, `refactor/<scope>/<description>`, `docs/<description>`, `chore/<description>`

**Branch strategy (solo, trunk-based):**
- `main` is the trunk and single source of truth. There is no `develop` branch.
- Each unit of work gets a **short-lived branch** cut from `main`, merged back to `main` the same day, and deleted. This keeps `main` linear and avoids long-lived divergence.
- No mandatory PRs (solo project). Commit at each completed unit with a clear message.

**Pushing:** `main` is pushed to `origin` at the **end of each work session** — offered once the work is done and verified, as the GitHub backup. Nothing is pushed without explicit approval.

---

## Security (non-negotiable)

1. API token retrieved from encrypted storage immediately before use. Never in React state, JS variables, or anywhere outside `chrome.storage.local`.
2. No student PII (names, grades, emails, IDs) written to any storage. Fetch on demand, discard after use.
3. No disability data or accommodation details stored anywhere, ever.
4. Every Canvas write gated by `usePinGate` hook and logged to audit log.
5. No external data transmission except Canvas API calls and optional anonymous telemetry (no PII, see Doc 06).
6. No external scripts or CDNs loaded at runtime. All dependencies bundled at build time.

---

## Privacy

1. No analytics, tracking, or error-reporting services. External transmission = Canvas API + optional telemetry only.
2. Update `PRIVACY.md` when any new data category is stored or transmitted.
3. `chrome.storage.sync` holds settings and indexes only — never content with sensitive data.

---

## Canvas API

1. All Canvas API calls go through `src/api/request.js`. No raw `fetch` in feature code.
2. Map every API response to an internal shape before use in UI. Raw Canvas shapes never reach components.
3. Pagination via `canvasGetAll()` — never assume one response contains all results.
4. Rate limiting handled automatically by request queue — feature code does not handle it.
5. Canvas timestamps are ISO 8601 UTC. Convert to local time for display; back to UTC for writes.

---

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:970c3bf2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

