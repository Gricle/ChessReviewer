// Single Supabase client for the whole app — or null when the env vars are
// missing, which turns every cloud feature into a silent no-op (guest-only
// build). Real keys go in .env.local (gitignored); see .env.example.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;
