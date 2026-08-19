import {createClient, type SupabaseClient} from '@supabase/supabase-js';

const DEFAULT_URL = 'https://rdiqgzimnkxqimhvhmwz.supabase.co';
const DEFAULT_ANON_KEY = 'sb_publishable_jmVRwMMu1makeVVLm908ng_lYVZ51J5';

export function supabaseUrl(): string {
  const explicit = import.meta.env.VITE_SUPABASE_URL;
  if (typeof explicit === 'string' && explicit !== '') {
    return explicit.replace(/\/$/, '');
  }
  const api = import.meta.env.VITE_SNAKE_API_URL;
  if (typeof api === 'string') {
    const match = /https:\/\/[^/]+\.supabase\.co/.exec(api);
    if (match) {
      return match[0];
    }
  }
  return DEFAULT_URL;
}

export function supabaseAnonKey(): string {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return typeof key === 'string' && key !== '' ? key : DEFAULT_ANON_KEY;
}

let client: SupabaseClient | null = null;

export function snakeSupabase(): SupabaseClient {
  client ??= createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: {persistSession: false, autoRefreshToken: false},
  });
  return client;
}
