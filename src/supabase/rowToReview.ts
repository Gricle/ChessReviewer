// Rebuild the in-memory game + review from a stored games.pgn + reviews.analysis.
// Defensive: rows written by future/past versions must fail soft (null), never throw.
import { parsePgn } from '../chess/pgnParser';
import type { ParsedGame } from '../chess/types';
import type { Review } from '../analysis/assemble';

export function rowToReview(
  pgn: string,
  analysis: unknown,
): { game: ParsedGame; review: Review } | null {
  try {
    const game = parsePgn(pgn);
    const a = analysis as { plies?: unknown; summary?: unknown } | null;
    if (!a || !Array.isArray(a.plies) || typeof a.summary !== 'object' || a.summary === null) return null;
    const review = { plies: a.plies, summary: a.summary } as Review;
    if (review.plies.length !== game.plies.length) return null;
    if (!review.summary.counts || !review.summary.estRating) return null;
    return { game, review };
  } catch {
    return null;
  }
}
