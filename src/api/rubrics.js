import { canvasGetAll, canvasPost, canvasDelete } from './request.js'

export async function getRubrics(courseId) {
  const rubrics = await canvasGetAll(`/api/v1/courses/${courseId}/rubrics`, {
    include: ['associations'],
  })
  return rubrics.map(mapRubric)
}

// criteria: [{ id, description, longDescription, ratings: [{id, description, points}] }]
// associationData: { assignmentId, useForGrading } | null
export async function createRubricInCanvas(courseId, { title, criteria, associationData = null }) {
  const criteriaObj = {}
  criteria.forEach((crit, i) => {
    const ratingsObj = {}
    const sorted = [...crit.ratings].sort((a, b) => b.points - a.points)
    sorted.forEach((r, j) => {
      ratingsObj[String(j)] = { description: r.description, points: r.points }
    })
    criteriaObj[String(i)] = {
      description: crit.description,
      long_description: crit.longDescription ?? '',
      points: Math.max(...crit.ratings.map(r => r.points), 0),
      ratings: ratingsObj,
    }
  })

  const payload = {
    rubric: {
      title,
      free_form_criterion_comments: false,
      criteria: criteriaObj,
    },
  }

  if (associationData) {
    payload.rubric_association = {
      association_id: associationData.assignmentId,
      association_type: 'Assignment',
      use_for_grading: associationData.useForGrading ?? true,
      hide_score_total: false,
      purpose: 'grading',
    }
  }

  const result = await canvasPost(`/api/v1/courses/${courseId}/rubrics`, payload)
  return mapRubric(result.rubric ?? result)
}

export async function deleteRubricFromCanvas(courseId, rubricId) {
  await canvasDelete(`/api/v1/courses/${courseId}/rubrics/${rubricId}`)
}

function mapRubric(raw) {
  return {
    id: String(raw.id),
    title: raw.title,
    pointsPossible: raw.points_possible ?? 0,
    criteria: (raw.data ?? []).map(crit => ({
      id: String(crit.id),
      description: crit.description ?? '',
      longDescription: crit.long_description ?? '',
      ratings: (crit.ratings ?? [])
        .map(r => ({ id: String(r.id), description: r.description ?? '', points: r.points ?? 0 }))
        .sort((a, b) => b.points - a.points),
    })),
  }
}
