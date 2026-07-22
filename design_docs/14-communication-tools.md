# Canvas Power Tools — 14: Communication Tools

---

## Overview

Communication Tools provides two focused messaging workflows: a Nudge Tool for students who have not submitted an assignment, and a Grade Threshold Messenger for students above or below a grade cutoff.

These are not a general purpose messaging system. They are targeted, context-driven communication tools that give teachers a faster path to the specific messages they send most frequently.

---

## Security Model

Sending messages to students on a teacher's behalf is a higher-stakes operation than editing assignment dates. The security model reflects this.

Every message operation requires:
1. PIN confirmation before sending (if PIN is enabled)
2. A mandatory preview screen showing the exact message and all recipients
3. A recipient count prominently displayed before sending
4. A 5-second delay before the Send button activates on the final confirmation screen — prevents accidental sends
5. A sent log stored locally showing what was sent, when, and to whom

The Canvas API token scope enforces that teachers can only message students in their own courses. The extension adds UI-level enforcement on top of this.

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

Recipients are stored because teachers frequently need to know who received a specific message. Retention: last 50 sent log entries. Stored in `chrome.storage.local` only — never in sync storage.

---

## Page Access

Accessible from the extension popup and main navigation. The page has two tabs — Nudge Tool and Threshold Messenger.

---

## Tool 1 — Nudge Tool

### The Problem

Teachers frequently need to remind students who have not submitted an assignment that the deadline is approaching or has passed. Currently this requires manually finding each student in the Canvas inbox and sending individual messages.

### What It Does

Reads submission data for a selected assignment, identifies students who have not submitted, and sends them a personalized message in one operation.

### Flow

1. Teacher selects an assignment from a dropdown
2. The tool shows all students who have not submitted, with their missing-since date. Excused students are automatically deselected.
3. Teacher can manually deselect any students
4. Teacher writes a message using personalization tokens
5. Recipient count is shown before Preview
6. Preview screen shows an example rendered message (first selected student), full recipient list, and a warning that messages cannot be unsent
7. 5-second countdown before Send activates
8. PIN prompt if PIN is enabled

### Available Tokens (Nudge Tool)

`{first_name}` `{last_name}` `{assignment_name}` `{due_date}` `{teacher_name}` `{course_name}`

---

## Tool 2 — Grade Threshold Messenger

### The Problem

Teachers frequently want to reach out to students who are struggling below a grade threshold, or recognize students performing exceptionally well above one. Finding those students and messaging them individually is time-consuming.

### What It Does

Reads grade data for a selected assignment, identifies students above or below a threshold, and sends them a personalized message.

### Flow

1. Teacher selects an assignment
2. Teacher sets a threshold: "below X%" or "above X%". Percentage and raw point fields stay in sync — changing one updates the other automatically.
3. Matching students are listed with their score. Teacher can deselect any.
4. Teacher writes a message using personalization tokens
5. Recipient count shown before Preview
6. Preview → 5-second countdown → PIN → Send (same security flow as Nudge Tool)

### Available Tokens (Threshold Messenger)

`{first_name}` `{last_name}` `{score}` `{grade}` `{points_possible}` `{assignment_name}` `{teacher_name}` `{course_name}`

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

Accessible from the Communication Tools page. Shows entries with timestamp, tool type, assignment/course, and recipient count. Expanding an entry shows the full recipient list and message body.

---

## Canvas API Calls

| Action | Method | Endpoint |
|---|---|---|
| List assignments | GET | /api/v1/courses/:id/assignments |
| List submissions | GET | /api/v1/courses/:id/submissions |
| Get teacher info | GET | /api/v1/users/self |
| Send conversation message | POST | /api/v1/conversations |

The Canvas Conversations API sends a separate message per recipient. The extension iterates through recipients and fires one API call per student. Rate limiting is handled by the request queue in the API layer.

---

## Important Limitation

Canvas messages sent via the Conversations API arrive in students' Canvas Inbox and trigger their normal Canvas notification settings (email, push, etc.). They appear to come from the teacher's Canvas account. They cannot be unsent or recalled once sent. This is stated clearly in the preview screen.

---

## Announcements Tool

### Module Context

Announcements is the third Tool in the **Communication Module**, alongside Nudges and Threshold. All three share the same mental model — reaching students across courses — which is why they live together.

### The Problem

Teachers who run multiple sections of the same course must create the same announcement individually in each Canvas course. There is no native way to write one announcement and send it everywhere at once. Canvas also provides no draft or scheduling functionality in its announcements interface.

### What It Does

A single interface for writing, scheduling, saving, and sending announcements to one or more courses simultaneously. Announcement templates allow frequently used structures — welcome messages, assignment reminders, office hours notices — to be saved and reused.

### Announcement Template Architecture

Announcement templates use the same folder and library architecture as assignment templates. The design is already established — this is an extension of existing infrastructure, not new design work. Templates store the subject line and body. They never store recipients or schedule dates, which are set at send time.

### Form Fields

- Course selection (multi-select with Select All / Deselect All)
- Subject line
- Message body
- Schedule: Send immediately or send at a specific date/time
- Load Template / Save as Template / Save as Draft actions

### Scheduling

Scheduled announcements are stored locally with their target send time. The Canvas `delayed_post_at` field handles Canvas-side scheduling for announcements sent with a future date — this is more reliable than client-side scheduling and should be used whenever available. Chrome alarms (`chrome.alarms`) serve as the fallback.

If the browser is closed at the scheduled time, the announcement sends the next time the extension is opened, with a notification that a scheduled announcement was sent late. A warning at schedule time: "Scheduled announcements require your browser to be open and the extension to be active at the scheduled send time."

### Drafts

Stored in `chrome.storage.local`. A Drafts indicator in the tool header shows the count of saved drafts. Opening a draft pre-fills the form. Drafts have no expiry — they persist until the teacher sends or deletes them.

### Preview Screen

Shows subject, full message body, list of target courses, scheduled send time, and a warning that announcements cannot be recalled. 5-second countdown on Confirm and Send.

### Canvas API

| Action | Method | Endpoint |
|---|---|---|
| Create announcement | POST | /api/v1/courses/:id/discussion_topics |

```javascript
{
  title: "Subject line",
  message: "Body text",
  is_announcement: true,
  published: true,
  delayed_post_at: "ISO_timestamp_or_null"
}
```

---

## Tool 2b — Overall Course Grade Mode (Grade Outreach)

### The Problem

Teachers need to proactively reach out to students who are falling behind overall — not just on one assignment — before a D or F becomes permanent.

### What It Does

Fetches every active student's overall course grade via the Canvas Enrollments API (with `include[]=grades`), filters by a percentage threshold, and sends personalized messages in one operation. The messaging flow (preview, countdown, PIN, sent log) is identical to the By Assignment mode; only the data source and tokens differ.

### Mode Toggle

The Grade Outreach tool has a mode selector at the top: "Score on an assignment" or "Overall course grade."

### Score Type

Canvas provides two overall scores per enrollment:
- `current_score` — grade on graded work only (ignores unsubmitted assignments)
- `final_score` — treats unsubmitted as zero (more conservative)

Teachers choose which to use via a "Score type" picker. Default is `current_score`. For D/F outreach, `final_score` is usually more appropriate because it reflects the impact of missing work.

Students whose score is `null` (grade not yet calculated) are silently excluded from matching. A disclosure note shows how many were excluded.

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

### Sent Log Display

`type: 'overall-grade'` displays as "Overall Grade Outreach". Expanded view shows the filter description (e.g., "Overall grade below 70% · current score").
