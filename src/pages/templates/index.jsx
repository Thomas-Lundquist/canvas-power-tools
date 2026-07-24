import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import ToolShell from '../../components/ToolShell.jsx'
import TemplateLibrary from '../../modules/assignments/TemplateLibrary.jsx'
import TemplateEditor from '../../modules/assignments/TemplateEditor.jsx'
import DeployTemplate from '../../modules/assignments/DeployTemplate.jsx'
import { getTemplates } from '../../storage/templates.js'
import { getPreferences } from '../../storage/preferences.js'
import { applyPalette, applyDarkMode, applyTextSize } from '../../utils/color.js'
import { getAssignment } from '../../api/assignments.js'
import { assignmentToFormFields } from '../../modules/assignments/templateHelpers.js'
import '../../styles/global.css'
import { ToastProvider, useToast } from '../../components/Toast.jsx'
import { PinGateProvider } from '../../security/usePinGate.jsx'
import SetupGuard from '../../components/SetupGuard.jsx'

// ?saveFrom=courseId/assignmentId  â†’  pre-fill editor from a Canvas assignment
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
  const toast = useToast()
  const [view, setView] = useState('library')
  const [templates, setTemplates] = useState([])
  const [folders, setFolders] = useState([])
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [deployingTemplate, setDeployingTemplate] = useState(null)
  const [newFolderId, setNewFolderId] = useState(null)
  const [prefillForm, setPrefillForm] = useState(null)
  const [prefillSourceId, setPrefillSourceId] = useState(null)
  const [prefs, setPrefs] = useState({})
  const [viewMode, setViewMode] = useState('list')
  const { courseId: urlCourseId, moduleId: urlModuleId } = parseUrlContext()

  useEffect(() => {
    loadData()
    handleSaveFromParam()
    getPreferences().then(p => { setPrefs(p); applyPalette(p.palette); applyDarkMode(p.themeMode ?? 'system'); applyTextSize(p.textSize ?? 'medium') })
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
    toast('Template saved', 'success')
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
    <ToolShell
      start={<BrandLogo />}
      end={<><AppNav current="templates" /><SettingsButton /></>}
    >
      <div className="overflow-y-auto flex-1">
        <div className="px-6 py-6">
          {view === 'library' && (
            <TemplateLibrary
              templates={templates}
              folders={folders}
              onUse={handleUse}
              onEdit={handleEdit}
              onNew={handleNew}
              onDataChange={loadData}
              skipDeleteConfirm={prefs.templateSkipDeleteConfirm ?? false}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
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
    </ToolShell>
  )
}

createRoot(document.getElementById('root')).render(<SetupGuard><ToastProvider><PinGateProvider><App /></PinGateProvider></ToastProvider></SetupGuard>)



