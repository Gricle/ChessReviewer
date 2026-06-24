import { describe, it, expect } from 'vitest';
import { detectOpening, type Opening } from './openingDetector';

const BOOK: Opening[] = [
  { eco: 'C60', name: 'Ruy Lopez', uciMoves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'] },
  { eco: 'C50', name: 'Italian Game', uciMoves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'] },
  { eco: 'B20', name: 'Sicilian Defense', uciMoves: ['e2e4', 'c7c5'] },
];

describe('detectOpening', () => {
  it('matches the longest opening prefix of the game', () => {
    const game = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6'];
    const r = detectOpening(game, BOOK);
    expect(r.opening?.name).toBe('Ruy Lopez');
    expect(r.bookPlies).toBe(5);
  });

  it('returns null when no opening matches', () => {
    const r = detectOpening(['g1f3', 'g8f6'], BOOK);
    expect(r.opening).toBeNull();
    expect(r.bookPlies).toBe(0);
  });

  it('does not match an opening longer than the game', () => {
    const r = detectOpening(['e2e4', 'e7e5', 'g1f3'], BOOK);
    expect(r.opening).toBeNull(); // no 2-or-3 ply opening in BOOK starting e4 e5
  });
});
