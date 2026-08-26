import { useRef, useState } from 'react'
import { UploadCloud, FileText, Download } from 'lucide-react'
import PageHeader from '../../components/PageHeader.jsx'
import Button from '../../components/Button.jsx'
import Callout from '../../components/Callout.jsx'
import { parseCsvQuiz } from '../../utils/csvQuizParser.js'

const EXAMPLE_CSV = `type,points,question,option_1,option_2,option_3,option_4,correct,feedback_correct,feedback_incorrect
MC,2,Which temperature range is the Danger Zone?,0-32F,41-135F,135-212F,,2,,Review the Temperature Danger Zone reference sheet.
MA,2,Which foods are TCS? (select all),Cooked rice,Cut melons,Dry flour,,"1,2",,
TF,1,Chicken must reach 165F internal temperature.,,,,,true,,
Essay,4,Explain how to prevent cross-contamination when prepping raw chicken.,,,,,,,
Match,2,Match each pathogen to its most common source.,Salmonella = raw poultry,E. coli = undercooked ground beef,cooked rice,,,,
FIB,1,The minimum internal temperature for ground beef is {{155}} degrees F.,,,,,,,
`

function downloadExampleCsv() {
  const blob = new Blob([EXAMPLE_CSV], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'quiz-questions-example.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function CsvImport({ onParsed }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  function handleFile(file) {
    if (!file) return
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const result = parseCsvQuiz(String(reader.result))
      onParsed(result, file.name)
    }
    reader.onerror = () => setError('Could not read that file. Please try again.')
    reader.readAsText(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  return (
    <div>
      <PageHeader title="Quiz Authoring" back={{ label: 'Home', to: chrome.runtime.getURL('src/shell/index.html') }}>
        Import a CSV of questions and create a Canvas quiz from it.
      </PageHeader>

      <div
        className="card domain-accent p-6 space-y-6"
        style={{ '--domain-color': 'var(--color-domain-assignments)' }}
      >
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
          className="flex flex-col items-center justify-center text-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed p-12 cursor-pointer transition-colors"
          style={{
            borderColor: dragging ? 'var(--cpt-color)' : 'var(--color-border)',
            backgroundColor: dragging ? 'var(--color-bg-hover)' : 'var(--color-bg-page)',
          }}
        >
          <UploadCloud size={40} strokeWidth={1.5} aria-hidden="true" className="text-[var(--color-text-disabled)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-text-body)]">
              Drag a CSV file here, or click to choose one
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">.csv files only</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </div>

        {error && <Callout tone="error">{error}</Callout>}

        <div className="flex items-center justify-between gap-4 pt-2 border-t border-[var(--color-border)]">
          <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <FileText size={14} aria-hidden="true" />
            One row per question. Columns: type, points, question, option_1–8, correct, feedback_correct, feedback_incorrect.
          </p>
          <Button variant="ghost" size="sm" icon={Download} onClick={downloadExampleCsv}>
            Download example CSV
          </Button>
        </div>
      </div>
    </div>
  )
}
