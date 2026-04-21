/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** NewsAPI.ai (Event Registry) — news feed; key from https://newsapi.ai/dashboard */
  readonly VITE_NEWSAPI_AI_KEY?: string;
  /** Override Event Registry origin (default https://eventregistry.org) */
  readonly VITE_NEWSAPI_AI_ORIGIN?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
