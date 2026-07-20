import { describe, it, expect } from 'vitest';
import { OPENINGS } from './openings';
import { detectOpening } from '../analysis/openingDetector';

// Guards the generated full ECO book (scripts/genOpenings.mjs). If the book is
// regenerated, these invariants should still hold; if they don't, the generator
// or its source data changed in a way worth noticing.
describe('full opening book', () => {
  it('loads thousands of openings, not the 4-entry sample', () => {
    expect(OPENINGS.length).toBeGreaterThan(3000);
  });

  it('every entry has an eco, a name, and at least one UCI move', () => {
    for (const o of OPENINGS) {
      expect(o.eco).toMatch(/^[A-E]\d{2}$/);
      expect(o.name.length).toBeGreaterThan(0);
      expect(o.uciMoves.length).toBeGreaterThan(0);
      // UCI moves are 4 chars (+1 for a promotion piece).
      for (const m of o.uciMoves) expect(m).toMatch(/^[a-h][1-8][a-h][1-8][qrbn]?$/);
    }
  });

  it('detects the Ruy Lopez from its move list', () => {
    // 1.e4 e5 2.Nf3 Nc6 3.Bb5
    const game = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6'];
    const r = detectOpening(game, OPENINGS);
    expect(r.opening?.name.toLowerCase()).toContain('ruy lopez');
    expect(r.bookPlies).toBeGreaterThanOrEqual(5);
  });

  it('detects the Sicilian Najdorf, preferring the longest matching line', () => {
    // 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6
    const game = ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4', 'c5d4', 'f3d4', 'g8f6', 'b1c3', 'a7a6'];
    const r = detectOpening(game, OPENINGS);
    expect(r.opening?.name.toLowerCase()).toContain('najdorf');
  });
});
