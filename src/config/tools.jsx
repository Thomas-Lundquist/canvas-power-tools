import { LayoutList, BarChart2, Layers, BookTemplate, Copy } from 'lucide-react'

// Single source of truth for all tool pages.
// AppNav, popup, and settings all read from here.
// To add a new tool: append one entry — nothing else needs changing.
export const TOOLS = [
  {
    id:         'bulk-editor',
    label:      'Bulk Assignment Editor',
    shortLabel: 'Bulk Editor',
    Icon:       LayoutList,
    path:       'src/pages/bulk-editor/index.html',
  },
  {
    id:         'grading',
    label:      'Grading Dashboard',
    shortLabel: 'Grading',
    Icon:       BarChart2,
    path:       'src/pages/grading/index.html',
  },
  {
    id:         'groups',
    label:      'Assignment Groups',
    shortLabel: 'Groups',
    Icon:       Layers,
    path:       'src/pages/groups/index.html',
  },
  {
    id:         'templates',
    label:      'Assignment Templates',
    shortLabel: 'Templates',
    Icon:       BookTemplate,
    path:       'src/pages/templates/index.html',
  },
  {
    id:         'duplicate',
    label:      'Copy Assignments',
    shortLabel: 'Copy',
    Icon:       Copy,
    path:       'src/pages/duplicate/index.html',
  },
]
