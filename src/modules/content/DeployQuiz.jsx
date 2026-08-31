import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Loader, ExternalLink, FileArchive } from 'lucide-react'
import { getCourses } from '../../api/courses.js'
import { getPreferences, setLastUsedCourse, resolveInitialCourseId } from '../../storage/preferences.js'
import { getAssignmentGroups } from '../../api/assignmentGroups.js'
import { createQuiz, createQuizItem } from '../../api/newQuizzes.js'
import { addChangeLogEntry } from '../../storage/changeLogs.js'
import { getCanvasUrl } from '../../storage/account.js'
import { usePinGate } from '../../security/usePinGate.jsx'
import { useToast } from '../../components/Toast.jsx'
import PageHeader from '../../components/PageHeader.jsx'
import Button from '../../components/Button.jsx'
import Callout from '../../components/Callout.jsx'
import FieldLabel from '../../components/FieldLabel.jsx'
import TextField from '../../components/TextField.jsx'
import NumberField from '../../components/NumberField.jsx'
import Select from '../../components/Select.jsx'
import CourseSelector from '../../components/CourseSelector.jsx'
import ProgressBar from '../../components/ProgressBar.jsx'
import QtiExportModal from './QtiExportModal.jsx'

function SettingsBar({ className = '', children }) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border border-[var(--color-border)] p-4 ${className}`}
      style={{ backgroundColor: 'var(--color-bg-page)' }}
    >
      {children}
    </div>
  )
}

export default function DeployQuiz({ questions, onDone, onBack }) {
  const toast = useToast()
  const { requirePin } = usePinGate()
  const [courses, setCourses] = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [courseId, setCourseId] = useState('')
  const [groups, setGroups] = useState([])
  const [assignmentGroupId, setAssignmentGroupId] = useState('')
  const [title, setTitle] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [unlockAt, setUnlockAt] = useState('')
  const [lockAt, setLockAt] = useState('')
  const [shuffleQuestions, setShuffleQuestions] = useState(false)
  const [shuffleAnswers, setShuffleAnswers] = useState(false)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('')
  const [allowedAttempts, setAllowedAttempts] = useState('1')
  const [deploying, setDeploying] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState(null)
  const [showQti, setShowQti] = useState(false)

  useEffect(() => {
    Promise.all([getCourses(), getPreferences()])
      .then(([list, prefs]) => {
        setCourses(list)
        setCourseId(resolveInitialCourseId(list, { prefs }) ?? '')
      })
      .catch(() => {})
      .finally(() => setLoadingCourses(false))
  }, [])

  function handleCourseChange(id) {
    setCourseId(id)
    setLastUsedCourse(id)
  }

  useEffect(() => {
    if (!courseId) { setGroups([]); return }
    getAssignmentGroups(courseId).then(setGroups).catch(() => setGroups([]))
  }, [courseId])

  const course = courses.find(c => c.id === courseId)
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0)
  const canDeploy = !!courseId && title.trim().length > 0 && !deploying

  async function deploy() {
    await requirePin(
      {
        action: 'quiz_create',
        summary: `Created quiz "${title}" with ${questions.length} question${questions.length !== 1 ? 's' : ''} in ${course?.name ?? 'a course'}`,
        courseId,
        courseName: course?.name ?? '',
      },
      runDeploy,
    )
  }

  async function runDeploy() {
    setDeploying(true)
    setProgress({ done: 0, total: questions.length + 1 })

    const settings = {
      title: title.trim(),
      assignmentGroupId: assignmentGroupId || undefined,
      dueAt: dueAt ? `${dueAt}T23:59:00Z` : undefined,
      unlockAt: unlockAt ? `${unlockAt}T00:00:00Z` : undefined,
      lockAt: lockAt ? `${lockAt}T23:59:00Z` : undefined,
      shuffleQuestions,
      shuffleAnswers,
      timeLimitMinutes: timeLimitMinutes ? Number(timeLimitMinutes) : undefined,
      allowedAttempts: allowedAttempts ? Number(allowedAttempts) : undefined,
    }

    let quiz
    try {
      quiz = await createQuiz(courseId, settings)
    } catch (err) {
      setDeploying(false)
      setResult({ quiz: null, error: err.message, itemResults: [] })
      return
    }
    setProgress(p => ({ ...p, done: 1 }))

    const itemResults = []
    for (let i = 0; i < questions.length; i++) {
      try {
        await createQuizItem(courseId, quiz.id, questions[i], i + 1, { shuffleAnswers })
        itemResults.push({ question: questions[i], success: true })
      } catch (err) {
        itemResults.push({ question: questions[i], success: false, error: err.message })
        break // stop on first failure — leave the partial quiz unpublished for review, never retry blindly
      }
      setProgress(p => ({ ...p, done: p.done + 1 }))
    }

    const succeededCount = itemResults.filter(r => r.success).length
    const baseUrl = await getCanvasUrl()
    await addChangeLogEntry({
      id: `clog_${Date.now()}`,
      timestamp: new Date().toISOString(),
      courseId,
      courseName: course?.name ?? '',
      summary: `Created quiz "${quiz.title}" with ${succeededCount} question${succeededCount !== 1 ? 's' : ''} (unpublished)`,
      type: 'quiz_create',
      revertedFromId: null,
      changes: [{ quizId: quiz.id, quizTitle: quiz.title, questionCount: succeededCount }],
    })

    setDeploying(false)
    setResult({ quiz, itemResults, quizUrl: `${baseUrl}/courses/${courseId}/assignments/${quiz.id}` })
  }

  // ── Results screen ─────────────────────────────────────────────────────────
  if (result) {
    const succeeded = result.itemResults.filter(r => r.success)
    const failed = result.itemResults.filter(r => !r.success)

    return (
      <div>
        <PageHeader title="Quiz Created" back={{ label: 'Start Over', to: onDone }} />

        <div
          className="card domain-accent p-6 space-y-4"
          style={{ '--domain-color': 'var(--color-domain-assignments)' }}
        >
          {result.error && (
            <Callout tone="error" title="Quiz could not be created">{result.error}</Callout>
          )}

          {result.quiz && (
            <div className="flex items-center gap-2 text-[var(--color-success)] font-medium">
              <CheckCircle size={16} aria-hidden="true" />
              "{result.quiz.title}" created — unpublished, {succeeded.length} of {questions.length} question{questions.length !== 1 ? 's' : ''} added.
            </div>
          )}

          {failed.length > 0 && (
            <Callout tone="warning" title={`Stopped after question ${failed[0].question ? result.itemResults.indexOf(failed[0]) + 1 : ''} failed`}>
              {failed[0].error} — the quiz was left unpublished in Canvas so you can inspect or delete it before retrying.
            </Callout>
          )}
        </div>

        <div className="mt-6 flex gap-3 justify-end">
          <Button variant="ghost" icon={FileArchive} onClick={() => setShowQti(true)}>
            Also export for an item bank
          </Button>
          {result.quizUrl && (
            <Button variant="secondary" onClick={() => window.open(result.quizUrl, '_blank', 'noopener')}>
              <ExternalLink size={14} aria-hidden="true" /> Review in Canvas
            </Button>
          )}
          <Button variant="primary" onClick={() => { toast(result.quiz ? 'Quiz created' : 'Quiz creation failed', result.quiz ? 'success' : 'error'); onDone() }}>
            Done
          </Button>
        </div>

        {showQti && (
          <QtiExportModal
            questions={questions}
            title={result.quiz?.title || title || 'Quiz'}
            onClose={() => setShowQti(false)}
          />
        )}
      </div>
    )
  }

  // ── Deploy form ────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Deploy Quiz"
        back={{ label: 'Back to Preview', to: onBack }}
        actions={
          <Button variant="primary" disabled={!canDeploy} onClick={deploy}>
            {deploying
              ? <><Loader size={14} className="animate-spin" aria-hidden="true" /> Creating…</>
              : 'Create Quiz'}
          </Button>
        }
      >
        {questions.length} question{questions.length !== 1 ? 's' : ''} · {totalPoints} pts total
      </PageHeader>

      <div
        className="card domain-accent p-6 space-y-6"
        style={{ '--domain-color': 'var(--color-domain-assignments)' }}
      >
        <div className="space-y-3">
          <h3 className="section-label !mb-0">1. Course &amp; Title</h3>
          <SettingsBar className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <FieldLabel htmlFor="quiz-course" required>Course</FieldLabel>
              <CourseSelector courses={courses} selectedId={courseId} onChange={handleCourseChange} loading={loadingCourses} />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="quiz-title" required>Quiz Title</FieldLabel>
              <TextField id="quiz-title" value={title} onChange={setTitle} placeholder="e.g. Food Safety Basics" />
            </div>
          </SettingsBar>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-[var(--color-border)]">
          <div className="space-y-3">
            <h3 className="section-label !mb-0">2. Dates <span className="normal-case font-normal text-[var(--color-text-muted)]">(optional)</span></h3>
            <SettingsBar className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <FieldLabel htmlFor="quiz-due">Due</FieldLabel>
                <input id="quiz-due" type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} className="input text-sm" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="quiz-from">From</FieldLabel>
                <input id="quiz-from" type="date" value={unlockAt} onChange={e => setUnlockAt(e.target.value)} className="input text-sm" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="quiz-until">Until</FieldLabel>
                <input id="quiz-until" type="date" value={lockAt} onChange={e => setLockAt(e.target.value)} className="input text-sm" />
              </div>
            </SettingsBar>
          </div>

          <div className="space-y-3">
            <h3 className="section-label !mb-0">3. Quiz Settings</h3>
            <SettingsBar className="space-y-3">
              <div className="space-y-1">
                <FieldLabel htmlFor="quiz-group">Assignment Group</FieldLabel>
                <Select
                  id="quiz-group"
                  value={assignmentGroupId}
                  onChange={setAssignmentGroupId}
                  placeholder="Default"
                  options={groups.map(g => ({ value: g.id, label: g.name }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <FieldLabel htmlFor="quiz-time-limit">Time Limit (min)</FieldLabel>
                  <NumberField id="quiz-time-limit" value={timeLimitMinutes} onChange={setTimeLimitMinutes} min={1} placeholder="None" />
                </div>
                <div className="space-y-1">
                  <FieldLabel htmlFor="quiz-attempts">Allowed Attempts</FieldLabel>
                  <NumberField id="quiz-attempts" value={allowedAttempts} onChange={setAllowedAttempts} min={1} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--color-text-body)] cursor-pointer">
                <input type="checkbox" checked={shuffleQuestions} onChange={e => setShuffleQuestions(e.target.checked)} />
                Shuffle question order
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--color-text-body)] cursor-pointer">
                <input type="checkbox" checked={shuffleAnswers} onChange={e => setShuffleAnswers(e.target.checked)} />
                Shuffle answer options
              </label>
            </SettingsBar>
          </div>
        </div>

        {deploying && (
          <div className="pt-2 border-t border-[var(--color-border)] space-y-2">
            <p className="text-sm text-[var(--color-text-body)]">Creating quiz… {progress.done} of {progress.total}</p>
            <ProgressBar graded={progress.done} ungraded={0} notSubmitted={progress.total - progress.done} showLabel={false} />
          </div>
        )}

        {courseId && title.trim() && !deploying && (
          <Callout tone="info" title={`Creating "${title}" in ${course?.name ?? ''}`}>
            {questions.length} question{questions.length !== 1 ? 's' : ''} · {totalPoints} pts · lands unpublished for review
          </Callout>
        )}
      </div>
    </div>
  )
}
