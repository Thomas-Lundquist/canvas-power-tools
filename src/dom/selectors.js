export const SELECTORS = {
  assignmentListToolbar: {
    description: 'Toolbar above the assignment list on the Assignments page',
    pagePattern: '/courses/*/assignments',
    strategies: [
      '.assignment_header',
      '[data-testid="assignment-list-header"]',
      '.ig-header',
      '.assignment_group .ig-header',
    ],
    fallback: 'structural',
    structuralHint: {
      container: 'div',
      childSelector: '.ig-header-title, h2',
      minChildren: 1,
    },
  },

  assignmentList: {
    description: 'Main assignment list container on the Assignments page',
    pagePattern: '/courses/*/assignments',
    strategies: [
      '#content',
      '[data-testid="assignment-list"]',
      '.assignment_group',
      'div.content-box',
    ],
    fallback: 'structural',
    structuralHint: {
      container: 'div',
      childSelector: '.assignment',
      minChildren: 1,
    },
  },

  courseNavigation: {
    description: 'Left sidebar course navigation',
    pagePattern: '/courses/*',
    strategies: [
      'nav.course-menu',
      '[data-testid="course-navigation"]',
      'nav[aria-label="Course Navigation"]',
      '#section-tabs',
      'nav#menu',
    ],
    fallback: 'structural',
    structuralHint: {
      container: 'nav',
      childSelector: 'a[href*="/courses/"]',
      minChildren: 3,
    },
  },

  assignmentTitle: {
    description: 'Title element on an assignment detail page',
    pagePattern: '/courses/*/assignments/*',
    strategies: [
      '.assignment-title',
      '[data-testid="assignment-title"]',
      'h1.title',
      'h1[class*="title"]',
      '.title h1',
    ],
    fallback: 'proximity',
    proximityHint: { anchor: 'h1', position: 'self' },
  },

  assignmentDetailActions: {
    description: 'Action button area on an assignment detail page (next to Edit/Delete buttons)',
    pagePattern: '/courses/*/assignments/*',
    strategies: [
      '.header-bar-right',
      '[data-testid="assignment-header-actions"]',
      '.assignment-buttons',
      '.edit_assignment_link',
      '.control-group',
    ],
    fallback: 'proximity',
    proximityHint: { anchor: 'h1', position: 'self' },
  },

  pageTitle: {
    description: 'Title element on a course wiki page view',
    pagePattern: '/courses/*/pages/*',
    strategies: [
      '.page-title',
      '[data-testid="wikiPage-title"]',
      '.show-content .page-title',
      'h1.title',
      'h2.page-title',
    ],
    fallback: 'proximity',
    proximityHint: { anchor: 'h1', position: 'self' },
  },

  pageDetailActions: {
    description: 'Action button area on a course wiki page view (next to Edit)',
    pagePattern: '/courses/*/pages/*',
    strategies: [
      '.header-bar-right',
      '[data-testid="wikiPage-header-actions"]',
      '.page-toolbar-right',
      '.edit-wiki',
      '.header-bar .pull-right',
    ],
    fallback: 'proximity',
    proximityHint: { anchor: 'h1', position: 'self' },
  },
}
