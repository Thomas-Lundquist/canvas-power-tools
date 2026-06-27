import { LayoutList, BarChart2, Layers, BookTemplate, Copy, ClipboardList, Users, MessageSquare } from 'lucide-react'

// Single source of truth for all tool pages.
// AppNav, popup, settings, and the home page all read from here.
// To add a new tool: append one entry — nothing else needs changing.
export const TOOLS = [
  {
    id:          'bulk-editor',
    label:       'Bulk Assignment Editor',
    shortLabel:  'Bulk Editor',
    description: 'Edit due dates, availability, points, and publish status across all assignments at once.',
    Icon:        LayoutList,
    path:        'src/pages/bulk-editor/index.html',
  },
  {
    id:          'grading',
    label:       'Grading Dashboard',
    shortLabel:  'Grading',
    description: 'View submission and grading progress for every assignment in a course at a glance.',
    Icon:        BarChart2,
    path:        'src/pages/grading/index.html',
  },
  {
    id:          'groups',
    label:       'Assignment Groups',
    shortLabel:  'Groups',
    description: 'Manage assignment groups, set grade weights, and reorder groups for any course.',
    Icon:        Layers,
    path:        'src/pages/groups/index.html',
  },
  {
    id:          'templates',
    label:       'Assignment Templates',
    shortLabel:  'Templates',
    description: 'Save assignment structures and deploy them to one or more courses instantly.',
    Icon:        BookTemplate,
    path:        'src/pages/templates/index.html',
  },
  {
    id:          'duplicate',
    label:       'Copy Assignments',
    shortLabel:  'Copy',
    description: 'Copy assignments from one course to another with flexible date shifting options.',
    Icon:        Copy,
    path:        'src/pages/duplicate/index.html',
  },
  {
    id:          'rubrics',
    label:       'Rubric Manager',
    shortLabel:  'Rubrics',
    description: 'Create, edit, and reuse rubrics across assignments and courses.',
    Icon:        ClipboardList,
    path:        'src/pages/rubrics/index.html',
  },
  {
    id:          'student-groups',
    label:       'Student Groups',
    shortLabel:  'Students',
    description: 'Manage group sets, create groups, and auto-assign students by name, randomly, or by size.',
    Icon:        Users,
    path:        'src/pages/student-groups/index.html',
  },
  {
    id:          'communication',
    label:       'Communication',
    shortLabel:  'Messages',
    description: 'Nudge students who have not submitted, message by grade threshold, and send announcements to multiple courses.',
    Icon:        MessageSquare,
    path:        'src/pages/communication/index.html',
  },
]
