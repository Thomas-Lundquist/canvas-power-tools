# Canvas Power Tools — 14: Communication Tools

---

## Overview

Communication Tools is a V2 feature providing two focused messaging
workflows: a Nudge Tool for students who have not submitted an assignment,
and a Grade Threshold Messenger for students above or below a grade cutoff.

These are not a general purpose messaging system. They are targeted,
context-driven communication tools that give teachers a faster path to the
specific messages they send most frequently.

---

## Security Model

Sending messages to students on a teacher's behalf is a higher-stakes
operation than editing assignment dates. The security model reflects this.

Every message operation requires:
1. PIN confirmation before sending (if PIN is enabled)
2. A mandatory preview screen showing the exact message and all recipients
3. A recipient count prominently displayed before sending
4. A 5-second delay before the Send button activates on the final confirmation
   screen — prevents accidental sends
5. A sent log stored locally showing what was sent, when, and to whom

The Canvas API token scope enforces that teachers can only message students
in their own courses. The extension adds UI-level enforcement on top of this.

---

## Sent Log

Every message sent through Communication Tools is logged locally.

```javascript
{
  id: "msg_1696339200000",
  timestamp: "2025-10-01T14:32:00Z",
  type: "nudge" | "threshold",
  assignmentId: "67890",
  assignmentName: "Quiz 1",
  courseId: "12345",
  courseName: "Biology 101 — Fall 2025",
  recipientCount: 8,
  recipients: [
    { id: "student_1", name: "Jane Smith" },
    { id: "student_2", name: "Marcus Johnson" }
  ],
  messageBody: "Hi {first_name}, just a reminder...",
  pinVerified: true
}
```

Recipients are stored because teachers frequently need to know who received
a specific message. Retention: last 50 sent log entries. Stored in
chrome.storage.local only — never in sync storage.

---

## Page Access

Accessible from the extension popup and main navigation. The page has two
tabs — Nudge Tool and Threshold Messenger.

---

## Tool 1 — Nudge Tool

### The Problem

Teachers frequently need to remind students who have not submitted an
assignment that the deadline is approaching or has passed. Currently this
requires manually finding each student in the Canvas inbox and sending
individual messages.

### What It Does

Reads submission data for a selected assignment, identifies students who
have not submitted, and sends them a personalized message in one operation.

### UI

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo] Canvas Power Tools      [Course: Biology 101 ▼]         │
├─────────────────────────────────────────────────────────────────┤
│  Communication Tools                                            │
│  [Nudge Tool]  [Threshold Messenger]                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Send a nudge for assignment:                                   │
│  [Quiz 1 — Due Oct 1                              ▼]            │
│                                                                 │
│  Students who have not submitted (8 of 28):                     │
│                                                                 │
│  [x]  Jane Smith              Missing since Oct 1               │
│  [x]  Marcus Johnson          Missing since Oct 1               │
│  [x]  Priya Patel             Missing since Oct 1               │
│  [x]  Alex Kim                Missing since Oct 1               │
│  [ ]  Jordan Cruz             Excused — skip                    │
│  [x]  Sam Rivera              Missing since Oct 1               │
│  [x]  Taylor Brooks           Missing since Oct 1               │
│  [x]  Morgan Lee              Missing since Oct 1               │
│  [x]  Casey Wang              Missing since Oct 1               │
│                                                                 │
│  Excused students are automatically deselected.                 │
│                                                                 │
│  Message:                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Hi {first_name},                                          │  │
│  │                                                           │  │
│  │ This is a reminder that {assignment_name} was due on      │  │
│  │ {due_date}. Please submit as soon as possible or reach    │  │
│  │ out if you need assistance.                               │  │
│  │                                                           │  │
│  │ {teacher_name}                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Available tokens: {first_name} {last_name} {assignment_name}  │
│                    {due_date} {teacher_name} {course_name}      │
│                                                                 │
│  Sending to: 7 students  (1 deselected)                         │
│                                                                 │
│                                    [Preview]    [Send Nudges]   │
└─────────────────────────────────────────────────────────────────┘
```

### Preview Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  Preview — Nudge Messages                         [Cancel]      │
├─────────────────────────────────────────────────────────────────┤
│  7 messages will be sent. Each is personalized per student.     │
│                                                                 │
│  Example (Jane Smith):                                          │
│  ─────────────────────────────────────────────────────────────  │
│  Hi Jane,                                                       │
│                                                                 │
│  This is a reminder that Quiz 1 was due on October 1. Please   │
│  submit as soon as possible or reach out if you need           │
│  assistance.                                                    │
│                                                                 │
│  Mr. Thomas                                                     │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Recipients:                                                    │
│  Jane Smith, Marcus Johnson, Priya Patel, Alex Kim,            │
│  Sam Rivera, Taylor Brooks, Morgan Lee, Casey Wang             │
│                                                                 │
│  ⚠ This will send 7 messages via Canvas Inbox.                  │
│    Messages cannot be unsent.                                   │
│                                                                 │
│  [PIN prompt if enabled]                                        │
│                                                                 │
│  [Cancel]              [Send in 5...]  (countdown activates)   │
└─────────────────────────────────────────────────────────────────┘
```

The countdown on the send button prevents accidental sends. The teacher
must wait 5 seconds before the button becomes active.

---

## Tool 2 — Grade Threshold Messenger

### The Problem

Teachers frequently want to reach out to students who are struggling below
a grade threshold, or recognize students performing exceptionally well above
one. Finding those students and messaging them individually is time-consuming.

### What It Does

Reads grade data for a selected assignment, identifies students above or
below a threshold, and sends them a personalized message.

### UI

```
┌─────────────────────────────────────────────────────────────────┐
│  Communication Tools                                            │
│  [Nudge Tool]  [Threshold Messenger]                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Assignment:  [Quiz 1                              ▼]           │
│                                                                 │
│  Send to students who scored:                                   │
│  ○ Below  [70] %     (or  [14]  points)                         │
│  ○ Above  [95] %     (or  [19]  points)                         │
│                                                                 │
│  Students matching (6 of 28):                                   │
│                                                                 │
│  [x]  Jane Smith              58%    11.6 / 20                  │
│  [x]  Marcus Johnson          64%    12.8 / 20                  │
│  [x]  Priya Patel             61%    12.2 / 20                  │
│  [x]  Alex Kim                52%    10.4 / 20                  │
│  [x]  Jordan Cruz             68%    13.6 / 20                  │
│  [x]  Sam Rivera              66%    13.2 / 20                  │
│                                                                 │
│  Message:                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Hi {first_name},                                          │  │
│  │                                                           │  │
│  │ I noticed you scored {score}% on {assignment_name}.       │  │
│  │ I would like to connect with you to discuss how we can    │  │
│  │ support your success going forward. Please see me during  │  │
│  │ office hours or reply to this message.                    │  │
│  │                                                           │  │
│  │ {teacher_name}                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Available tokens: {first_name} {last_name} {score} {grade}    │
│                    {assignment_name} {teacher_name} {course_name}│
│                                                                 │
│  Sending to: 6 students                                         │
│                                                                 │
│                                    [Preview]    [Send Messages] │
└─────────────────────────────────────────────────────────────────┘
```

The threshold can be entered as a percentage or as a raw point value — both
fields stay in sync. Changing one updates the other automatically.

---

## Personalization Tokens — Full Reference

| Token | Replaced With | Available In |
|---|---|---|
| {first_name} | Student's first name | Both tools |
| {last_name} | Student's last name | Both tools |
| {teacher_name} | Teacher's display name from Canvas | Both tools |
| {course_name} | Course name | Both tools |
| {assignment_name} | Assignment name | Both tools |
| {due_date} | Assignment due date | Nudge Tool |
| {score} | Student's percentage score | Threshold Messenger |
| {grade} | Student's raw point score | Threshold Messenger |
| {points_possible} | Assignment's total points | Threshold Messenger |

---

## Sent Log UI

Accessible from the Communication Tools page via a Sent Log button in
the top right.

```
┌─────────────────────────────────────────────────────────────────┐
│  Sent Log                                         [Close]       │
├─────────────────────────────────────────────────────────────────┤
│  Oct 1, 2:45 PM   Nudge   Quiz 1   Biology 101                  │
│  Sent to 7 students                               [▼ Expand]    │
│                                                                 │
│  Sep 28, 11:20 AM  Threshold   Homework 3   Biology 101         │
│  Sent to 6 students (below 70%)               [▼ Expand]        │
└─────────────────────────────────────────────────────────────────┘
```

Expanding an entry shows the full recipient list and message body.

---

## Canvas API Calls

| Action | Method | Endpoint |
|---|---|---|
| List assignments | GET | /api/v1/courses/:id/assignments |
| List submissions | GET | /api/v1/courses/:id/submissions |
| Get teacher info | GET | /api/v1/users/self |
| Send conversation message | POST | /api/v1/conversations |

The Canvas Conversations API sends a separate message per recipient. The
extension iterates through recipients and fires one API call per student.
Rate limiting is handled by the request queue in the API layer.

---

## Important Limitation

Canvas messages sent via the Conversations API arrive in students' Canvas
Inbox and trigger their normal Canvas notification settings (email, push,
etc.). They appear to come from the teacher's Canvas account. They cannot
be unsent or recalled once sent. This is stated clearly in the preview
screen.

---

## Announcements Tool

### Module Context

Announcements is the third Tool in the **Communication Module**, alongside
Nudges and Threshold. All three share the same mental model — reaching
students across courses — which is why they live together.

### The Problem

Teachers who run multiple sections of the same course must create the same
announcement individually in each Canvas course. There is no native way to
write one announcement and send it everywhere at once. Canvas also provides
no draft or scheduling functionality in its announcements interface.

### What It Does

A single interface for writing, scheduling, saving, and sending announcements
to one or more courses simultaneously. Announcement templates allow frequently
used structures — welcome messages, assignment reminders, office hours
notices — to be saved and reused.

### Announcement Template Architecture

Announcement templates use the same folder and library architecture as
assignment templates. The design is already established — this is an
extension of existing infrastructure, not new design work. Templates store
the subject line and body. They never store recipients or schedule dates,
which are set at send time.

### UI

```
┌─────────────────────────────────────────────────────────────────┐
│  Communication — Announcements          [Sent Log]  [Drafts]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Send to:                                                       │
│  [x] Biology 101 — Fall 2025                                    │
│  [x] Biology 101 — Spring 2026                                  │
│  [ ] Chemistry 202 — Fall 2025                                  │
│  [Select All]  [Deselect All]                                   │
│                                                                 │
│  Subject:                                                       │
│  [                                                   ]          │
│                                                                 │
│  Message:                                                       │
│  [                                                   ]          │
│  [                                                   ]          │
│  [                                                   ]          │
│                                                                 │
│  Schedule:                                                       │
│  ○ Send immediately                                             │
│  ○ Send on  [__________]  at  [____]                            │
│                                                                 │
│  [Load Template ▼]   [Save as Template]   [Save as Draft]       │
│                                                                 │
│  Sending to: 2 courses                                          │
│                                                                 │
│                          [Preview]    [Send Announcement]       │
└─────────────────────────────────────────────────────────────────┘
```

### Scheduling

Scheduled announcements are stored locally with their target send time.
The extension uses Chrome's alarms API (chrome.alarms) to trigger sending
at the scheduled time, provided the browser is open. A warning is displayed
at schedule time: "Scheduled announcements require your browser to be open
and the extension to be active at the scheduled send time."

If the browser is closed at the scheduled time, the announcement sends the
next time the extension is opened, with a notification that a scheduled
announcement was sent late.

### Drafts

Drafts are stored in chrome.storage.local. A Drafts button in the tool
header shows the count of saved drafts. Opening a draft pre-fills the form.
Drafts have no expiry — they persist until the teacher sends or deletes them.

### Preview Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  Preview — Announcement                           [Cancel]      │
├─────────────────────────────────────────────────────────────────┤
│  Subject:   Office Hours This Week                              │
│                                                                 │
│  Message:                                                       │
│  Office hours this week will be held on Thursday from           │
│  3-5 PM in Room 204. Please bring any questions about          │
│  the upcoming midterm.                                          │
│                                                                 │
│  Sending to:                                                    │
│  Biology 101 — Fall 2025                                        │
│  Biology 101 — Spring 2026                                      │
│                                                                 │
│  Schedule:  Immediately                                         │
│                                                                 │
│  ⚠ Announcements cannot be recalled once sent.                  │
│                                                                 │
│                          [Cancel]    [Confirm and Send]         │
└─────────────────────────────────────────────────────────────────┘
```

### Canvas API

Announcements are created via the Canvas Discussion Topics API with
is_announcement: true. One API call is made per course.

| Action | Method | Endpoint |
|---|---|---|
| Create announcement | POST | /api/v1/courses/:id/discussion_topics |

Payload includes:
```javascript
{
  title: "Subject line",
  message: "Body text",
  is_announcement: true,
  published: true,
  delayed_post_at: "ISO_timestamp_or_null"
}
```

The delayed_post_at field handles Canvas-side scheduling for announcements
sent with a future date. This is more reliable than the chrome.alarms
approach for scheduled sends, and should be used whenever the feature is
available. Chrome alarms serve as the fallback for edge cases.

---

## Tool 2b — Overall Course Grade Mode (Grade Outreach)

### The Problem

Teachers need to proactively reach out to students who are falling behind
overall — not just on one assignment — before a D or F becomes permanent.
The "By Assignment" mode addresses per-assignment concerns; this mode
addresses the student's full picture.

### What It Does

Fetches every active student's overall course grade via the Canvas
Enrollments API (with `include[]=grades`), filters by a percentage
threshold, and sends personalized messages in one operation. The messaging
flow (preview, countdown, PIN, sent log) is identical to the By Assignment
mode; only the data source and tokens differ.

### Mode Toggle

The Grade Outreach tool has a mode selector at the top of the form:
- **Score on an assignment** — existing behavior
- **Overall course grade** — this mode

### Score Type

Canvas provides two overall scores per enrollment:
- `current_score` — grade on graded work only (ignores unsubmitted assignments)
- `final_score` — treats unsubmitted as zero (more conservative)

Teachers choose which to use via a "Score type" picker in the Course card.
The default is `current_score`. For D/F outreach, `final_score` is usually
more appropriate because it reflects the impact of missing work.

Students whose score is `null` (grade not yet calculated) are silently
excluded from matching. A disclosure note shows how many were excluded.

### UI

```
┌─────────────────────────────────────────────────────────────────┐
│  Grade Outreach                                    [Sent Log]   │
├─────────────────────────────────────────────────────────────────┤
│  Filter students by:                                            │
│  ( ) Score on an assignment   (•) Overall course grade          │
├─────────────────────────────────────────────────────────────────┤
│  Course      [Biology 101 ▼]                                    │
│  Score type  (•) Current score  ( ) Final score (missing = 0)  │
├─────────────────────────────────────────────────────────────────┤
│  Send to students whose overall grade is:                       │
│  (•) below  ( ) above   [70]%                                   │
├─────────────────────────────────────────────────────────────────┤
│  Students matching (5 of 28 enrolled)                           │
│  [x]  Jane Smith          58%  (F)                              │
│  [x]  Marcus Johnson      61%  (D)                              │
│  [x]  Priya Patel         63%  (D)                              │
│  [ ]  Alex Kim            65%  (D)                              │
│  [x]  Jordan Cruz         68%  (D)                              │
│  2 students have no grade data and are excluded.                │
├─────────────────────────────────────────────────────────────────┤
│  Message                           Sending to: 4 students       │
│  Hi {first_name},                                               │
│  I'm reaching out because your current overall grade in         │
│  {course_name} is {overall_score}% ({overall_grade})...         │
│  Available tokens: {first_name}  {last_name}  {overall_score}   │
│                    {overall_grade}  {teacher_name}  {course_name}│
│                                          [Preview & Send →]     │
└─────────────────────────────────────────────────────────────────┘
```

### Personalization Tokens (Overall Mode)

| Token | Value |
|---|---|
| `{first_name}` | Student's first name |
| `{last_name}` | Student's last name |
| `{teacher_name}` | Teacher's Canvas display name |
| `{course_name}` | Course name |
| `{overall_score}` | Rounded percentage (e.g., "61") from current or final score |
| `{overall_grade}` | Letter grade (e.g., "D") from current or final grade |

### Default Message Template

```
Hi {first_name},

I'm reaching out because your current overall grade in {course_name} is {overall_score}% ({overall_grade}). I would like to connect with you to discuss how we can support your success in this course. Please see me during office hours or reply to this message.

{teacher_name}
```

### Canvas API

| Action | Method | Endpoint |
|---|---|---|
| Fetch students with grades | GET | /api/v1/courses/:id/enrollments |
| Send message | POST | /api/v1/conversations |

Enrollment request params:
```
type[]=StudentEnrollment
state[]=active
include[]=grades
```

Response grades object per enrollment:
```javascript
{
  grades: {
    current_score: 61.4,
    final_score:   55.2,
    current_grade: "D",
    final_grade:   "F"
  }
}
```

### Sent Log Schema (overall-grade type)

```javascript
{
  id: "msg_...",
  timestamp: "ISO",
  type: "overall-grade",
  assignmentId: null,
  assignmentName: null,
  courseId: "12345",
  courseName: "Biology 101",
  recipientCount: 4,
  recipients: [{ id: "...", name: "Jane Smith" }],
  messageBody: "template used",
  meta: {
    direction: "below",
    thresholdPct: "70",
    scoreType: "current"   // "current" | "final"
  }
}
```

### SentLogPanel Display

`type: 'overall-grade'` renders as **"Overall Grade Outreach"** badge.
Expanded view shows a Filter row:
- `"Overall grade below 70% · current score"`
- `"Overall grade above 80% · final score"`
