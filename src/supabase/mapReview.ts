// Pure mapping from an in-memory review to the row payloads uploadReview
// writes to Postgres. No supabase import — unit-testable offline.
import type { ParsedGame } from '../chess/types';
import type { Review } from '../analysis/assemble';
import { playerRatings } from '../chess/ratings';
import { cpToWinPercent } from '../analysis/winPercent';
import { gamePhase } from '../analysis/gamePhase';

export type GameSource = 'paste' | 'chesscom' | 'lichess';

export interface ReviewUpload {
  game: {
    pgn: string;
    white_name: string;
    black_name: string;
    white_rating: number | null;
    black_rating: number | null;
    result: string | null;
    played_at: string | null; // ISO date
    source: GameSource;
    opening_eco: string | null;
    opening_name: string | null;
  };
  review: {
    white_accuracy: number;
    black_accuracy: number;
    white_est_rating: number;
    black_est_rating: number;
    counts: Review['summary']['counts'];
    analysis: { plies: Review['plies']; summary: Review['summary'] };
    depth: number;
  };
  move_facts: Array<{
    ply: number;
    side: 'white' | 'black';
    classification: string;
    win_drop: number;
    phase: 'opening' | 'middlegame' | 'endgame';
  }>;
}

// PGN dates are "YYYY.MM.DD", possibly with "??" parts for unknowns.
function pgnDateToIso(value: string | undefined): string | null {
  if (!value) return null;
  const iso = value.replaceAll('.', '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

export function mapReview(
  game: ParsedGame,
  review: Review,
  source: GameSource,
  depth: number,
  pgn?: string,
): ReviewUpload {
  const ratings = playerRatings(game.headers);
  const result = game.headers.Result && game.headers.Result !== '*' ? game.headers.Result : null;
  const opening = review.summary.opening;

  return {
    game: {
      pgn: pgn ?? reconstructPgn(game),
      white_name: game.white,
      black_name: game.black,
      white_rating: ratings.white,
      black_rating: ratings.black,
      result,
      played_at: pgnDateToIso(game.headers.UTCDate ?? game.headers.Date),
      source,
      opening_eco: opening?.eco ?? null,
      opening_name: opening?.name ?? null,
    },
    review: {
      white_accuracy: review.summary.whiteAccuracy,
      black_accuracy: review.summary.blackAccuracy,
      white_est_rating: review.summary.estRating.white,
      black_est_rating: review.summary.estRating.black,
      counts: review.summary.counts,
      analysis: { plies: review.plies, summary: review.summary },
      depth,
    },
    move_facts: review.plies.map((p) => ({
      ply: p.index,
      side: p.color,
      classification: p.classification,
      win_drop: Math.max(
        0,
        cpToWinPercent(p.evalBeforeCp) - cpToWinPercent(p.evalAfterCp),
      ),
      phase: gamePhase(p.fenBefore, p.index),
    })),
  };
}

// Minimal PGN reconstruction from parsed plies + headers (used when the
// original text isn't passed in). Good enough for storage/dedup purposes.
function reconstructPgn(game: ParsedGame): string {
  const headerLines = Object.entries(game.headers)
    .map(([k, v]) => `[${k} "${v}"]`)
    .join('\n');
  const moves = game.plies
    .map((p, i) => (i % 2 === 0 ? `${p.moveNumber}. ${p.san}` : p.san))
    .join(' ');
  const result = game.headers.Result ?? '*';
  return `${headerLines}\n\n${moves} ${result}`.trim();
}
