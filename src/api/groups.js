import { canvasGetAll, canvasPost, canvasPut, canvasDelete } from './request.js'

// ── Group Categories (Group Sets) ──────────────────────────────────────────

export async function getGroupCategories(courseId) {
  const cats = await canvasGetAll(`/api/v1/courses/${courseId}/group_categories`)
  return cats.map(mapCategory)
}

export async function createGroupCategory(courseId, name) {
  const cat = await canvasPost(`/api/v1/courses/${courseId}/group_categories`, {
    name,
    self_signup: null,
  })
  return mapCategory(cat)
}

export async function updateGroupCategory(categoryId, name) {
  const cat = await canvasPut(`/api/v1/group_categories/${categoryId}`, { name })
  return mapCategory(cat)
}

export async function deleteGroupCategory(categoryId) {
  await canvasDelete(`/api/v1/group_categories/${categoryId}`)
}

// ── Groups within a Category ───────────────────────────────────────────────

export async function getGroupsInCategory(categoryId) {
  const groups = await canvasGetAll(`/api/v1/group_categories/${categoryId}/groups`)
  return groups.map(mapGroup)
}

export async function createGroup(categoryId, name) {
  const group = await canvasPost(`/api/v1/group_categories/${categoryId}/groups`, {
    name,
    join_level: 'invitation_only',
  })
  return mapGroup(group)
}

export async function updateGroup(groupId, name) {
  const group = await canvasPut(`/api/v1/groups/${groupId}`, { name })
  return mapGroup(group)
}

export async function deleteGroup(groupId) {
  await canvasDelete(`/api/v1/groups/${groupId}`)
}

// ── Group Memberships ──────────────────────────────────────────────────────

export async function getGroupMembers(groupId) {
  const mems = await canvasGetAll(`/api/v1/groups/${groupId}/memberships`)
  return mems.map(mapMembership)
}

export async function addGroupMember(groupId, userId) {
  const mem = await canvasPost(`/api/v1/groups/${groupId}/memberships`, { user_id: userId })
  return mapMembership(mem)
}

export async function removeGroupMember(groupId, membershipId) {
  await canvasDelete(`/api/v1/groups/${groupId}/memberships/${membershipId}`)
}

// ── Mappers ────────────────────────────────────────────────────────────────

function mapCategory(raw) {
  return {
    id:                      String(raw.id),
    name:                    raw.name,
    groupCount:              raw.groups_count          ?? 0,
    unassignedStudentsCount: raw.unassigned_users_count ?? 0,
    selfSignup:              raw.self_signup,
  }
}

function mapGroup(raw) {
  return {
    id:         String(raw.id),
    name:       raw.name,
    categoryId: String(raw.group_category_id),
    memberCount: raw.members_count ?? 0,
  }
}

function mapMembership(raw) {
  return {
    id:      String(raw.id),
    groupId: String(raw.group_id),
    userId:  String(raw.user_id),
  }
}
