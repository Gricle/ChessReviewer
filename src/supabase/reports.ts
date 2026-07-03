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

export async function fetchReportFacts(client: SupabaseClient, limit = 10000): Promise<ReportFactRow[]> {
  const { data, error } = await client
    .from('move_facts')
    .select('game_id, side, classification, phase, motifs, win_drop')
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ReportFactRow[];
}
