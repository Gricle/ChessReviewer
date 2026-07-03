import type { SupabaseClient } from '@supabase/supabase-js';

export interface ReportGameRow {
  id: string;
  white_name: string; black_name: string;
  opening_name: string | null;
  played_at: string | null; created_at: string;
  reviews: { white_accuracy: number; black_accuracy: number; white_est_rating: number; black_est_rating: number } | null;
}
export interface ReportFactRow {
  game_id: string; side: 'white' | 'black';
  classification: string; phase: string; motifs: string[];
  win_drop: number;
}

export async function fetchReportGames(client: SupabaseClient, limit = 200): Promise<ReportGameRow[]> {
  const { data, error } = await client
    .from('games')
    .select('id, white_name, black_name, opening_name, played_at, created_at, reviews(white_accuracy, black_accuracy, white_est_rating, black_est_rating)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ReportGameRow[];
}

// Small enough that a chunk's .in('game_id', chunk) clause stays well under
// any practical URL length limit.
const ID_CHUNK_SIZE = 50;
// PostgREST commonly caps a single response at 1000 rows regardless of an
// explicit .limit(); a chunk of 50 games could plausibly carry well over
// 1000 move_facts between them (long games, many motifs per move). Rather
// than guess a "safe" chunk size from an average facts-per-game figure (which
// could be wrong for any individual chunk), page each chunk with .range()
// until a page comes back short — that is correct regardless of how the
// facts happen to be distributed across the games in the chunk.
const PAGE_SIZE = 1000;

/**
 * Fetch move_facts rows strictly scoped to `gameIds` (chunked + paginated, see
 * above) — coverage is deterministic: facts are fetched only for the games
 * passed in, never an arbitrary slice of the table.
 */
export async function fetchReportFacts(client: SupabaseClient, gameIds: string[]): Promise<ReportFactRow[]> {
  const out: ReportFactRow[] = [];
  for (let i = 0; i < gameIds.length; i += ID_CHUNK_SIZE) {
    const chunk = gameIds.slice(i, i + ID_CHUNK_SIZE);
    let from = 0;
    for (;;) {
      const { data, error } = await client
        .from('move_facts')
        .select('game_id, side, classification, phase, motifs, win_drop')
        .in('game_id', chunk)
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as ReportFactRow[];
      out.push(...rows);
      if (rows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }
  return out;
}
