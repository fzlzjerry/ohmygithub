import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// Download links track the monorepo version (bumpp -r keeps every package in
// sync), so the artifact filenames on R2 always match the current release.
const rootPkg = JSON.parse(
  readFileSync(resolve(__dirname, '../../package.json'), 'utf-8')
) as { version: string }

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // The ui package ships raw source, so mirror the client renderer aliases:
      // its internal `#` alias plus the package entry + style.css entry points.
      '#': resolve(__dirname, '../ui/src'),
      '@oh-my-github/ui/style.css': resolve(__dirname, '../ui/src/style.css'),
      '@oh-my-github/ui/styles.css': resolve(__dirname, '../ui/src/style.css'),
      '@oh-my-github/ui': resolve(__dirname, '../ui/src/index.ts')
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version)
  },
  plugins: [vue(), tailwindcss()]
})
