import { describe, it, expect } from 'vitest';
import { mapReview } from './mapReview';
import { parsePgn } from '../chess/pgnParser';
import { assembleReview } from '../analysis/assemble';
import { OPENINGS } from '../data/openings.sample';
import type { ParsedGame, PositionAnalysis } from '../chess/types';

const PGN = `[White "Hikaru"]
[Black "Magnus"]
[WhiteElo "2802"]
[BlackElo "2839"]
[Result "1/2-1/2"]
[Date "2024.03.15"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 1/2-1/2`;

function flatAnalyses(g: ParsedGame): Map<string, PositionAnalysis> {
  const m = new Map<string, PositionAnalysis>();
  const add = (fen: string, bestUci: string) =>
    m.set(fen, { fen, bestMoveUci: bestUci, bestEvalCp: 0, secondBestEvalCp: 0, mate: null });
  g.plies.forEach((p) => add(p.fenBefore, p.uci));
  add(g.plies[g.plies.length - 1].fenAfter, 'a2a3');
  return m;
}

function fixture() {
  const game = parsePgn(PGN);
  const review = assembleReview(game, flatAnalyses(game), OPENINGS);
  return mapReview(game, review, 'paste', 14);
}

describe('mapReview', () => {
  it('maps game metadata including ratings and opening', () => {
    const { game } = fixture();
    expect(game.pgn).toContain('1. e4 e5');
    expect(game.white_name).toBe('Hikaru');
    expect(game.black_name).toBe('Magnus');
    expect(game.white_rating).toBe(2802);
    expect(game.black_rating).toBe(2839);
    expect(game.result).toBe('1/2-1/2');
    expect(game.played_at).toBe('2024-03-15');
    expect(game.source).toBe('paste');
    expect(game.opening_name).toBe('Ruy Lopez');
  });

  it('maps review numbers and embeds full analysis', () => {
    const { review } = fixture();
    expect(review.white_accuracy).toBeGreaterThan(99);
    expect(review.black_accuracy).toBeGreaterThan(99);
    expect(review.white_est_rating).toBeGreaterThanOrEqual(2500);
    expect(review.depth).toBe(14);
    expect(review.counts.book).toEqual({ white: 3, black: 2 });
    expect(review.analysis.plies).toHaveLength(5);
    expect(review.analysis.summary.opening?.name).toBe('Ruy Lopez');
  });

  it('produces one move_fact per ply with phase and win_drop', () => {
    const { move_facts } = fixture();
    expect(move_facts).toHaveLength(5);
    expect(move_facts[0]).toMatchObject({ ply: 0, side: 'white', classification: 'book', phase: 'opening' });
    for (const f of move_facts) {
      expect(f.win_drop).toBeGreaterThanOrEqual(0);
      expect(['opening', 'middlegame', 'endgame']).toContain(f.phase);
    }
  });

  it('nulls ratings, result and date when headers are absent', () => {
    const game = parsePgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 *');
    const review = assembleReview(game, flatAnalyses(game), OPENINGS);
    const mapped = mapReview(game, review, 'lichess', 14);
    expect(mapped.game.white_rating).toBeNull();
    expect(mapped.game.black_rating).toBeNull();
    expect(mapped.game.played_at).toBeNull();
    expect(mapped.game.source).toBe('lichess');
    // chess.js emits Result "*" for unfinished games — must not be stored as a result
    expect(mapped.game.result).toBeNull();
  });

  it('rejects well-shaped but invalid dates and falls back from bad UTCDate to good Date', () => {
    const base = '1. e4 e5 2. Nf3 Nc6 3. Bb5 *';
    const mk = (headers: string) => {
      const game = parsePgn(`${headers}\n\n${base}`);
      const review = assembleReview(game, flatAnalyses(game), OPENINGS);
      return mapReview(game, review, 'paste', 14);
    };
    expect(mk('[Date "2024.13.40"]').game.played_at).toBeNull();
    expect(mk('[UTCDate "????.??.??"]\n[Date "2024.03.15"]').game.played_at).toBe('2024-03-15');
    expect(mk('[UTCDate "2024.03.14"]\n[Date "2024.03.15"]').game.played_at).toBe('2024-03-14');
  });
});
