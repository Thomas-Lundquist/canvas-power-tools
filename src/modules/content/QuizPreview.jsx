import { useState } from 'react'
import { CheckCircle2, FileArchive } from 'lucide-react'
import PageHeader from '../../components/PageHeader.jsx'
import Button from '../../components/Button.jsx'
import Callout from '../../components/Callout.jsx'
import Badge from '../../components/Badge.jsx'
import QtiExportModal from './QtiExportModal.jsx'

const TYPE_LABELS = {
  MC: 'Multiple Choice',
  MA: 'Multiple Answer',
  TF: 'True / False',
  ESSAY: 'Essay',
  MATCH: 'Matching',
  FIB: 'Fill in the Blank',
}

function renderStem(question) {
  if (question.type !== 'FIB') return question.stem
  const parts = question.stem.split(/\{\{[^{}]+\}\}/g)
  const answers = [...question.stem.matchAll(/\{\{([^{}]+)\}\}/g)].map(m => m[1])
  return parts.flatMap((part, i) => [
    part,
    i < answers.length && (
      <span key={`${answers[i]}-${i}`} className="font-semibold underline decoration-dotted" style={{ color: 'var(--cpt-color)' }}>
        {answers[i]}
      </span>
    ),
  ])
}

function QuestionBody({ question }) {
  switch (question.type) {
    case 'MC':
    case 'MA':
      return (
        <ul className="mt-2 space-y-1">
          {question.options.map((opt, i) => (
            <li key={`${question.row}-${opt.text}-${i}`} className="flex items-center gap-2 text-sm">
              {opt.correct
                ? <CheckCircle2 size={14} aria-hidden="true" className="text-[var(--color-success)] shrink-0" />
                : <span className="w-3.5 shrink-0" />}
              <span className={opt.correct ? 'font-medium text-[var(--color-text-body)]' : 'text-[var(--color-text-secondary)]'}>
                {opt.text}
              </span>
            </li>
          ))}
        </ul>
      )
    case 'TF':
      return (
        <p className="mt-2 text-sm font-medium text-[var(--color-text-body)]">
          Correct answer: {question.boolAnswer ? 'True' : 'False'}
        </p>
      )
    case 'MATCH':
      return (
        <div className="mt-2 space-y-1">
          {question.pairs.map((pair, i) => (
            <p key={`${question.row}-${pair.left}-${i}`} className="text-sm text-[var(--color-text-body)]">
              {pair.left} <span className="text-[var(--color-text-muted)]">→</span> {pair.right}
            </p>
          ))}
          {question.distractors.length > 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">
              Distractors: {question.distractors.map(d => d.text).join(', ')}
            </p>
          )}
        </div>
      )
    default:
      return null
  }
}

export default function QuizPreview({ questions, errors, fileName, onBack, onContinue }) {
  const [showQti, setShowQti] = useState(false)
  const canDeploy = questions.length > 0 && errors.length === 0
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0)

  return (
    <div>
      <PageHeader
        title="Preview"
        back={{ label: 'Choose a different file', to: onBack }}
        actions={
          <>
            <Button variant="secondary" icon={FileArchive} disabled={!canDeploy} onClick={() => setShowQti(true)}>
              Export QTI
            </Button>
            <Button variant="primary" disabled={!canDeploy} onClick={onContinue}>
              Continue to Deploy
            </Button>
          </>
        }
      >
        {fileName} · {questions.length} question{questions.length !== 1 ? 's' : ''} · {totalPoints} pts total
      </PageHeader>

      {errors.length > 0 && (
        <Callout tone="error" title={`${errors.length} row${errors.length !== 1 ? 's' : ''} could not be imported`} className="mb-4">
          <ul className="mt-1 space-y-0.5">
            {errors.map(e => (
              <li key={e.row}>Row {e.row}: {e.message}</li>
            ))}
          </ul>
          <p className="mt-2">Fix these rows in the CSV and re-upload — deploy is disabled until every row parses.</p>
        </Callout>
      )}

      {questions.length === 0 && errors.length === 0 && (
        <Callout tone="warning">No questions found in this file.</Callout>
      )}

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div
            key={q.row}
            className="card domain-accent p-4"
            style={{ '--domain-color': 'var(--color-domain-assignments)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-[var(--color-text-body)] flex-1">
                {i + 1}. {renderStem(q)}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <Badge tone="accent">{TYPE_LABELS[q.type]}</Badge>
                <Badge tone="muted">{q.points} pt{q.points !== 1 ? 's' : ''}</Badge>
              </div>
            </div>
            <QuestionBody question={q} />
            {(q.feedback?.correct || q.feedback?.incorrect) && (
              <div className="mt-2 pt-2 border-t border-[var(--color-border-subtle)] text-xs text-[var(--color-text-muted)] space-y-0.5">
                {q.feedback.correct && <p>Correct feedback: {q.feedback.correct}</p>}
                {q.feedback.incorrect && <p>Incorrect feedback: {q.feedback.incorrect}</p>}
              </div>
            )}
          </div>
        ))}
      </div>

      {showQti && (
        <QtiExportModal
          questions={questions}
          title={(fileName || 'Quiz').replace(/\.[^.]+$/, '')}
          onClose={() => setShowQti(false)}
        />
      )}
    </div>
  )
}
