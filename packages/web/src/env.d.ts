/// <reference types="vite/client" />

// Injected by vite.config.ts `define` — the monorepo version baked in at build
// time, used to construct the R2 download filenames.
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** Public base URL for release artifacts (Cloudflare R2). */
  readonly VITE_R2_PUBLIC_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module '*.svg' {
  const src: string
  export default src
}
