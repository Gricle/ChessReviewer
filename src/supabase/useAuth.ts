// Session state + auth actions. When supabase is null (no env config) the
// hook reports { enabled: false } and the UI renders nothing auth-related.
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './client';

export interface Auth {
  enabled: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

export function useAuth(): Auth {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return useMemo<Auth>(() => ({
    enabled: supabase !== null,
    user,
    signIn: async (email, password) => {
      if (!supabase) return 'Cloud sync is not configured.';
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    },
    signUp: async (email, password) => {
      if (!supabase) return 'Cloud sync is not configured.';
      // Send the confirmation email's redirect to this app's base URL (works in
      // dev at /ChessReviewer/ on :5173 and in prod on GitHub Pages), so the
      // callback lands on a page we serve rather than a 404.
      const emailRedirectTo = window.location.origin + import.meta.env.BASE_URL;
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
      return error ? error.message : null;
    },
    signInWithGoogle: async () => {
      if (!supabase) return 'Cloud sync is not configured.';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
      });
      return error ? error.message : null;
    },
    signOut: async () => {
      if (supabase) await supabase.auth.signOut();
    },
  }), [user]);
}
