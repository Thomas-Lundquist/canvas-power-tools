/**
 * ESLint flat config (v9) — token guard.
 *
 * Single purpose: fail the lint on raw Tailwind color utilities so tool markup
 * cannot bypass the semantic token layer (--color-*) and re-fragment the UI.
 * See design system convergence: every color must flow through a token, e.g.
 * `text-[var(--color-text-muted)]`, never `text-gray-500`.
 *
 * This is intentionally NOT a full React lint preset — a broader ruleset would
 * flood the report with unrelated findings and bury the migration worklist.
 * (React/a11y linting is reserved for a separate pass; eslint-plugin-react is
 * installed but not wired here yet.)
 *
 * While the per-tool convergence is in progress `npm run lint` is expected to
 * fail: its error count is the burndown meter, dropping to 0 when done.
 */

// Utilities that carry color, and the raw Tailwind palette names that bypass
// the token layer. `-[0-9]` requires the numeric shade (e.g. gray-500), so
// arbitrary-value classes like text-[var(--color-…)] are never matched.
const COLOR_PREFIX = 'bg|text|border|ring|from|to|via|divide|placeholder|fill|stroke|outline|decoration|ring-offset'
const RAW_PALETTE =
  'gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const RAW_COLOR = `(${COLOR_PREFIX})-(${RAW_PALETTE})-[0-9]`

const MESSAGE =
  'Raw Tailwind color class bypasses the design tokens. Use a semantic token, ' +
  'e.g. text-[var(--color-text-muted)] / bg-[var(--color-bg-surface)] / ' +
  'border-[var(--color-border)] — see src/styles/global.css.'

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        // Static className strings: className="… text-gray-500 …"
        { selector: `Literal[value=/${RAW_COLOR}/]`, message: MESSAGE },
        // Template-literal className: className={`… ${x} border-gray-200`}
        { selector: `TemplateElement[value.cooked=/${RAW_COLOR}/]`, message: MESSAGE },
      ],
    },
  },
]
