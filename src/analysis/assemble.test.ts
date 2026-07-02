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

  it('estimates a high performance rating for both sides when every move is best/book', () => {
    const { summary } = assembleReview(game, flatAnalyses(game), OPENINGS);
    expect(summary.estRating.white).toBeGreaterThanOrEqual(2500);
    expect(summary.estRating.black).toBeGreaterThanOrEqual(2500);
  });

  // Book coverage (OPENINGS sample) stops after 5 plies (1.e4 e5 2.Nf3 Nc6 3.Bb5),
  // so appending 3...a6 gives black a 6th ply that the opening detector does NOT
  // tag as book. That's the only ply we corrupt into a blunder below, which is
  // what lets this test catch a color swap / wrong tally / wrong move count in
  // assembleReview's wiring into estimatePerformanceRating -- the all-best/book
  // fixture above is too symmetric to detect that class of bug.
  const blunderGame: ParsedGame = parsePgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *');

  // Same "everyone played the engine's best move" fixture as flatAnalyses, except
  // black's non-book 3...a6 (ply index 5) is turned into a real blunder: the
  // engine's move there is something else, and the position after it is
  // evaluated as crushing for white. Every other ply (all of white's, and
  // black's book moves) is left exactly as clean as flatAnalyses makes it.
  function blunderAnalyses(g: ParsedGame): Map<string, PositionAnalysis> {
    const m = flatAnalyses(g);
    const blunderPly = g.plies[5];
    m.set(blunderPly.fenBefore, {
      fen: blunderPly.fenBefore,
      bestMoveUci: 'g8f6', // anything other than the played a7a6
      bestEvalCp: 0,
      secondBestEvalCp: 0,
      mate: null,
    });
    m.set(blunderPly.fenAfter, {
      fen: blunderPly.fenAfter,
      bestMoveUci: 'a2a3',
      bestEvalCp: 800, // white to move, crushing for white after black's blunder
      secondBestEvalCp: 0,
      mate: null,
    });
    return m;
  }

  it('drops black\'s (but not white\'s) performance rating when only black blunders', () => {
    const clean = assembleReview(blunderGame, flatAnalyses(blunderGame), OPENINGS).summary;
    const { plies, summary } = assembleReview(blunderGame, blunderAnalyses(blunderGame), OPENINGS);

    // Pin that the fixture actually produced a blunder -- otherwise the rating
    // assertions below could pass vacuously.
    expect(plies[5].color).toBe('black');
    expect(plies[5].classification).toBe('blunder');

    expect(summary.estRating.black).toBeLessThan(summary.estRating.white);
    expect(summary.estRating.black).toBeLessThan(clean.estRating.black);
  });
});
