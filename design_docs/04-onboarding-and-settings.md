# Canvas Power Tools — 04: Onboarding and Settings

---

## Onboarding Flow Overview

The onboarding flow runs automatically the first time the extension is
installed, detected by meta.setupComplete being false or absent in storage.

It accomplishes four things:
1. Orient — tell the teacher what the extension does
2. Collect — Canvas URL and API token
3. Verify — confirm the token works before proceeding
4. Complete — set setupComplete flag and route to first feature

The flow must feel fast and trustworthy. A teacher who just installed an
unknown extension is already slightly skeptical. Every screen reinforces that
this is a safe, professional, privacy-respecting tool.

Total time to complete: approximately 2 minutes.

---

## Onboarding Screen 1 — Welcome

```
                    [Logo]
                Canvas Power Tools

        A faster way to manage your Canvas courses.

  Bulk edit assignments, manage grades, organize groups —
  all in one place, without the Canvas runaround.

            Your data never leaves your browser.

                    [Get Started]

                  Takes about 2 minutes.
```

### Design Notes

"Your data never leaves your browser" is displayed prominently — not in fine
print. Privacy is a feature, not a disclaimer.

"Takes about 2 minutes" sets expectations and reduces abandonment. Teachers
are busy. Knowing it is short matters.

No navigation options on this screen. The only action is Get Started.

---

## Onboarding Screen 2 — Canvas URL

```
Step 1 of 3

Where is your Canvas?

Enter your institution's Canvas URL.

[https://                                              ]

Not sure? Log into Canvas and copy the URL from your
browser — use everything up to and including .com

Examples:
https://yourschool.instructure.com
https://canvas.yourschool.edu

                              [Back]    [Continue]
```

### Validation Before Continue

- URL must begin with https://
- URL must be a syntactically valid URL
- A lightweight ping is sent to confirm the URL responds and looks like a
  Canvas instance (checks for a Canvas-specific response header or endpoint)
- If the ping fails, a warning is shown: "This URL does not appear to be a
  Canvas instance. Double-check the address and try again."

Continue is disabled until validation passes.

---

## Onboarding Screen 3 — API Token

This is the most critical screen. The embedded tutorial removes the need for
the teacher to hunt for documentation in another tab.

```
Step 2 of 3

Connect your Canvas account

Canvas Power Tools needs an API token to interact with
your courses. This token is stored only on your device
and is never shared with anyone.

How to generate your token:    [Show me  ▼]

┌────────────────────────────────────────────────────────────┐
│  1. Open Canvas and go to Account > Settings               │
│  2. Scroll down to Approved Integrations                   │
│  3. Click New Access Token                                 │
│  4. Enter "Canvas Power Tools" as the purpose              │
│  5. Set expiry to the end of your school year              │
│     (recommended — regenerate each year at setup)          │
│  6. Click Generate Token                                   │
│  7. Copy the token — it is only shown once                 │
└────────────────────────────────────────────────────────────┘

Recommended: Set your token to expire at the end of your
school year. This limits risk if your token is ever
compromised. You can generate a new one at the start of
each school year in under a minute.

Paste your token here:
[                                              ]    [Paste]

                              [Back]    [Verify Token]
```

### Tutorial Behavior

The "Show me" section is collapsed by default. Teachers who already know how to
generate a token skip past it. First-time users expand it inline.

The tutorial is static instructional text — it does not open Canvas or
automate anything.

### Token Expiry Guidance

The recommendation to set expiry to end of school year is shown both inside
the tutorial steps and as a separate callout below. The teacher makes their own
choice — the extension does not enforce an expiry or validate whether one was
set.

### Paste Button

The Paste button calls navigator.clipboard.readText() and fills the token
field automatically. Convenience for teachers on devices where right-click
paste is awkward.

### Verify Token Button

Sends the token and URL to the verification step. Does not write anything to
storage yet — storage write happens only after successful verification.

---

## Onboarding Screen 4a — Verifying

```
Step 3 of 3

Verifying your token...

[Spinner / progress indicator]
```

Simple holding screen shown while the verification API call is in flight.
Calls GET /api/v1/users/self using the provided token and URL.

---

## Onboarding Screen 4b — Verification Failed

```
Step 3 of 3

Could not verify your token.

This is usually caused by one of the following:

  - The token was not copied completely
  - The token has expired or been revoked by your institution
  - Your Canvas URL may be incorrect

                          [Back]    [Try Again]
```

Back returns to Screen 3 with the token field cleared and the URL intact.
Try Again re-runs verification with the current values without going back.

The error list is specific, not generic. "Something went wrong" is not
acceptable — teachers need to know what to check.

---

## Onboarding Screen 4c — Verification Succeeded

```
Step 3 of 3

Connected successfully.

Logged in as:   Jane Smith
Institution:    Springfield University

                                      [Continue]
```

The teacher's name and institution are pulled from the GET /api/v1/users/self
response. Showing this is a strong trust signal — it confirms the right account
is connected before proceeding.

This screen also triggers the storage write:
- account.canvasUrl saved
- account.apiToken saved (encrypted with crypto.subtle)
- account.lastVerified set to current timestamp
- account.verificationStatus set to "valid"
- meta.setupComplete set to true

---

## Onboarding Screen 5 — Setup Complete

```
                    [Logo]

            You are all set, Jane.

    Canvas Power Tools is ready to use.

  Start with the Bulk Assignment Editor — select a
  course and make your first bulk edit in under
  a minute.

          [Open Canvas Power Tools]

               [Go to Settings]
```

The teacher's first name from the verified account is used. Personalizes the
completion screen and confirms the right person is set up.

Two paths forward:
- Open Bulk Assignment Editor — goes directly to the first feature
- Go to Settings — for teachers who want to configure preferences first

---

## Token Failure Warning

If at any point after setup the extension detects the token is no longer valid
— either through a periodic background check or through a failed API call
during normal use — a non-blocking warning is shown:

```
Connection Problem

Your Canvas API token is no longer valid. This may be
because it expired or was revoked by your institution.

Your settings, templates, and change log are preserved.

                    [Dismiss]    [Redo Setup]
```

Redo Setup launches the re-onboarding flow with the Canvas URL pre-filled.
The teacher only needs to generate and paste a new token.

Dismiss closes the warning. The teacher can continue using cached data but
any action that requires an API call will fail with a contextual error until
the token is fixed.

---

## Re-Onboarding Flow

Accessible from Settings via Redo Setup. Streamlined compared to full
onboarding — the teacher has done this before.

```
Reconnect Canvas Power Tools

Your Canvas URL
[https://springfield.instructure.com          ]    (pre-filled, editable)

New API Token
[                                              ]    [Paste]

Need help finding your token?    [Show instructions  ▼]

┌────────────────────────────────────────────────────────────┐
│  1. Open Canvas and go to Account > Settings               │
│  2. Scroll down to Approved Integrations                   │
│  3. Click New Access Token                                  │
│  ...                                                       │
│                                                            │
│  Still confused?  [View full setup guide →]                │
└────────────────────────────────────────────────────────────┘

                          [Cancel]    [Verify Token]
```

Instructions are collapsed by default. "View full setup guide" links to a
help page hosted in the GitHub repository docs folder.

---


### Navigation Preferences

Settings includes a section for navigation defaults — which Module and Tool
open by default when the extension launches, and whether the sidebar starts
expanded or collapsed. These preferences are stored in sessionState within
chrome.storage.local.

## Settings Page

### Purpose

The Settings page is the central configuration hub. It stores and manages
the API token, behavioral preferences, data, and extension information.

### Sections

**Account**
**Preferences**
**Data**
**About**

---

## Settings — Account Section

```
ACCOUNT

Canvas URL
[https://springfield.instructure.com          ]

API Token
[**********************************]    [Reveal]    [Edit]

Status:   Connected — Last verified Oct 1, 2025      [Verify Now]
```

### Canvas URL

Editable. Changing it triggers a re-verification against the new URL.

### API Token Display

Token is masked by default. Reveal shows it in plain text temporarily.
Edit clears the field and allows pasting a new token, followed by
re-verification.

### Verification Status

Shows one of:
- Connected — Last verified [date]  (green)
- Verification failed — [Redo Setup]  (red)
- Never verified  (yellow)

Verify Now manually triggers a GET /api/v1/users/self call and updates
the status and lastVerified timestamp.

---

## Settings — Preferences Section

```
PREFERENCES

Date Shifting
Shift all date fields together by default
[ Toggle: ON / OFF ]

When ON, shifting the Due Date in the Bulk Editor automatically
mirrors the same shift value to Available From and Available Until.
This can be overridden per session in the Bulk Editor.

Default Course
Open the Bulk Editor to:
  ○ Last used course
  ○ Always ask
```

### Future Preferences

Additional preferences will be added here as new features are built. Each
feature contributes its own preference entry to this section. All preferences
are global — they apply across all courses. Per-course preference overrides
may be considered in a future version once there is enough feature coverage
to understand what would benefit from it.

---

## Settings — Data Section

```
DATA

Change Log
Storing 23 entries across 4 courses
[Clear All Logs]

Templates
14 templates across 3 folders
[Manage Templates →]

Storage Used
chrome.storage.local:   31 KB of 5 MB used
chrome.storage.sync:    12 KB of 100 KB used
```

### Clear All Logs

Destructive action. Requires confirmation:
"Clear all change logs? This cannot be undone and you will lose the ability
to revert any previous changes."

Two buttons: Cancel and Clear All Logs.

### Storage Display

Shows both local and sync storage usage. Gives teachers confidence that the
extension is not quietly accumulating large amounts of data. The 5 MB local
limit and 100 KB sync limit are Chrome platform constraints.

---

## Settings — About Section

```
ABOUT

Canvas Power Tools   v1.0.0
License              MIT Open Source
Source Code          [View on GitHub →]
Privacy Policy       [View →]
Help & Tutorial      [View →]
```

Version number is important for support conversations and bug reports. The
GitHub link is prominent — reinforcing the open source and transparent nature
of the extension.

---

## Storage Written by Settings

Settings writes to chrome.storage.local and chrome.storage.sync:

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
