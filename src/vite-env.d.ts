/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SNAKE_API_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_URL: string;
}

declare const __APP_VERSION__: string;
