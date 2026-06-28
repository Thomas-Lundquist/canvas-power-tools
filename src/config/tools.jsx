import {
  LayoutList, BarChart2, Layers, BookTemplate, Copy,
  ClipboardList, Users, MessageSquare, SplitSquareVertical, Clock,
} from 'lucide-react'

// Single source of truth for all tool pages.
// AppNav, popup, settings, and the home page all read from here.
// To add a new tool: append one entry — nothing else needs changing.

export const MODULES = [
  { id: 'assignments',   label: 'Assignments'   },
  { id: 'grading',       label: 'Grading'       },
  { id: 'communication', label: 'Communication' },
  { id: 'people',        label: 'People'        },
]

export const TOOLS = [
  // ── Assignments (alphabetical) ─────────────────────────────────────────────
  {
    id:          'groups',
    module:      'assignments',
    label:       'Assignment Groups',
    shortLabel:  'Groups',
    description: 'Manage assignment groups, set grade weights, and reorder groups for any course.',
    Icon:        Layers,
    path:        'src/pages/groups/index.html',
  },
  {
    id:          'templates',
    module:      'assignments',
    label:       'Assignment Templates',
    shortLabel:  'Templates',
    description: 'Save assignment structures and deploy them to one or more courses instantly.',
    Icon:        BookTemplate,
    path:        'src/pages/templates/index.html',
  },
  {
    id:          'bulk-editor',
    module:      'assignments',
    label:       'Bulk Assignment Editor',
    shortLabel:  'Bulk Editor',
    description: 'Edit due dates, availability, points, and publish status across all assignments at once.',
    Icon:        LayoutList,
    path:        'src/pages/bulk-editor/index.html',
  },
  {
    id:          'duplicate',
    module:      'assignments',
    label:       'Copy Assignments',
    shortLabel:  'Copy',
    description: 'Copy assignments from one course to another with flexible date shifting options.',
    Icon:        Copy,
    path:        'src/pages/duplicate/index.html',
  },
  {
    id:          'rubrics',
    module:      'assignments',
    label:       'Rubric Manager',
    shortLabel:  'Rubrics',
    description: 'Create, edit, and reuse rubrics across assignments and courses.',
    Icon:        ClipboardList,
    path:        'src/pages/rubrics/index.html',
  },

  // ── Grading ────────────────────────────────────────────────────────────────
  {
    id:          'grading',
    module:      'grading',
    label:       'Grading Dashboard',
    shortLabel:  'Grading',
    description: 'View submission and grading progress for every assignment in a course at a glance.',
    Icon:        BarChart2,
    path:        'src/pages/grading/index.html',
  },

  // ── Communication ──────────────────────────────────────────────────────────
  {
    id:          'communication',
    module:      'communication',
    label:       'Communication',
    shortLabel:  'Messages',
    description: 'Nudge students who have not submitted, message by grade threshold, and send announcements to multiple courses.',
    Icon:        MessageSquare,
    path:        'src/pages/communication/index.html',
  },

  // ── People (alphabetical) ──────────────────────────────────────────────────
  {
    id:          'accommodations',
    module:      'people',
    label:       'Accommodations',
    shortLabel:  'Accommodations',
    description: 'Apply per-student due date overrides across multiple assignments in one flow.',
    Icon:        Clock,
    path:        'src/pages/accommodations/index.html',
  },
  {
    id:          'sections',
    module:      'people',
    label:       'Section Management',
    shortLabel:  'Sections',
    description: 'Set per-section due dates across assignments and compare grade distributions across sections.',
    Icon:        SplitSquareVertical,
    path:        'src/pages/sections/index.html',
  },
  {
    id:          'student-groups',
    module:      'people',
    label:       'Student Groups',
    shortLabel:  'Student Groups',
    description: 'Manage group sets, create groups, and auto-assign students by name, randomly, or by size.',
    Icon:        Users,
    path:        'src/pages/student-groups/index.html',
  },
]
