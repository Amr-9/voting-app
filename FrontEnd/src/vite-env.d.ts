/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_CF_TURNSTILE_SITE_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
