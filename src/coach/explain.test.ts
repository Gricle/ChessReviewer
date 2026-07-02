import { describe, it, expect } from 'vitest';
import { explainMove } from './explain';
import type { AnalyzedPly } from '../chess/types';

const KINGS_ONLY = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';

function makePly(overrides: Partial<AnalyzedPly>): AnalyzedPly {
  return {
    index: 0,
    fenBefore: KINGS_ONLY,
    fenAfter: KINGS_ONLY,
    san: 'Kd2',
    uci: 'e1d2',
    color: 'white',
    moveNumber: 1,
    bestMoveUci: 'e1d2',
    evalBeforeCp: 0,
    evalAfterCp: 0,
    classification: 'good',
    accuracy: 80,
    ...overrides,
  };
}

describe('explainMove', () => {
  it('2a: flags walking into a forced mate', () => {
    const ply = makePly({
      san: 'Kd2',
      classification: 'blunder',
      evalBeforeCp: 200,
      evalAfterCp: -32000,
    });
    expect(explainMove(ply, { bestSan: 'Rxe8', nextBestSan: 'Qh5#' })).toBe(
      'Better was Rxe8. This walks into a forced mate.',
    );
  });

  it('2b: flags letting a forced mate slip', () => {
    const ply = makePly({
      san: 'Rd1',
      classification: 'mistake',
      evalBeforeCp: 32000,
      evalAfterCp: 150,
    });
    expect(explainMove(ply, { bestSan: 'Qh5#', nextBestSan: null })).toBe(
      'Better was Qh5#. You had a forced mate and let it slip.',
    );
  });

  it('2c: flags a newly-hung piece (compares fenBefore vs fenAfter)', () => {
    const ply = makePly({
      san: 'Kb1',
      color: 'white',
      classification: 'mistake',
      evalBeforeCp: 20,
      evalAfterCp: -30,
      fenBefore: 'k7/8/8/8/8/8/2R5/K7 w - - 0 1',
      fenAfter: 'k7/8/8/2r5/8/8/2R5/K7 b - - 0 1',
    });
    // even though a threat is also available, the hung-piece rule outranks it
    expect(explainMove(ply, { bestSan: 'Rc5', nextBestSan: 'Rxc2' })).toBe(
      'Better was Rc5. This leaves your rook on c2 hanging.',
    );
  });

  it('2d: falls back to the opponent threat when nothing else matches', () => {
    const ply = makePly({
      san: 'Kd2',
      classification: 'mistake',
      evalBeforeCp: 20,
      evalAfterCp: -30,
      fenBefore: KINGS_ONLY,
      fenAfter: KINGS_ONLY,
    });
    expect(explainMove(ply, { bestSan: 'Kd1', nextBestSan: 'Qh5+' })).toBe(
      'Better was Kd1. The threat is now Qh5+.',
    );
  });

  it('3: brilliant sacrifice that also sets up a fork', () => {
    const ply = makePly({
      san: 'Nf6+',
      uci: 'd5f6',
      color: 'white',
      classification: 'brilliant',
      fenBefore: '4k1q1/8/8/3N4/8/8/8/4K3 w - - 0 1',
    });
    expect(explainMove(ply, { bestSan: 'Nf6+', nextBestSan: null })).toBe(
      'A stunning sacrifice! Nf6+ gives up material and sets up a fork.',
    );
  });

  it('5a: keeping a forced mate on track', () => {
    const ply = makePly({
      san: 'Qh5#',
      uci: 'd1h5',
      bestMoveUci: 'd1h5',
      classification: 'best',
      evalBeforeCp: 32000,
      evalAfterCp: -32000,
    });
    expect(explainMove(ply, { bestSan: 'Qh5#', nextBestSan: null })).toBe(
      'Qh5# keeps the forced mate on track.',
    );
  });

  it('5c: per-classification default phrasing for best/excellent/good', () => {
    const best = makePly({
      san: 'Nf3',
      uci: 'g1f3',
      bestMoveUci: 'g1f3',
      classification: 'best',
      evalBeforeCp: 40,
      evalAfterCp: -40,
    });
    expect(explainMove(best, { bestSan: 'Nf3', nextBestSan: null })).toBe(
      'Nf3 is the strongest move.',
    );

    const excellent = makePly({
      san: 'Nc3',
      uci: 'b1c3',
      bestMoveUci: 'g1f3',
      classification: 'excellent',
      evalBeforeCp: 40,
      evalAfterCp: -35,
    });
    expect(explainMove(excellent, { bestSan: 'Nf3', nextBestSan: null })).toBe(
      'Nc3 is strong — only Nf3 was better.',
    );

    const good = makePly({
      san: 'a3',
      uci: 'a2a3',
      bestMoveUci: 'g1f3',
      classification: 'good',
      evalBeforeCp: 40,
      evalAfterCp: -10,
    });
    expect(explainMove(good, { bestSan: 'Nf3', nextBestSan: null })).toBe(
      'a3 keeps the balance, but Nf3 was more accurate.',
    );
  });
});
