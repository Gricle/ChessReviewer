import { describe, it, expect } from 'vitest';
import { mapReview } from './mapReview';
import { parsePgn } from '../chess/pgnParser';
import { assembleReview, type Review } from '../analysis/assemble';
import { OPENINGS } from '../data/openings.sample';
import { hashString } from './syncQueue';
import type { AnalyzedPly, ParsedGame, PositionAnalysis } from '../chess/types';

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

  it('stamps a djb2 pgn_hash matching the stored pgn', () => {
    const { game } = fixture();
    expect(game.pgn_hash).toBe(hashString(game.pgn));
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

  it('gives every move_fact a motifs array', () => {
    const { move_facts } = fixture();
    for (const f of move_facts) {
      expect(Array.isArray(f.motifs)).toBe(true);
    }
  });

  it('tags hung_piece on a bad move that leaves a piece newly hanging', () => {
    // Same fixture FENs as explain.test.ts rule 2c: Kb1 leaves the white
    // rook on c2 hanging to a black rook that wasn't there before.
    const badPly: AnalyzedPly = {
      index: 0,
      fenBefore: 'k7/8/8/8/8/8/2R5/K7 w - - 0 1',
      fenAfter: 'k7/8/8/2r5/8/8/2R5/K7 b - - 0 1',
      san: 'Kb1',
      uci: 'a1b1',
      color: 'white',
      moveNumber: 1,
      bestMoveUci: 'c2c5',
      evalBeforeCp: 20,
      evalAfterCp: -30,
      classification: 'mistake',
      accuracy: 40,
    };
    const review: Review = {
      plies: [badPly],
      summary: {
        opening: null,
        whiteAccuracy: 40,
        blackAccuracy: 100,
        counts: {
          book: { white: 0, black: 0 },
          brilliant: { white: 0, black: 0 },
          great: { white: 0, black: 0 },
          best: { white: 0, black: 0 },
          excellent: { white: 0, black: 0 },
          good: { white: 0, black: 0 },
          inaccuracy: { white: 0, black: 0 },
          mistake: { white: 1, black: 0 },
          blunder: { white: 0, black: 0 },
        },
        estRating: { white: 1200, black: 1200 },
      },
    };
    const game = parsePgn(PGN);
    const { move_facts } = mapReview(game, review, 'paste', 14);
    expect(move_facts[0].motifs).toContain('hung_piece');
  });
});
