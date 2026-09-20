import { useState, useEffect, useMemo } from 'react'
import { BookOpen, FileText, SlidersHorizontal } from 'lucide-react'
import AppNav, { SettingsButton, BrandLogo } from '../../components/AppNav.jsx'
import CourseSelector from '../../components/CourseSelector.jsx'
import ToolShell from '../../components/ToolShell.jsx'
import SkipLink from '../../components/SkipLink.jsx'
import EmptyState from '../../components/EmptyState.jsx'
import Callout from '../../components/Callout.jsx'
import Button from '../../components/Button.jsx'
import Card from '../../components/Card.jsx'
import ShortcutsPanel from '../../components/ShortcutsPanel.jsx'
import PagesTable from '../../modules/content/PagesTable.jsx'
import PagesFilterBar from '../../modules/content/PagesFilterBar.jsx'
import PagesActionBar, { INITIAL_ACTIONS } from '../../modules/content/PagesActionBar.jsx'
import PagesPreviewDiff from '../../modules/content/PagesPreviewDiff.jsx'
import DeletePagesModal from '../../modules/content/DeletePagesModal.jsx'
import PageRevisionsModal from '../../modules/content/PageRevisionsModal.jsx'
import ContentPreview, { PREVIEW_PANE_INSET } from '../../components/ContentPreview.jsx'
import { applyPageFilters, publishedParamFromFilters, editingRolesKey } from '../../modules/content/pagesHelpers.js'
import { useToast } from '../../components/Toast.jsx'
import { getCourses } from '../../api/courses.js'
import { getPages, getPage } from '../../api/pages.js'
import useSort, { compareBy } from '../../utils/useSort.js'
import { getPreferences, setLastUsedCourse, resolveInitialCourseId } from '../../storage/preferences.js'
import { applyPalette, applyDarkMode, applyTextSize } from '../../utils/color.js'
import { useKeyboardShortcuts } from '../../utils/useKeyboardShortcuts.js'

// `editingRoles` is an array, which the default comparator would stringify into
// an order nobody chose. Sort it by its canonical key instead so "Teachers
// only" and "Teachers and students" group together predictably.
function pageComparator(key, dir) {
  if (key !== 'editingRoles') return compareBy(key, dir)
  const multiplier = dir === 'asc' ? 1 : -1
  return (a, b) => {
    const av = editingRolesKey(a.editingRoles)
    const bv = editingRolesKey(b.editingRoles)
    if (av < bv) return -1 * multiplier
    if (av > bv) return 1 * multiplier
    return 0
  }
}

export default function App() {
  const toast = useToast()
  const [courses, setCourses] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState(null)
  const [selectedCourseName, setSelectedCourseName] = useState('')
  const [pages, setPages] = useState([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [loadingPages, setLoadingPages] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState([])

  const [selectedIds, setSelectedIds] = useState(new Set())
  const [actions, setActions] = useState(INITIAL_ACTIONS)
  const [showPreview, setShowPreview] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [revisionsPage, setRevisionsPage] = useState(null)
  const [preview, setPreview] = useState(null) // { page, html, loading, error }

  const filteredPages = useMemo(
    () => applyPageFilters(pages, search, filters),
    [pages, search, filters],
  )

  const sort = useSort(filteredPages, { key: 'title', dir: 'asc' }, { comparator: pageComparator })

  const { showPanel, setShowPanel } = useKeyboardShortcuts([])

  useEffect(() => {
    async function init() {
      try {
        const [fetchedCourses, prefs] = await Promise.all([getCourses(), getPreferences()])
        applyPalette(prefs.palette)
        applyDarkMode(prefs.themeMode ?? 'system')
        applyTextSize(prefs.textSize ?? 'medium')
        setCourses(fetchedCourses)
        const initialId = resolveInitialCourseId(fetchedCourses, { prefs })
        if (initialId) selectCourse(initialId, fetchedCourses)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoadingCourses(false)
      }
    }
    init()
  }, [])

  async function selectCourse(courseId, courseList = courses) {
    const course = courseList.find(c => c.id === courseId)
    setSelectedCourseId(courseId)
    setSelectedCourseName(course?.name ?? '')
    setPages([])
    setSelectedIds(new Set())
    setActions(INITIAL_ACTIONS)
    setError(null)
    setSearch('')
    setFilters([])
    await setLastUsedCourse(courseId)
    await loadPages(courseId, '', [])
  }

  // Published state and title search are pushed to Canvas's own list endpoint
  // (doc 21, Decision 6) rather than pulling every page down to filter locally.
  // `applyPageFilters` still runs over the result so the table stays correct
  // between a filter change and this refetch landing.
  async function loadPages(courseId, searchTerm, activeFilters) {
    setLoadingPages(true)
    setError(null)
    try {
      const fetched = await getPages(courseId, {
        searchTerm: searchTerm || undefined,
        published: publishedParamFromFilters(activeFilters),
      })
      setPages(fetched)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingPages(false)
    }
  }

  function refresh() {
    if (selectedCourseId) loadPages(selectedCourseId, search, filters)
  }

  const selectedPages = useMemo(
    () => pages.filter(p => selectedIds.has(p.url)),
    [pages, selectedIds],
  )

  function clearSelection() {
    setSelectedIds(new Set())
    setActions(INITIAL_ACTIONS)
  }

  // The list endpoint omits `body`, so the preview costs one fetch per page.
  // It opens immediately in a loading state rather than stalling on the click.
  async function openPreview(page) {
    setPreview({ page, html: '', loading: true, error: null })
    try {
      const full = await getPage(selectedCourseId, page.url)
      setPreview(current => (
        current?.page.url === page.url
          ? { ...current, html: full.body, loading: false }
          : current
      ))
    } catch (err) {
      setPreview(current => (
        current?.page.url === page.url
          ? { ...current, loading: false, error: err.message }
          : current
      ))
    }
  }

  function handlePreviewDone() {
    setShowPreview(false)
    clearSelection()
    refresh()
  }

  function handleDeleted(deletedUrls) {
    const gone = new Set(deletedUrls)
    setPages(prev => prev.filter(p => !gone.has(p.url)))
    setSelectedIds(prev => {
      const next = new Set(prev)
      for (const url of gone) next.delete(url)
      return next
    })
    setActions(INITIAL_ACTIONS)
    toast(`${deletedUrls.length} page${deletedUrls.length !== 1 ? 's' : ''} deleted`, 'success')
  }

  function clearFilters() {
    setSearch('')
    setFilters([])
    if (selectedCourseId) loadPages(selectedCourseId, '', [])
  }

  // The published filter is the only one Canvas can answer, so it is the only
  // one that triggers a refetch. The rest narrow what is already loaded.
  function addFilter(filter) {
    const next = [...filters, filter]
    setFilters(next)
    if (filter.id === 'status' && selectedCourseId) loadPages(selectedCourseId, search, next)
  }

  function updateFilter(updated) {
    const next = filters.map(f => f.id === updated.id ? updated : f)
    setFilters(next)
    if (updated.id === 'status' && selectedCourseId) loadPages(selectedCourseId, search, next)
  }

  function removeFilter(id) {
    const next = filters.filter(f => f.id !== id)
    setFilters(next)
    if (id === 'status' && selectedCourseId) loadPages(selectedCourseId, search, next)
  }

  function toggleSelection(url) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  function toggleAllSelection(selectAll) {
    setSelectedIds(selectAll ? new Set(filteredPages.map(p => p.url)) : new Set())
  }

  function renderContent() {
    if (loadingCourses) {
      return (
        <Card
          padding="none"
          className="domain-accent flex-1 flex flex-col min-h-0 overflow-hidden mx-6 mt-4 mb-4 shadow-[var(--shadow-md)]"
          style={{ '--domain-color': 'var(--color-domain-content)' }}
        >
          <PagesTable
            pages={[]}
            selectedIds={new Set()}
            onToggle={() => {}}
            onToggleAll={() => {}}
            sortKey=""
            sortDir="asc"
            onSort={() => {}}
            onPreview={() => {}}
            onRevisions={() => {}}
            loading
            fillHeight
          />
        </Card>
      )
    }

    if (error) {
      return (
        <div className="px-6 py-4">
          <Callout tone="error" title="Something went wrong">
            {error}
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => selectedCourseId ? refresh() : window.location.reload()}
              >
                Try again
              </Button>
            </div>
          </Callout>
        </div>
      )
    }

    if (!selectedCourseId) {
      return (
        <EmptyState
          icon={BookOpen}
          title="Select a course to get started"
          body="Choose a course from the menu above to load its pages."
        />
      )
    }

    // A search or published filter is answered by Canvas, so an empty result
    // may mean "no matches" rather than "no pages" — keep the table's own
    // empty state for that and only claim the course is empty when it is.
    const filteringServerSide = !!search || filters.some(f => f.id === 'status')
    if (!loadingPages && pages.length === 0 && !filteringServerSide) {
      return <EmptyState icon={FileText} title="No pages in this course" />
    }

    return (
      <Card
        padding="none"
        className="domain-accent flex-1 flex flex-col min-h-0 overflow-hidden mx-6 mt-4 mb-4 shadow-[var(--shadow-md)]"
        style={{ '--domain-color': 'var(--color-domain-content)' }}
      >
        <PagesFilterBar
          search={search}
          onSearchChange={setSearch}
          filters={filters}
          onAddFilter={addFilter}
          onUpdateFilter={updateFilter}
          onRemoveFilter={removeFilter}
          onClearAll={clearFilters}
        />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {!loadingPages && filteredPages.length === 0 ? (
            <EmptyState
              icon={SlidersHorizontal}
              title="No pages match your filters"
              body="Try adjusting your search or removing a filter."
              actions={<Button variant="ghost" onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <PagesTable
              pages={loadingPages ? [] : sort.sorted}
              selectedIds={selectedIds}
              onToggle={toggleSelection}
              onToggleAll={toggleAllSelection}
              sortKey={sort.key}
              sortDir={sort.dir}
              onSort={sort.onSort}
              onPreview={openPreview}
              onRevisions={setRevisionsPage}
              loading={loadingPages}
              fillHeight
              actionBarVisible={selectedIds.size > 0}
            />
          )}
        </div>
      </Card>
    )
  }

  return (
    <>
      <SkipLink />
      <ToolShell
        start={
          <>
            <BrandLogo />
            <div className="w-px h-5 bg-[var(--color-border)] shrink-0" aria-hidden="true" />
            <CourseSelector
              courses={courses}
              selectedId={selectedCourseId}
              onChange={id => selectCourse(id)}
              loading={loadingCourses}
            />
          </>
        }
        end={
          <>
            <AppNav current="pages" />
            <SettingsButton />
          </>
        }
      >
        <div className="relative flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {renderContent()}
          </div>
          {preview && (
            <ContentPreview
              title={preview.page.title}
              subtitle={preview.page.published ? 'Published' : 'Unpublished'}
              html={preview.html}
              loading={preview.loading}
              error={preview.error}
              emptyNote={preview.page.editor === 'block_editor'
                ? 'This page is built with the block editor. Canvas keeps its layout separately from the page body, so there is nothing to render here — open it in Canvas to see it.'
                : 'This page has no content yet.'}
              onClose={() => setPreview(null)}
            />
          )}
        </div>
      </ToolShell>
      <PagesActionBar
        rightInset={preview ? PREVIEW_PANE_INSET : 0}
        selectedCount={selectedIds.size}
        actions={actions}
        onActionsChange={setActions}
        onPreview={() => setShowPreview(true)}
        onClearAll={clearSelection}
        onDelete={() => setShowDeleteModal(true)}
      />
      {showPreview && (
        <PagesPreviewDiff
          selectedPages={selectedPages}
          actions={actions}
          courseId={selectedCourseId}
          courseName={selectedCourseName}
          onCancel={() => setShowPreview(false)}
          onDone={handlePreviewDone}
        />
      )}
      {showDeleteModal && (
        <DeletePagesModal
          pages={selectedPages}
          courseId={selectedCourseId}
          courseName={selectedCourseName}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={handleDeleted}
        />
      )}
      {revisionsPage && (
        <PageRevisionsModal
          page={revisionsPage}
          courseId={selectedCourseId}
          courseName={selectedCourseName}
          onClose={() => setRevisionsPage(null)}
          onReverted={refresh}
        />
      )}
      {showPanel && <ShortcutsPanel onClose={() => setShowPanel(false)} context="pages" />}
    </>
  )
}
