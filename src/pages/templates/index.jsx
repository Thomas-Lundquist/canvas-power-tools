import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import AppNav, { SettingsButton } from '../../components/AppNav.jsx'
import TemplateLibrary from '../../features/templates/TemplateLibrary.jsx'
import TemplateEditor from '../../features/templates/TemplateEditor.jsx'
import DeployTemplate from '../../features/templates/DeployTemplate.jsx'
import { getTemplates } from '../../storage/templates.js'
import { getPreferences } from '../../storage/preferences.js'
import { applyTheme } from '../../utils/color.js'
import { getAssignment } from '../../api/assignments.js'
import { assignmentToFormFields } from '../../features/templates/templateHelpers.js'
import '../../styles/global.css'

// ?saveFrom=courseId/assignmentId  →  pre-fill editor from a Canvas assignment
function parseSaveFrom() {
  const params = new URLSearchParams(window.location.search)
  const val = params.get('saveFrom')
  if (!val) return null
  const [courseId, assignmentId] = val.split('/')
  return courseId && assignmentId ? { courseId, assignmentId } : null
}

function parseUrlContext() {
  const params = new URLSearchParams(window.location.search)
  return {
    courseId: params.get('courseId') ?? null,
    moduleId: params.get('moduleId') ?? null,
  }
}

// view: 'library' | 'editor' | 'deploy'
function App() {
  const [view, setView] = useState('library')
  const [templates, setTemplates] = useState([])
  const [folders, setFolders] = useState([])
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [deployingTemplate, setDeployingTemplate] = useState(null)
  const [newFolderId, setNewFolderId] = useState(null)
  const [prefillForm, setPrefillForm] = useState(null)
  const [prefillSourceId, setPrefillSourceId] = useState(null)
  const [prefs, setPrefs] = useState({})
  const { courseId: urlCourseId, moduleId: urlModuleId } = parseUrlContext()

  useEffect(() => {
    loadData()
    handleSaveFromParam()
    getPreferences().then(p => { setPrefs(p); applyTheme(p.buttonColor) })
  }, [])

  async function loadData() {
    const data = await getTemplates()
    setTemplates(data.items)
    setFolders(data.folders)
  }

  async function handleSaveFromParam() {
    const saveFrom = parseSaveFrom()
    if (!saveFrom) return
    try {
      const assignment = await getAssignment(saveFrom.courseId, saveFrom.assignmentId)
      const formFields = assignmentToFormFields(assignment)
      setPrefillForm(formFields)
      setPrefillSourceId(assignment.id)
      setEditingTemplate(null)
      setView('editor')
    } catch {
      // If fetch fails, just open blank editor
      setView('editor')
    }
  }

  function handleNew(folderId = null) {
    setEditingTemplate(null)
    setPrefillForm(null)
    setPrefillSourceId(null)
    setNewFolderId(folderId)
    setView('editor')
  }

  function handleEdit(template) {
    setEditingTemplate(template)
    setPrefillForm(null)
    setPrefillSourceId(null)
    setView('editor')
  }

  function handleUse(template) {
    setDeployingTemplate(template)
    setView('deploy')
  }

  async function handleEditorSave() {
    await loadData()
    setView('library')
    setEditingTemplate(null)
    setPrefillForm(null)
  }

  function handleEditorCancel() {
    setView('library')
    setEditingTemplate(null)
    setPrefillForm(null)
  }

  function handleDeployDone() {
    loadData()
    setView('library')
    setDeployingTemplate(null)
  }

  function handleDeployBack() {
    setView('library')
    setDeployingTemplate(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: prefs.buttonColor ?? '#4f46e5' }}>
              <span className="text-white text-xs font-black">C</span>
            </div>
            <span className="text-sm font-bold text-gray-900 hidden sm:block">Canvas Power Tools</span>
          </div>
          <div className="flex items-center gap-1">
            <AppNav current="templates" />
            <SettingsButton />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {view === 'library' && (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-6">Assignment Templates</h1>
            <TemplateLibrary
              templates={templates}
              folders={folders}
              onUse={handleUse}
              onEdit={handleEdit}
              onNew={handleNew}
              onDataChange={loadData}
              skipDeleteConfirm={prefs.templateSkipDeleteConfirm ?? false}
              autoExpandFolders={prefs.templateAutoExpandFolders ?? true}
            />
          </>
        )}

        {view === 'editor' && (
          <TemplateEditor
            template={editingTemplate}
            folders={folders}
            initialFolderId={newFolderId}
            initialFormOverride={prefillForm}
            sourceAssignmentId={prefillSourceId}
            onSave={handleEditorSave}
            onCancel={handleEditorCancel}
          />
        )}

        {view === 'deploy' && deployingTemplate && (
          <DeployTemplate
            template={deployingTemplate}
            initialCourseId={urlCourseId}
            moduleId={urlModuleId}
            onDone={handleDeployDone}
            onBack={handleDeployBack}
          />
        )}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<App />)
