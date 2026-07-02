import { describe, it, expect } from 'vitest';
import { rowToReview } from './rowToReview';
import { parsePgn } from '../chess/pgnParser';
import { assembleReview } from '../analysis/assemble';
import { OPENINGS } from '../data/openings.sample';
import type { ParsedGame, PositionAnalysis } from '../chess/types';

function flatAnalyses(g: ParsedGame): Map<string, PositionAnalysis> {
  const m = new Map<string, PositionAnalysis>();
  const add = (fen: string, bestUci: string) =>
    m.set(fen, { fen, bestMoveUci: bestUci, bestEvalCp: 0, secondBestEvalCp: 0, mate: null });
  g.plies.forEach((p) => add(p.fenBefore, p.uci));
  add(g.plies[g.plies.length - 1].fenAfter, 'a2a3');
  return m;
}

const PGN = '1. e4 e5 2. Nf3 Nc6 3. Bb5 *';

describe('rowToReview', () => {
  it('round-trips a stored review back to game + review', () => {
    const original = parsePgn(PGN);
    const review = assembleReview(original, flatAnalyses(original), OPENINGS);
    const analysis = JSON.parse(JSON.stringify({ plies: review.plies, summary: review.summary }));
    const out = rowToReview(PGN, analysis);
    expect(out).not.toBeNull();
    expect(out!.game.plies).toHaveLength(5);
    expect(out!.review.summary.opening?.name).toBe('Ruy Lopez');
    expect(out!.review.plies[0].classification).toBe('book');
  });

  it('returns null on unparseable pgn or malformed analysis', () => {
    expect(rowToReview('not a pgn $$$', { plies: [], summary: {} })).toBeNull();
    expect(rowToReview(PGN, null)).toBeNull();
    expect(rowToReview(PGN, { plies: 'nope' })).toBeNull();
  });
});
