import { describe, it, expect } from 'vitest';
import { parsePgn } from './pgnParser';

const PGN = `[White "Alice"]
[Black "Bob"]

1. e4 e5 2. Nf3 Nc6 *`;

describe('parsePgn', () => {
  it('parses headers and player names', () => {
    const g = parsePgn(PGN);
    expect(g.white).toBe('Alice');
    expect(g.black).toBe('Bob');
  });

  it('produces one ply per half-move with correct UCI and color', () => {
    const g = parsePgn(PGN);
    expect(g.plies).toHaveLength(4);
    expect(g.plies[0]).toMatchObject({ san: 'e4', uci: 'e2e4', color: 'white', moveNumber: 1 });
    expect(g.plies[1]).toMatchObject({ san: 'e5', uci: 'e7e5', color: 'black', moveNumber: 1 });
    expect(g.plies[2]).toMatchObject({ san: 'Nf3', uci: 'g1f3', color: 'white', moveNumber: 2 });
  });

  it('records fenBefore of the first ply as the start position', () => {
    const g = parsePgn(PGN);
    expect(g.plies[0].fenBefore.startsWith(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w'
    )).toBe(true);
    expect(g.plies[0].fenAfter).toBe(g.plies[1].fenBefore);
  });

  it('throws on invalid PGN', () => {
    expect(() => parsePgn('this is not pgn 1. Zz9')).toThrow();
  });
});
