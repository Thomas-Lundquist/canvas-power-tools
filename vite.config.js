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
        onboarding: resolve(__dirname, 'src/pages/onboarding/index.html'),
        bulkEditor: resolve(__dirname, 'src/pages/bulk-editor/index.html'),
        settings:   resolve(__dirname, 'src/pages/settings/index.html'),
        templates:  resolve(__dirname, 'src/pages/templates/index.html'),
        duplicate:  resolve(__dirname, 'src/pages/duplicate/index.html'),
        grading:    resolve(__dirname, 'src/pages/grading/index.html'),
        groups:     resolve(__dirname, 'src/pages/groups/index.html'),
      },
    },
  },
})
