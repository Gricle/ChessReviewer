import { describe, it, expect } from 'vitest';
import { hangingPieces, forkTargets, isMateScore, isMatedScore } from './motifs';

describe('hangingPieces', () => {
  it('detects an undefended piece under attack', () => {
    const fen = '4k3/8/8/3Q4/1n6/8/8/4K3 w - - 0 1'; // Qd5 attacked by Nb4, no defenders
    expect(hangingPieces(fen, 'w')).toEqual([{ square: 'd5', type: 'q' }]);
  });

  it('detects a defended piece attacked by a cheaper piece', () => {
    const fen = '4k3/8/2p5/3R4/2P5/8/8/4K3 w - - 0 1'; // Rd5 defended by Pc4, attacked by Pc6
    expect(hangingPieces(fen, 'w')).toEqual([{ square: 'd5', type: 'r' }]);
  });

  it('does not flag a defended piece attacked only by an equal/greater value piece', () => {
    const fen = 'k2r4/8/8/3R4/8/8/8/3RK3 w - - 0 1'; // Rd5 defended by Rd1, attacked by Rd8
    expect(hangingPieces(fen, 'w')).toEqual([]);
  });

  it('never lists kings, even when attacked and undefended', () => {
    const fen = 'k3r3/8/8/8/8/8/8/4K3 w - - 0 1'; // Ke1 attacked by Re8
    expect(hangingPieces(fen, 'w')).toEqual([]);
  });

  it('returns [] when the side has no non-king pieces', () => {
    const fen = 'k7/8/8/8/8/8/8/K7 w - - 0 1';
    expect(hangingPieces(fen, 'w')).toEqual([]);
    expect(hangingPieces(fen, 'b')).toEqual([]);
  });
});

describe('forkTargets', () => {
  it('finds a knight fork of king and queen (2 targets)', () => {
    const fenBefore = '4k1q1/8/8/3N4/8/8/8/4K3 w - - 0 1';
    expect(forkTargets(fenBefore, 'd5f6')).toEqual(['e8', 'g8']);
  });

  it('returns a single target when the move only attacks one piece', () => {
    const fenBefore = '4k3/8/8/3N4/8/8/8/4K3 w - - 0 1';
    expect(forkTargets(fenBefore, 'd5f6')).toEqual(['e8']);
  });
});

describe('isMateScore / isMatedScore', () => {
  it('classifies mate and mated scores at the boundary and beyond', () => {
    expect(isMateScore(31000)).toBe(true);
    expect(isMateScore(32000)).toBe(true);
    expect(isMateScore(0)).toBe(false);
    expect(isMateScore(-31000)).toBe(false);

    expect(isMatedScore(-31000)).toBe(true);
    expect(isMatedScore(-32000)).toBe(true);
    expect(isMatedScore(0)).toBe(false);
    expect(isMatedScore(31000)).toBe(false);
  });
});
