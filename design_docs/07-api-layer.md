# Canvas Power Tools — 07: API Layer

---

## Overview

The API layer is the foundation of the entire extension. Every feature calls
functions from this layer rather than making raw fetch calls directly. This
means:

- Canvas API logic is written once and reused everywhere
- Rate limiting, pagination, and error handling are handled in one place
- When Canvas changes an endpoint, only one file needs updating
- TypeScript types (future) or JSDoc annotations make the data shapes clear

All API calls are made from the extension's background service worker or
from extension pages — never from content scripts injected into Canvas.
This avoids CORS issues and keeps the API logic separate from the DOM layer.

---

## Authentication

All Canvas API requests use the teacher's API token in the Authorization header.

```javascript
Authorization: Bearer {apiToken}
```

The token is retrieved from encrypted storage before each request. It is never
held in memory longer than needed for the current operation.

```javascript
// src/api/auth.js

import { getDecryptedToken } from '../storage/encryption.js'

export async function getAuthHeaders() {
  const token = await getDecryptedToken()
  if (!token) {
    throw new AuthError('No API token found. Please complete setup.')
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

export async function verifyToken(canvasUrl, token) {
  const response = await fetch(`${canvasUrl}/api/v1/users/self`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (response.status === 401) {
    throw new AuthError('Token is invalid or expired.')
  }

  if (!response.ok) {
    throw new ApiError(`Verification failed: ${response.status}`)
  }

  const user = await response.json()
  return {
    id: user.id,
    name: user.name,
    shortName: user.short_name,
    institution: user.locale
  }
}
```

---

## Base Request Wrapper — request.js

All API calls go through this wrapper. It handles:

- Auth header injection
- Base URL prepending
- Pagination via Link headers
- Rate limit detection and backoff
- Error classification
- Response parsing

```javascript
// src/api/request.js

import { getAuthHeaders } from './auth.js'
import { getCanvasUrl } from '../storage/account.js'

// Canvas rate limit: approximately 700 requests per 10 minutes
// The wrapper queues requests and backs off on 403 rate limit responses

const requestQueue = []
let isProcessing = false
let rateLimitBackoffUntil = null

export async function canvasGet(path, params = {}) {
  const url = await buildUrl(path, params)
  return queueRequest({ url, method: 'GET' })
}

export async function canvasPut(path, body = {}) {
  const url = await buildUrl(path)
  return queueRequest({
    url,
    method: 'PUT',
    body: JSON.stringify(body)
  })
}

export async function canvasPost(path, body = {}) {
  const url = await buildUrl(path)
  return queueRequest({
    url,
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export async function canvasDelete(path) {
  const url = await buildUrl(path)
  return queueRequest({ url, method: 'DELETE' })
}

async function buildUrl(path, params = {}) {
  const baseUrl = await getCanvasUrl()
  const url = new URL(`${baseUrl}${path}`)
  // Add per_page to maximize results per request and reduce pagination calls
  url.searchParams.set('per_page', '100')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

async function executeRequest({ url, method, body }) {
  // Check rate limit backoff
  if (rateLimitBackoffUntil && Date.now() < rateLimitBackoffUntil) {
    const waitMs = rateLimitBackoffUntil - Date.now()
    await sleep(waitMs)
  }

  const headers = await getAuthHeaders()
  const response = await fetch(url, { method, headers, body })

  // Handle rate limiting
  if (response.status === 403) {
    const retryAfter = response.headers.get('X-Rate-Limit-Remaining')
    const backoffMs = retryAfter ? parseInt(retryAfter) * 1000 : 5000
    rateLimitBackoffUntil = Date.now() + backoffMs
    throw new RateLimitError(`Rate limited. Retrying in ${backoffMs}ms.`)
  }

  // Handle auth failure
  if (response.status === 401) {
    throw new AuthError('Token invalid or expired.')
  }

  // Handle not found
  if (response.status === 404) {
    throw new NotFoundError(`Resource not found: ${url}`)
  }

  // Handle other errors
  if (!response.ok) {
    throw new ApiError(`Request failed: ${response.status} ${response.statusText}`)
  }

  return response
}

// Pagination — Canvas returns Link headers for multi-page responses
// This function fetches all pages and concatenates results

export async function canvasGetAll(path, params = {}) {
  let allResults = []
  let url = await buildUrl(path, params)

  while (url) {
    const response = await executeRequest({ url, method: 'GET' })
    const data = await response.json()
    allResults = allResults.concat(data)

    // Parse Link header for next page URL
    const linkHeader = response.headers.get('Link')
    url = extractNextPageUrl(linkHeader)
  }

  return allResults
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

## Error Types

Typed errors allow calling code to handle different failure modes appropriately.

```javascript
// src/api/errors.js

export class AuthError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AuthError'
    this.type = 'auth'
  }
}

export class RateLimitError extends Error {
  constructor(message) {
    super(message)
    this.name = 'RateLimitError'
    this.type = 'rate_limit'
  }
}

export class NotFoundError extends Error {
  constructor(message) {
    super(message)
    this.name = 'NotFoundError'
    this.type = 'not_found'
  }
}

export class ApiError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.name = 'ApiError'
    this.type = 'api_error'
    this.statusCode = statusCode
  }
}
```

---

## Courses API — courses.js

```javascript
// src/api/courses.js

import { canvasGetAll } from './request.js'

// Returns all active courses for the current teacher
export async function getCourses() {
  const courses = await canvasGetAll('/api/v1/courses', {
    enrollment_type: 'teacher',
    enrollment_state: 'active',
    include: ['term']
  })

  return courses.map(course => ({
    id: String(course.id),
    name: course.name,
    courseCode: course.course_code,
    term: course.term?.name || null,
    startAt: course.start_at,
    endAt: course.end_at
  }))
}
```

---

## Assignments API — assignments.js

```javascript
// src/api/assignments.js

import { canvasGetAll, canvasGet, canvasPut, canvasPost, canvasDelete }
  from './request.js'

// Returns all assignments for a course
export async function getAssignments(courseId) {
  const assignments = await canvasGetAll(
    `/api/v1/courses/${courseId}/assignments`,
    { include: ['assignment_group', 'module_ids', 'submission'] }
  )

  return assignments.map(mapAssignment)
}

// Returns a single assignment
export async function getAssignment(courseId, assignmentId) {
  const response = await canvasGet(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}`
  )
  const assignment = await response.json()
  return mapAssignment(assignment)
}

// Creates an assignment from a template's fields
export async function createAssignment(courseId, fields) {
  const response = await canvasPost(
    `/api/v1/courses/${courseId}/assignments`,
    { assignment: buildAssignmentPayload(fields) }
  )
  const assignment = await response.json()
  return mapAssignment(assignment)
}

// Updates a single assignment
export async function updateAssignment(courseId, assignmentId, fields) {
  const response = await canvasPut(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}`,
    { assignment: buildAssignmentPayload(fields) }
  )
  const assignment = await response.json()
  return mapAssignment(assignment)
}

// Bulk updates due dates for multiple assignments
// Canvas bulk_update only handles date fields
export async function bulkUpdateDates(courseId, assignmentUpdates) {
  // assignmentUpdates: [{ id, due_at, unlock_at, lock_at }]
  const response = await canvasPut(
    `/api/v1/courses/${courseId}/assignments/bulk_update`,
    assignmentUpdates
  )
  return response.json()
}

// Duplicates an assignment within the same course
export async function duplicateAssignment(courseId, assignmentId) {
  const response = await canvasPost(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}/duplicate`
  )
  const assignment = await response.json()
  return mapAssignment(assignment)
}

// Deletes an assignment
export async function deleteAssignment(courseId, assignmentId) {
  await canvasDelete(
    `/api/v1/courses/${courseId}/assignments/${assignmentId}`
  )
}

// Maps raw Canvas API response to internal assignment shape
function mapAssignment(raw) {
  return {
    id: String(raw.id),
    courseId: String(raw.course_id),
    name: raw.name,
    description: raw.description,
    dueAt: raw.due_at,
    unlockAt: raw.unlock_at,      // Available From
    lockAt: raw.lock_at,          // Available Until
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

// Builds the Canvas API payload shape from internal fields
function buildAssignmentPayload(fields) {
  const payload = {}

  if (fields.name !== undefined) payload.name = fields.name
  if (fields.description !== undefined) payload.description = fields.description
  if (fields.dueAt !== undefined) payload.due_at = fields.dueAt
  if (fields.unlockAt !== undefined) payload.unlock_at = fields.unlockAt
  if (fields.lockAt !== undefined) payload.lock_at = fields.lockAt
  if (fields.pointsPossible !== undefined)
    payload.points_possible = fields.pointsPossible
  if (fields.published !== undefined) payload.published = fields.published
  if (fields.submissionTypes !== undefined)
    payload.submission_types = fields.submissionTypes
  if (fields.gradingType !== undefined) payload.grading_type = fields.gradingType
  if (fields.assignmentGroupId !== undefined)
    payload.assignment_group_id = fields.assignmentGroupId
  if (fields.peerReviews !== undefined) payload.peer_reviews = fields.peerReviews

  return payload
}
```

---

## Assignment Groups API

```javascript
// src/api/assignmentGroups.js

import { canvasGetAll } from './request.js'

export async function getAssignmentGroups(courseId) {
  const groups = await canvasGetAll(
    `/api/v1/courses/${courseId}/assignment_groups`
  )

  return groups.map(group => ({
    id: String(group.id),
    name: group.name,
    position: group.position,
    groupWeight: group.group_weight
  }))
}
```

---

## Modules API

```javascript
// src/api/modules.js

import { canvasGetAll } from './request.js'

export async function getModules(courseId) {
  const modules = await canvasGetAll(
    `/api/v1/courses/${courseId}/modules`
  )

  return modules.map(module => ({
    id: String(module.id),
    name: module.name,
    position: module.position,
    published: module.published
  }))
}
```

---

## Bulk Update Strategy

The Canvas API provides a bulk_update endpoint that handles date changes
efficiently. However it only covers three date fields: due_at, unlock_at,
lock_at. Point value changes and publish status changes are not supported
by bulk_update and must be fired as individual PUT requests.

### Strategy for a Mixed Bulk Edit

```javascript
async function applyBulkEdit(courseId, assignments, changes) {
  const results = { succeeded: [], failed: [] }

  // Separate date changes from non-date changes
  const dateUpdates = []
  const individualUpdates = []

  for (const assignment of assignments) {
    const hasDateChange = changes.dueAt || changes.unlockAt || changes.lockAt
    const hasOtherChange = changes.pointsPossible !== undefined ||
                           changes.published !== undefined

    if (hasDateChange) {
      dateUpdates.push({
        id: assignment.id,
        due_at: resolveDate(assignment.dueAt, changes.dueAt),
        unlock_at: resolveDate(assignment.unlockAt, changes.unlockAt),
        lock_at: resolveDate(assignment.lockAt, changes.lockAt)
      })
    }

    if (hasOtherChange) {
      individualUpdates.push({ assignment, changes })
    }
  }

  // Fire bulk date update
  if (dateUpdates.length > 0) {
    try {
      await bulkUpdateDates(courseId, dateUpdates)
      dateUpdates.forEach(u => results.succeeded.push(u.id))
    } catch (error) {
      // If bulk update fails, fall back to individual updates
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

  // Fire individual updates for points and publish status
  for (const { assignment, changes } of individualUpdates) {
    try {
      await updateAssignment(courseId, assignment.id, {
        pointsPossible: changes.pointsPossible,
        published: changes.published
      })
      if (!results.succeeded.includes(assignment.id)) {
        results.succeeded.push(assignment.id)
      }
    } catch (error) {
      results.failed.push({ id: assignment.id, error: error.message })
    }
  }

  return results
}

// Resolves a date change instruction to an actual date value
function resolveDate(currentValue, change) {
  if (!change) return currentValue

  if (change.type === 'set') {
    return change.value  // ISO date string or null
  }

  if (change.type === 'shift') {
    if (!currentValue) return currentValue  // Cannot shift a null date
    const date = new Date(currentValue)
    date.setDate(date.getDate() + change.days)
    return date.toISOString()
  }

  return currentValue
}
```

---

## Complete Canvas API Endpoint Reference

All endpoints used across V1 features.

| Feature | Action | Method | Endpoint |
|---|---|---|---|
| Onboarding | Verify token | GET | /api/v1/users/self |
| All features | List courses | GET | /api/v1/courses |
| Bulk Editor | List assignments | GET | /api/v1/courses/:id/assignments |
| Bulk Editor | Update assignment | PUT | /api/v1/courses/:id/assignments/:id |
| Bulk Editor | Bulk update dates | PUT | /api/v1/courses/:id/assignments/bulk_update |
| Bulk Editor | List assignment groups | GET | /api/v1/courses/:id/assignment_groups |
| Bulk Editor | List modules | GET | /api/v1/courses/:id/modules |
| Templates | Create assignment | POST | /api/v1/courses/:id/assignments |
| Templates | Duplicate assignment | POST | /api/v1/courses/:id/assignments/:id/duplicate |

### Canvas API Notes

**Pagination:** Canvas defaults to 10 results per page. Always set per_page=100
and follow Link headers for subsequent pages. The canvasGetAll function
handles this automatically.

**Rate limiting:** Canvas enforces approximately 700 requests per 10 minutes
per token. The request queue and backoff system handles this transparently.

**Date formats:** Canvas uses ISO 8601 format with UTC timezone.
Example: "2025-10-01T23:59:00Z"

**Null dates:** Sending null for a date field removes the date from the
assignment. This is valid and intentional for undated assignments.

**bulk_update response:** The bulk_update endpoint returns a Progress object
rather than the updated assignments directly. Polling this progress object
may be required for large batches. Monitor Canvas API documentation for
current behavior.
