import { useMemo, useState } from 'react'
import { FileArchive, Check } from 'lucide-react'
import Modal from '../../components/Modal.jsx'
import Button from '../../components/Button.jsx'
import Callout from '../../components/Callout.jsx'
import { useToast } from '../../components/Toast.jsx'
import { buildQtiPackage, QTI_TYPE_SUPPORT } from '../../utils/qtiQuizExport.js'

const TYPE_LABELS = {
  MC: 'Multiple Choice',
  MA: 'Multiple Answer',
  TF: 'True / False',
  ESSAY: 'Essay',
  MATCH: 'Matching',
  FIB: 'Fill in the Blank',
}

const STEPS = [
  'In Canvas, open the course and go to New Quizzes → Item Banks.',
  'Open the bank you want the questions in (or create one).',
  'Click the ⋮ menu → Import, and choose the .zip file you just downloaded.',
  'Wait for the content import to finish, then review the imported items.',
]

export default function QtiExportModal({ questions, title, onClose }) {
  const toast = useToast()
  const [downloaded, setDownloaded] = useState(false)

  const reviewTypes = useMemo(() => {
    const present = new Set(questions.map(q => q.type))
    return [...present].filter(t => QTI_TYPE_SUPPORT[t] === 'review')
  }, [questions])

  function handleDownload() {
    const { filename, bytes } = buildQtiPackage(questions, { title: title || 'Quiz' })
    const blob = new Blob([bytes], { type: 'application/zip' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    setDownloaded(true)
    toast('QTI package downloaded', 'success')
  }

  return (
    <Modal
      title="Export as QTI for an item bank"
      subtitle={`${questions.length} question${questions.length !== 1 ? 's' : ''}`}
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="primary" icon={downloaded ? Check : FileArchive} onClick={handleDownload}>
            {downloaded ? 'Download again' : 'Download QTI package (.zip)'}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-[var(--color-text-body)]">
        <p>
          This creates a QTI&nbsp;1.2 package you import by hand into a Canvas
          New&nbsp;Quizzes <strong>item bank</strong>. Nothing is sent to Canvas now —
          the API cannot write item banks, so the import is a manual step.
        </p>

        <p className="text-[var(--color-text-secondary)]">
          Point values are not carried into a bank — Canvas sets points when a
          question is added to a quiz. Question text, options, correct answers,
          and feedback do come across.
        </p>

        {reviewTypes.length > 0 && (
          <Callout tone="warning" title="Check the answer key after import">
            {reviewTypes.map(t => TYPE_LABELS[t]).join(' and ')}{' '}
            question{reviewTypes.length === 1 ? '' : 's'} may need the correct
            answers re-confirmed once Canvas finishes importing — open each one in
            the bank and verify.
          </Callout>
        )}

        {downloaded && (
          <Callout tone="success">Downloaded. Follow the steps below to import it.</Callout>
        )}

        <div>
          <p className="font-medium text-[var(--color-text-body)] mb-1">Import steps</p>
          <ol className="list-decimal space-y-1 pl-5 text-[var(--color-text-secondary)]">
            {STEPS.map(step => <li key={step}>{step}</li>)}
          </ol>
        </div>
      </div>
    </Modal>
  )
}
