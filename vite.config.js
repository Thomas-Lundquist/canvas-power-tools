import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// CRXJS intercepts every <script src="..."> in HTML and tries to transform it
// as a module entry. theme-init.js is a minified IIFE in public/ — not a module
// — so CRXJS's transform 500s in dev. Strip it before CRXJS sees it, then
// re-inject after CRXJS is done. Production build is unaffected.
const CLASSIC_SCRIPTS = ['/theme-init.js']

const stripClassicScripts = {
  name: 'strip-classic-scripts',
  enforce: 'pre',
  transformIndexHtml(html) {
    return CLASSIC_SCRIPTS.reduce(
      (h, src) => h.replace(`<script src="${src}"></script>`, ''),
      html,
    )
  },
}

const injectClassicScripts = {
  name: 'inject-classic-scripts',
  enforce: 'post',
  transformIndexHtml(html) {
    const tags = CLASSIC_SCRIPTS.map(src => `  <script src="${src}"></script>`).join('\n')
    return html.replace('</head>', `${tags}\n</head>`)
  },
}

export default defineConfig({
  plugins: [
    stripClassicScripts,
    react(),
    crx({ manifest }),
    injectClassicScripts,
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        home:       resolve(__dirname, 'src/shell/index.html'),
        onboarding: resolve(__dirname, 'src/pages/onboarding/index.html'),
        bulkEditor: resolve(__dirname, 'src/pages/bulk-editor/index.html'),
        settings:   resolve(__dirname, 'src/settings/index.html'),
        templates:  resolve(__dirname, 'src/pages/templates/index.html'),
        duplicate:  resolve(__dirname, 'src/pages/duplicate/index.html'),
        grading:    resolve(__dirname, 'src/pages/grading/index.html'),
        groups:     resolve(__dirname, 'src/pages/groups/index.html'),
        rubrics:         resolve(__dirname, 'src/pages/rubrics/index.html'),
        studentGroups:   resolve(__dirname, 'src/pages/student-groups/index.html'),
        submissionReminders: resolve(__dirname, 'src/pages/submission-reminders/index.html'),
        gradeOutreach:       resolve(__dirname, 'src/pages/grade-outreach/index.html'),
        announcements:       resolve(__dirname, 'src/pages/announcements/index.html'),
        sections:        resolve(__dirname, 'src/pages/sections/index.html'),
        accommodations:  resolve(__dirname, 'src/pages/accommodations/index.html'),
      },
    },
  },
})
