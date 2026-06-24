import { describe, it, expect } from 'vitest';
import { parseScoreCp, parseInfoLine } from './uci';

describe('parseScoreCp', () => {
  it('reads centipawn scores', () => {
    expect(parseScoreCp('score cp 34')).toEqual({ cp: 34, mate: null });
    expect(parseScoreCp('score cp -150')).toEqual({ cp: -150, mate: null });
  });
  it('encodes mate as +/-32000 and keeps the mate distance', () => {
    expect(parseScoreCp('score mate 3')).toEqual({ cp: 32000, mate: 3 });
    expect(parseScoreCp('score mate -2')).toEqual({ cp: -32000, mate: -2 });
  });
});

describe('parseInfoLine', () => {
  it('extracts multipv index, score, and first pv move', () => {
    const line = 'info depth 18 seldepth 24 multipv 1 score cp 27 nodes 1 pv e2e4 e7e5 g1f3';
    expect(parseInfoLine(line)).toEqual({ multipv: 1, cp: 27, mate: null, firstMove: 'e2e4' });
  });
  it('returns null for lines without a score', () => {
    expect(parseInfoLine('info string NNUE evaluation using nn-xyz')).toBeNull();
  });
});
