import { useState } from 'react'
import CsvImport from './CsvImport.jsx'
import QuizPreview from './QuizPreview.jsx'
import DeployQuiz from './DeployQuiz.jsx'

// view: 'import' | 'preview' | 'deploy'
export default function QuizAuthoring() {
  const [view, setView] = useState('import')
  const [parseResult, setParseResult] = useState({ questions: [], errors: [] })
  const [fileName, setFileName] = useState('')

  function handleParsed(result, name) {
    setParseResult(result)
    setFileName(name)
    setView('preview')
  }

  function handleDeployDone() {
    setParseResult({ questions: [], errors: [] })
    setFileName('')
    setView('import')
  }

  return (
    <div className="px-6 py-6">
      {view === 'import' && (
        <CsvImport onParsed={handleParsed} />
      )}
      {view === 'preview' && (
        <QuizPreview
          questions={parseResult.questions}
          errors={parseResult.errors}
          fileName={fileName}
          onBack={() => setView('import')}
          onContinue={() => setView('deploy')}
        />
      )}
      {view === 'deploy' && (
        <DeployQuiz
          questions={parseResult.questions}
          onDone={handleDeployDone}
          onBack={() => setView('preview')}
        />
      )}
    </div>
  )
}
