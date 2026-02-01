/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_E2E?: string
  readonly VITE_PDFJS_DISABLE_WORKER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
