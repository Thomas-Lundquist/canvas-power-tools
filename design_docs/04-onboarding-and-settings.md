# Canvas Power Tools — 04: Onboarding and Settings

---

## Onboarding Flow Overview

The onboarding flow runs automatically the first time the extension is installed, detected by `meta.setupComplete` being false or absent in storage.

It accomplishes four things:
1. Orient — tell the teacher what the extension does
2. Collect — Canvas URL and API token
3. Verify — confirm the token works before proceeding
4. Complete — set `setupComplete` flag and route to first feature

The flow must feel fast and trustworthy. A teacher who just installed an unknown extension is already slightly skeptical. Every screen reinforces that this is a safe, professional, privacy-respecting tool.

Total time to complete: approximately 2 minutes.

---

## Onboarding Screen 1 — Welcome

**Content:**
- App name and logo
- "A faster way to manage your Canvas courses."
- Brief value statement: bulk edit assignments, manage grades, organize groups — all in one place
- "Your data never leaves your browser." — displayed prominently, not in fine print. Privacy is a feature, not a disclaimer.
- "Takes about 2 minutes." — sets expectations and reduces abandonment
- Single action: Get Started

No navigation options on this screen. The only action is Get Started.

---

## Onboarding Screen 2 — Canvas URL

**Content:**
- Step indicator: Step 1 of 3
- Heading: "Where is your Canvas?"
- Instruction text explaining what to enter
- URL input field pre-filled with `https://`
- Helper text explaining how to find the URL
- Example URLs

**Validation before Continue:**
- URL must begin with `https://`
- URL must be a syntactically valid URL
- A lightweight ping confirms the URL responds and looks like a Canvas instance (checks for a Canvas-specific response header or endpoint)
- If the ping fails: "This URL does not appear to be a Canvas instance. Double-check the address and try again."

Continue is disabled until validation passes.

---

## Onboarding Screen 3 — API Token

This is the most critical screen. The embedded tutorial removes the need for the teacher to hunt for documentation in another tab.

**Content:**
- Step indicator: Step 2 of 3
- Heading: "Connect your Canvas account"
- Explanation of what the token is, that it is stored only on the device, never shared
- Collapsible "How to generate your token" tutorial with these steps:
  1. Open Canvas and go to Account > Settings
  2. Scroll down to Approved Integrations
  3. Click New Access Token
  4. Enter "Canvas Power Tools" as the purpose
  5. Set expiry to the end of your school year (recommended)
  6. Click Generate Token
  7. Copy the token — it is only shown once
- Recommendation to set token expiry to end of school year
- Token paste field
- Paste button (calls `navigator.clipboard.readText()`)
- Back and Verify Token actions

**Tutorial behavior:** Collapsed by default. Teachers who already know how to generate a token skip past it. First-time users expand it inline. Static instructional text — does not open Canvas or automate anything.

**Verify Token:** Sends the token and URL to the verification step. Does not write anything to storage yet — storage write happens only after successful verification.

---

## Onboarding Screen 4a — Verifying

- Step indicator: Step 3 of 3
- Heading: "Verifying your token..."
- Spinner/progress indicator

Simple holding screen while the verification API call is in flight. Calls `GET /api/v1/users/self` using the provided token and URL.

---

## Onboarding Screen 4b — Verification Failed

**Content:**
- Step indicator: Step 3 of 3
- Heading: "Could not verify your token."
- Specific failure reasons (not generic):
  - The token was not copied completely
  - The token has expired or been revoked by your institution
  - Your Canvas URL may be incorrect
- Back and Try Again actions

Back returns to Screen 3 with the token field cleared and the URL intact. Try Again re-runs verification with the current values without going back.

---

## Onboarding Screen 4c — Verification Succeeded

**Content:**
- Step indicator: Step 3 of 3
- Heading: "Connected successfully."
- Teacher's name and institution from `GET /api/v1/users/self` response — strong trust signal confirming the right account is connected
- Continue action

**Storage write on this screen:**
- `account.canvasUrl` saved
- `account.apiToken` saved (encrypted with `crypto.subtle`)
- `account.lastVerified` set to current timestamp
- `account.verificationStatus` set to `"valid"`
- `meta.setupComplete` set to `true`

---

## Onboarding Screen 5 — Setup Complete

**Content:**
- Logo
- "You are all set, [first name]." — uses teacher's first name from the verified account
- Brief next-step suggestion pointing to the Bulk Assignment Editor
- Two paths forward:
  - Open Canvas Power Tools — goes directly to the first feature
  - Go to Settings — for teachers who want to configure preferences first

---

## Token Failure Warning

If at any point after setup the extension detects the token is no longer valid — through a periodic background check or through a failed API call during normal use — a non-blocking warning is shown:

**Content:**
- Heading: "Connection Problem"
- Explanation that the API token is no longer valid (expired or revoked by institution)
- Confirmation that settings, templates, and change log are preserved
- Dismiss and Redo Setup actions

Redo Setup launches the re-onboarding flow with the Canvas URL pre-filled. The teacher only needs to generate and paste a new token.

Dismiss closes the warning. The teacher can continue using cached data but any action requiring an API call will fail with a contextual error until the token is fixed.

---

## Re-Onboarding Flow

Accessible from Settings via Redo Setup. Streamlined — the teacher has done this before.

**Content:**
- Canvas URL field pre-filled and editable
- New API Token field with Paste button
- Collapsible instructions (collapsed by default)
- Link to full setup guide in GitHub docs
- Cancel and Verify Token actions

---

## Settings Page

### Purpose

The Settings page is the central configuration hub. It stores and manages the API token, behavioral preferences, data, and extension information.

### Sections

- Account
- Preferences
- Data
- About

---

## Settings — Account Section

**Fields:**
- Canvas URL (editable; changing triggers re-verification)
- API Token (masked by default; Reveal shows plain text temporarily; Edit clears and allows pasting a new token, followed by re-verification)
- Verification status: Connected (with last-verified date), Verification failed (with Redo Setup action), or Never verified
- Verify Now button (manually triggers `GET /api/v1/users/self` and updates status and `lastVerified` timestamp)

---

## Settings — Preferences Section

**Current preferences:**

**Date Shifting toggle** — When ON, shifting the Due Date in the Bulk Editor automatically mirrors the same shift value to Available From and Available Until. Can be overridden per session in the Bulk Editor.

**Default Course** — Open the Bulk Editor to: Last used course, or Always ask.

**Navigation defaults** — Which Module and Tool open by default when the extension launches, and whether the sidebar starts expanded or collapsed. Stored in `sessionState` within `chrome.storage.local`.

Additional preferences will be added here as new features are built. Each feature contributes its own preference entry. All preferences are global — they apply across all courses.

---

## Settings — Data Section

**Displays:**
- Change Log: number of entries stored across courses, with a Clear All Logs action
- Templates: count of templates and folders, with a link to Manage Templates
- Storage used: both `chrome.storage.local` and `chrome.storage.sync` usage shown

**Clear All Logs** is a destructive action and requires confirmation: "Clear all change logs? This cannot be undone and you will lose the ability to revert any previous changes." Two buttons: Cancel and Clear All Logs.

---

## Settings — About Section

**Displays:**
- App name and version number (important for support conversations and bug reports)
- License (MIT Open Source)
- Link to source code on GitHub
- Link to Privacy Policy
- Link to Help & Tutorial

---

## Storage Written by Settings

```javascript
// Account changes
account.canvasUrl = newUrl
account.apiToken = encrypt(newToken)
account.lastVerified = new Date().toISOString()
account.verificationStatus = "valid"

// Preference changes
preferences.shiftAllDatesTogether = true | false
preferences.defaultCourse = "last_used" | "ask"
```

All writes use the write strategy: update sync first, then refresh local cache.
