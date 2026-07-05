// Pure planning helpers for the "score my latest games on login" feature.
// No supabase/engine imports — trivially unit-testable offline. The App-level
// orchestrator wires these to the existing importers + analysis pipeline.
import type { GameSource } from '../supabase/mapReview';

export interface ImportTarget {
  source: Extract<GameSource, 'chesscom' | 'lichess'>;
  username: string;
}

// Which connected account to auto-pull recent games from. chess.com wins when
// both usernames are set: its public API returns full PGNs for every game type
// without auth, so it's the most reliable default. Returns null when neither
// username is configured.
export function chooseImportSource(
  profile: { chesscom_username: string | null; lichess_username: string | null } | null,
): ImportTarget | null {
  if (!profile) return null;
  const com = profile.chesscom_username?.trim();
  if (com) return { source: 'chesscom', username: com };
  const li = profile.lichess_username?.trim();
  if (li) return { source: 'lichess', username: li };
  return null;
}

// The n most-recently-played games, newest first. Sorts by explicit timestamp
// (not the day-granular `date` string) so games played on the same day still
// order correctly. Stable for equal timestamps (keeps input order).
export function latestGames<T extends { playedAt: number }>(games: readonly T[], n: number): T[] {
  return games
    .map((g, i) => ({ g, i }))
    .sort((a, b) => b.g.playedAt - a.g.playedAt || a.i - b.i)
    .slice(0, Math.max(0, n))
    .map((x) => x.g);
}

// Games not already stored for this user, compared by the same djb2 pgn hash
// the DB row carries in `pgn_hash` (see mapReview) — so we skip re-analyzing
// anything already in the library. Preserves input order.
export function unreviewedGames<T extends { pgn: string }>(
  games: readonly T[],
  existingHashes: ReadonlySet<string>,
  hash: (s: string) => string,
): T[] {
  return games.filter((g) => !existingHashes.has(hash(g.pgn)));
}
