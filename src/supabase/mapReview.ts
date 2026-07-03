// Pure mapping from an in-memory review to the row payloads uploadReview
// writes to Postgres. No supabase import — unit-testable offline.
import type { AnalyzedPly, ParsedGame } from '../chess/types';
import type { Review } from '../analysis/assemble';
import { playerRatings } from '../chess/ratings';
import { cpToWinPercent } from '../analysis/winPercent';
import { gamePhase } from '../analysis/gamePhase';
import { hashString } from './syncQueue';
import { forkTargets, isMateScore, isMatedScore, newlyHungPiece } from '../coach/motifs';
import { BAD_CLASSES } from '../coach/explain';

export type GameSource = 'paste' | 'chesscom' | 'lichess';

export interface ReviewUpload {
  game: {
    pgn: string;
    pgn_hash: string;
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
    motifs: string[];
  }>;
}

// Tags a ply with the motifs Phase 6's weakness reports aggregate over.
// Mirrors the conditions explain.ts uses to pick its "why" clause (rules
// 2a/2b/2c) plus fork detection on both the played and the best move.
function motifsFor(p: AnalyzedPly): string[] {
  const moverColor: 'w' | 'b' = p.color === 'white' ? 'w' : 'b';
  const isBad = BAD_CLASSES.has(p.classification);
  const motifs: string[] = [];

  if (isMatedScore(p.evalAfterCp) && !isMatedScore(p.evalBeforeCp)) {
    motifs.push('walked_into_mate');
  }
  if (isMateScore(p.evalBeforeCp) && !isMateScore(p.evalAfterCp)) {
    motifs.push('missed_mate');
  }
  if (isBad && newlyHungPiece(p.fenBefore, p.fenAfter, moverColor)) {
    motifs.push('hung_piece');
  }
  if (isBad && forkTargets(p.fenBefore, p.bestMoveUci).length >= 2) {
    motifs.push('missed_fork');
  }
  if (forkTargets(p.fenBefore, p.uci).length >= 2) {
    motifs.push('fork');
  }

  return motifs;
}

// PGN dates are "YYYY.MM.DD", possibly with "??" parts for unknowns.
function pgnDateToIso(value: string | undefined): string | null {
  if (!value) return null;
  const iso = value.replaceAll('.', '-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  // Reject well-shaped garbage like "2024-13-40" that Postgres would bounce.
  return Number.isNaN(Date.parse(iso)) ? null : iso;
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
  const pgnText = pgn ?? reconstructPgn(game);

  return {
    game: {
      pgn: pgnText,
      pgn_hash: hashString(pgnText),
      white_name: game.white,
      black_name: game.black,
      white_rating: ratings.white,
      black_rating: ratings.black,
      result,
      played_at: pgnDateToIso(game.headers.UTCDate) ?? pgnDateToIso(game.headers.Date),
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
      motifs: motifsFor(p),
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
