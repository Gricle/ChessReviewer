import type { SupabaseClient } from '@supabase/supabase-js';

export interface LibraryRow {
  id: string;
  white_name: string; black_name: string;
  white_rating: number | null; black_rating: number | null;
  result: string | null; played_at: string | null;
  opening_name: string | null; source: string; created_at: string;
  reviews: { white_accuracy: number; black_accuracy: number } | null;
}

// Explicit columns only — reviews.analysis is huge and must not be listed here.
export async function fetchLibrary(client: SupabaseClient, limit = 50): Promise<LibraryRow[]> {
  const { data, error } = await client
    .from('games')
    .select('id, white_name, black_name, white_rating, black_rating, result, played_at, opening_name, source, created_at, reviews(white_accuracy, black_accuracy)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LibraryRow[];
}

export async function fetchSavedGame(client: SupabaseClient, gameId: string): Promise<{ pgn: string; analysis: unknown } | null> {
  const { data, error } = await client
    .from('games')
    .select('pgn, reviews(analysis)')
    .eq('id', gameId)
    .single();
  if (error) return null;
  const reviews = (data as { reviews?: { analysis?: unknown } | { analysis?: unknown }[] }).reviews;
  const analysis = Array.isArray(reviews) ? reviews[0]?.analysis : reviews?.analysis;
  return analysis === undefined ? null : { pgn: (data as { pgn: string }).pgn, analysis };
}

export interface Profile { display_name: string | null; chesscom_username: string | null; lichess_username: string | null; }

export async function fetchProfile(client: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await client.from('profiles')
    .select('display_name, chesscom_username, lichess_username').eq('id', userId).single();
  return error ? null : (data as Profile);
}

export async function saveProfile(client: SupabaseClient, userId: string, p: Profile): Promise<string | null> {
  const { error } = await client.from('profiles').upsert({ id: userId, ...p });
  return error ? error.message : null;
}
