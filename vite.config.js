import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
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
        communication:   resolve(__dirname, 'src/pages/communication/index.html'),
        sections:        resolve(__dirname, 'src/pages/sections/index.html'),
        accommodations:  resolve(__dirname, 'src/pages/accommodations/index.html'),
      },
    },
  },
})
