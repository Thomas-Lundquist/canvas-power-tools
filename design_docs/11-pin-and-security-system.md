## Context

The PIN and Security System is not a Module or Tool — it is infrastructure
that runs beneath every Module. It ships early because retrofitting
security onto features that touch student data would be significantly
harder than building it first. Every subsequent feature that writes to Canvas
uses the PIN gate Component without any additional security design work.

---

# Canvas Power Tools — 11: PIN and Security System

---

## Overview

The PIN system ships before any high-stakes write
operations exist. Building it into the foundation means every
feature that affects student data — grades, overrides, messages — can
enforce it immediately rather than retrofitting security later.

The core problem it solves: the API token proves the extension is connected
to a specific Canvas account, but it does not prove the person at the keyboard
right now is that teacher. A student using a teacher's unlocked computer, a
substitute teacher, or a family member at home could all access the extension
and make changes to Canvas on the teacher's behalf.

---

## Threat Model

Scenarios the PIN system defends against:

| Scenario | Risk | Mitigated By |
|---|---|---|
| Student uses teacher's unlocked classroom computer | Unauthorized grade or assignment changes | PIN required for all write operations |
| Substitute teacher has access to the machine | Unintended changes to course structure | PIN lock on inactivity |
| Teacher's computer left unlocked at home | Family member accesses extension | Inactivity timeout |
| Teacher shares computer with another staff member | Cross-account confusion | PIN is teacher-specific |

---

## PIN Setup — During Onboarding

PIN setup is added as a final optional step in the onboarding flow, after
token verification succeeds.

```
Setup Complete — One More Thing

Would you like to set up a PIN to protect write operations?

A PIN prevents anyone else who uses this computer from
making changes to Canvas through Canvas Power Tools.

Recommended for shared or classroom computers.

[Set Up PIN]    [Skip for Now]

You can always enable this later in Settings.
```

### PIN Creation Screen

```
Create Your PIN

Enter a 4 to 6 digit PIN.

[  ][  ][  ][  ]     (4 digit minimum, 6 digit maximum)

Confirm PIN:
[  ][  ][  ][  ]

This PIN is stored encrypted on this device.
It cannot be recovered if forgotten.
You will need to reset the extension to clear it.

                          [Cancel]    [Set PIN]
```

PIN is hashed using SHA-256 before storage. The plain text PIN is never
stored anywhere.

---

## PIN Storage

```javascript
// PIN is stored as a SHA-256 hash, never plain text
// Stored in chrome.storage.local under a dedicated key

{
  security: {
    pinHash: "sha256_hash_of_pin",
    pinEnabled: true,
    inactivityTimeoutMinutes: 30,
    lastActiveTimestamp: "2025-10-01T14:32:00Z",
    requirePinOnEveryWrite: false
  }
}
```

---

## When PIN Is Required

The PIN is required in two modes, configurable in Settings:

**Mode 1 — On Inactivity (default)**
The extension locks after a configurable period of inactivity. Any write
operation attempted after lockout requires PIN entry.

**Mode 2 — On Every Write**
Every write operation requires PIN entry regardless of recent activity.
For teachers who want maximum security on shared computers.

### Inactivity Detection

Activity is tracked via mouse and keyboard events on the extension shell.
The last active timestamp is updated every 60 seconds while the teacher
is active. On any write attempt, the current time is compared against
lastActiveTimestamp. If the difference exceeds the timeout setting,
the PIN prompt appears.

```javascript
function isSessionLocked() {
  const { lastActiveTimestamp, inactivityTimeoutMinutes } = getSecuritySettings()
  const elapsed = Date.now() - new Date(lastActiveTimestamp).getTime()
  return elapsed > inactivityTimeoutMinutes * 60 * 1000
}
```

---

## PIN Prompt — Write Operation Gate

Appears before any operation that writes data to Canvas. The teacher
cannot proceed without entering the correct PIN.

```
┌─────────────────────────────────────────────────────────────────┐
│  Enter Your PIN                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  You are about to apply changes to Canvas.                      │
│  Enter your PIN to continue.                                    │
│                                                                 │
│  [  ][  ][  ][  ]                                               │
│                                                                 │
│  Forgot your PIN?  [Reset Extension]                            │
│                                                                 │
│                          [Cancel]    [Confirm]                  │
└─────────────────────────────────────────────────────────────────┘
```

### Failed Attempts

```
Attempt 1-2:  Try again. [X attempts remaining]
Attempt 3:    Warning: One more failed attempt will lock
              the extension for 15 minutes.
Attempt 4:    Extension locked. Try again in 15 minutes.
              [Contact support]
```

Lockout duration doubles with each subsequent lockout in the same session:
15 minutes, 30 minutes, 60 minutes. This prevents brute force attempts.

---

## PIN Reset

If a teacher forgets their PIN, there is no recovery — the hash cannot be
reversed. The reset option clears the PIN and requires the teacher to set
a new one. It does not clear any other data — templates, change log, and
settings are all preserved.

```
Reset PIN

Resetting your PIN will require you to create a new one.
Your templates, settings, and change log are not affected.

                      [Cancel]    [Reset PIN]
```

After reset, the teacher is immediately prompted to create a new PIN.

---

## Audit Log

Every write operation — whether PIN-protected or not — is logged in a local
audit log. This is always active regardless of whether the PIN is enabled.

### Audit Log Entry Structure

```javascript
{
  id: "audit_1696339200000",
  timestamp: "2025-10-01T14:32:00Z",
  action: "bulk_edit" | "template_deploy" | "grade_change" |
          "accommodation_override" | "message_sent" | "revert",
  summary: "Changed due dates on 5 assignments in Biology 101",
  courseId: "12345",
  courseName: "Biology 101 — Fall 2025",
  pinVerified: true,
  details: { ...action-specific detail object }
}
```

### Audit Log UI

Accessible from Settings under the Security section.

```
┌─────────────────────────────────────────────────────────────────┐
│  Audit Log                                [Export]   [Clear]    │
├─────────────────────────────────────────────────────────────────┤
│  Oct 1, 2:32 PM   Bulk edit     Biology 101                     │
│  Changed due dates on 5 assignments        PIN verified  [▼]    │
│                                                                 │
│  Oct 1, 11:20 AM  Template deploy  Biology 101                  │
│  Created "Weekly Quiz" in 2 courses        PIN verified  [▼]    │
│                                                                 │
│  Sep 30, 4:10 PM  Revert        Chemistry 202                   │
│  Reverted 3 changes from Sep 30            PIN verified  [▼]    │
└─────────────────────────────────────────────────────────────────┘
```

Export generates a plain text file of the log for the teacher's records.
Retention: last 50 entries. Cannot be disabled.

---

## High-Stakes Operations — Extra Confirmation

Certain operations are flagged as high-stakes and receive an additional
confirmation layer on top of the standard preview screen, regardless of PIN
settings.

| Operation | Extra Confirmation |
|---|---|
| Grade missing as zero across entire class | "This will set [N] students to zero. This cannot be undone via revert if grades have been synced to your SIS." |
| Send message to all students in a course | Recipient count prominently displayed. 5-second delay before Send button activates |
| Apply accommodation override to student | Clear display of student name and all assignments being overridden |
| Delete all change logs | Separate confirmation with typed acknowledgment |

The typed acknowledgment pattern for destructive actions:
```
Type DELETE to confirm clearing all change logs:
[                    ]
[Cancel]    [Clear All Logs]
```

---

## Settings — Security Section

Added to the Settings page between Account and Preferences sections.

```
SECURITY

PIN Protection
Enable PIN for write operations
[ Toggle: ON / OFF ]

Require PIN:
  ○ After inactivity timeout
  ○ Before every write operation

Inactivity Timeout
Lock after:  [15 min | 30 min | 1 hour | 4 hours | Never]
Default: 30 minutes

Change PIN                                      [Change PIN]
Reset PIN (if forgotten)                        [Reset PIN]

Audit Log
View a record of all changes made through
Canvas Power Tools on this device.              [View Audit Log]

Last action: Oct 1, 2025 at 2:32 PM
Total logged actions: 47
```

---

## Operations Requiring PIN — Complete List

This list grows as new features ship. Every new feature that writes
to Canvas must declare whether it is PIN-gated.

### Built
- Apply bulk assignment changes
- Revert change log entry
- Apply grade changes (curving, scaling, missing zeros)
- Send student messages or nudges
- Apply accommodation date overrides
- Create or modify groups
- Deploy template to courses
- Apply rubric to assignment

### Planned
- Fire conditional assignment rules manually
- Execute semester rollover
- Import QTI quiz content

---

## Implementation Notes

The PIN gate is implemented as a React hook that any component can call
before a write operation. This keeps the gate logic in one place rather
than duplicated across every feature.

```javascript
// src/security/usePinGate.js

export function usePinGate() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)

  async function requirePin(action) {
    if (!isPinEnabled()) {
      await action()
      return
    }

    if (!isSessionLocked()) {
      await action()
      return
    }

    // Session is locked — show PIN prompt
    setPendingAction(() => action)
    setShowPrompt(true)
  }

  async function onPinVerified() {
    setShowPrompt(false)
    refreshLastActiveTimestamp()
    if (pendingAction) await pendingAction()
    setPendingAction(null)
  }

  return { requirePin, showPrompt, onPinVerified }
}

// Usage in any component:
const { requirePin } = usePinGate()

async function handleApplyChanges() {
  await requirePin(async () => {
    // actual write operation
    await bulkUpdateAssignments(courseId, changes)
    logToAuditLog('bulk_edit', summary)
  })
}
```
