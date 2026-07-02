import { describe, it, expect } from 'vitest';
import { gamePhase } from './gamePhase';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// All 14 minor/major pieces still on board, deep into the game:
const MIDDLE = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/3P4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 10';
// King + pawns each plus one rook each (2 minor/major total):
const ROOK_END = '8/5pk1/8/8/8/8/5PK1/R6r w - - 0 40';

describe('gamePhase', () => {
  it('start position at ply 0 is opening', () => {
    expect(gamePhase(START, 0)).toBe('opening');
  });

  it('full material before ply 20 is opening', () => {
    expect(gamePhase(MIDDLE, 18)).toBe('opening');
  });

  it('full material from ply 20 on is middlegame', () => {
    expect(gamePhase(MIDDLE, 20)).toBe('middlegame');
  });

  it('six or fewer minor/major pieces is endgame regardless of ply', () => {
    expect(gamePhase(ROOK_END, 10)).toBe('endgame');
    expect(gamePhase(ROOK_END, 80)).toBe('endgame');
  });

  it('pawns and kings never count toward the endgame threshold', () => {
    // 16 pawns + kings only → 0 minor/major pieces → endgame
    expect(gamePhase('4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 30', 30)).toBe('endgame');
  });
});
