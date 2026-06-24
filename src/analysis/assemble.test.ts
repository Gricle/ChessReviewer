import { describe, it, expect } from 'vitest';
import { assembleReview } from './assemble';
import type { ParsedGame, PositionAnalysis } from '../chess/types';
import { parsePgn } from '../chess/pgnParser';
import { OPENINGS } from '../data/openings.sample';

// A 5-ply Ruy Lopez so the opening detector tags every move as book.
const game: ParsedGame = parsePgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 *');

// Build a trivial analysis map: pretend every position is dead equal and the
// engine's "best" move equals what was played, so all moves are book/best.
function flatAnalyses(g: ParsedGame): Map<string, PositionAnalysis> {
  const m = new Map<string, PositionAnalysis>();
  const add = (fen: string, bestUci: string) =>
    m.set(fen, { fen, bestMoveUci: bestUci, bestEvalCp: 0, secondBestEvalCp: 0, mate: null });
  g.plies.forEach((p) => add(p.fenBefore, p.uci));
  const last = g.plies[g.plies.length - 1];
  add(last.fenAfter, 'a2a3');
  return m;
}

describe('assembleReview', () => {
  it('produces one AnalyzedPly per ply', () => {
    const { plies } = assembleReview(game, flatAnalyses(game), OPENINGS);
    expect(plies).toHaveLength(5);
  });

  it('tags opening moves as book and reports the opening name', () => {
    const { plies, summary } = assembleReview(game, flatAnalyses(game), OPENINGS);
    expect(plies[0].classification).toBe('book');
    expect(summary.opening?.name).toBe('Ruy Lopez');
  });

  it('computes per-player accuracy near 100 when every move is best/book', () => {
    const { summary } = assembleReview(game, flatAnalyses(game), OPENINGS);
    expect(summary.whiteAccuracy).toBeGreaterThan(99);
    expect(summary.blackAccuracy).toBeGreaterThan(99);
  });
});
