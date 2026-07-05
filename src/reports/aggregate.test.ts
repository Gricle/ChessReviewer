import { describe, it, expect } from 'vitest';
import { userSide, worstOpenings, missedMotifs, phaseCollapse, accuracyTrend } from './aggregate';
import { gameResult, trendSeries, type TrendFilter } from './aggregate';
import { rollingAverage } from './aggregate';
import { blundersPerGame } from './aggregate';
import type { ReportGameRow, ReportFactRow } from '../supabase/reports';
import type { Profile } from '../supabase/library';

function game(overrides: Partial<ReportGameRow> = {}): ReportGameRow {
  return {
    id: 'g1',
    white_name: 'Alice',
    black_name: 'Bob',
    opening_name: 'Italian Game',
    result: '1-0',
    played_at: '2026-01-01',
    created_at: '2026-01-01T00:00:00.000Z',
    reviews: { white_accuracy: 90, black_accuracy: 80, white_est_rating: 1800, black_est_rating: 1600 },
    ...overrides,
  };
}

function profile(overrides: Partial<Profile> = {}): Profile {
  return { display_name: null, chesscom_username: null, lichess_username: null, ...overrides };
}

function fact(overrides: Partial<ReportFactRow> = {}): ReportFactRow {
  return {
    game_id: 'g1', side: 'white', classification: 'best', phase: 'middlegame', motifs: [], win_drop: 0,
    ...overrides,
  };
}

describe('userSide', () => {
  it('matches chesscom_username against white_name', () => {
    const g = game({ white_name: 'hikaru' });
    expect(userSide(g, profile({ chesscom_username: 'hikaru' }))).toBe('white');
  });

  it('matches lichess_username against black_name', () => {
    const g = game({ black_name: 'drnykterstein' });
    expect(userSide(g, profile({ lichess_username: 'drnykterstein' }))).toBe('black');
  });

  it('matches display_name against black_name, case-insensitively', () => {
    const g = game({ black_name: 'MagnusCarlsen' });
    expect(userSide(g, profile({ display_name: 'magnuscarlsen' }))).toBe('black');
  });

  it('returns null when profile is null or nothing matches', () => {
    const g = game();
    expect(userSide(g, null)).toBeNull();
    expect(userSide(g, profile({ display_name: 'nobody' }))).toBeNull();
  });

  it('breaks a white/black name tie in favor of white', () => {
    const g = game({ white_name: 'same', black_name: 'same' });
    expect(userSide(g, profile({ display_name: 'same' }))).toBe('white');
  });
});

describe('worstOpenings', () => {
  it('sorts ascending by avgAccuracy (worst first) and respects minGames', () => {
    const games: ReportGameRow[] = [
      game({ id: 'a1', opening_name: 'Sicilian', reviews: { white_accuracy: 60, black_accuracy: 60, white_est_rating: 1500, black_est_rating: 1500 } }),
      game({ id: 'a2', opening_name: 'Sicilian', reviews: { white_accuracy: 70, black_accuracy: 70, white_est_rating: 1500, black_est_rating: 1500 } }),
      game({ id: 'b1', opening_name: 'French', reviews: { white_accuracy: 95, black_accuracy: 95, white_est_rating: 1500, black_est_rating: 1500 } }),
      game({ id: 'b2', opening_name: 'French', reviews: { white_accuracy: 90, black_accuracy: 90, white_est_rating: 1500, black_est_rating: 1500 } }),
      // Only one Caro-Kann game -> excluded by default minGames = 2.
      game({ id: 'c1', opening_name: 'Caro-Kann', reviews: { white_accuracy: 10, black_accuracy: 10, white_est_rating: 1500, black_est_rating: 1500 } }),
    ];
    const result = worstOpenings(games, null);
    expect(result).toEqual([
      { opening: 'Sicilian', games: 2, avgAccuracy: 65 },
      { opening: 'French', games: 2, avgAccuracy: 92.5 },
    ]);
  });

  it("uses the matched side's accuracy when the user's side is known", () => {
    const games: ReportGameRow[] = [
      game({ id: 'a1', white_name: 'hikaru', opening_name: 'Grunfeld', reviews: { white_accuracy: 40, black_accuracy: 99, white_est_rating: 1500, black_est_rating: 1500 } }),
      game({ id: 'a2', white_name: 'hikaru', opening_name: 'Grunfeld', reviews: { white_accuracy: 60, black_accuracy: 1, white_est_rating: 1500, black_est_rating: 1500 } }),
    ];
    const result = worstOpenings(games, profile({ chesscom_username: 'hikaru' }));
    expect(result).toEqual([{ opening: 'Grunfeld', games: 2, avgAccuracy: 50 }]);
  });

  it('falls back to the mean of both sides when the side is unknown, and skips games missing a review or opening name', () => {
    const games: ReportGameRow[] = [
      game({ id: 'a1', opening_name: 'Grunfeld', reviews: { white_accuracy: 40, black_accuracy: 60, white_est_rating: 1500, black_est_rating: 1500 } }),
      game({ id: 'a2', opening_name: 'Grunfeld', reviews: { white_accuracy: 60, black_accuracy: 40, white_est_rating: 1500, black_est_rating: 1500 } }),
      game({ id: 'b1', opening_name: null, reviews: { white_accuracy: 10, black_accuracy: 10, white_est_rating: 1500, black_est_rating: 1500 } }),
      game({ id: 'b2', opening_name: 'Unreviewed Opening', reviews: null }),
    ];
    const result = worstOpenings(games, null);
    expect(result).toEqual([{ opening: 'Grunfeld', games: 2, avgAccuracy: 50 }]);
  });
});

describe('missedMotifs', () => {
  it('counts only the 4 weakness tags (ignoring the ungated fork tag) and filters to the user side when known', () => {
    const games: ReportGameRow[] = [game({ id: 'g1', white_name: 'hikaru' })];
    const p = profile({ chesscom_username: 'hikaru' });
    const facts: ReportFactRow[] = [
      fact({ side: 'white', motifs: ['hung_piece', 'fork'] }),
      fact({ side: 'white', motifs: ['missed_mate'] }),
      fact({ side: 'white', motifs: ['missed_fork'] }),
      fact({ side: 'white', motifs: ['walked_into_mate'] }),
      // Opponent's (black) fact for the same game — excluded since the user is white here.
      fact({ side: 'black', motifs: ['hung_piece'] }),
    ];
    const result = missedMotifs(facts, games, p);
    expect(result).toEqual([
      { motif: 'hung_piece', count: 1 },
      { motif: 'missed_mate', count: 1 },
      { motif: 'missed_fork', count: 1 },
      { motif: 'walked_into_mate', count: 1 },
    ]);
  });

  it('sorts by count descending and includes both sides when the user side is unknown', () => {
    const games: ReportGameRow[] = [game({ id: 'g1' })];
    const facts: ReportFactRow[] = [
      fact({ side: 'white', motifs: ['hung_piece'] }),
      fact({ side: 'black', motifs: ['hung_piece'] }),
      fact({ side: 'black', motifs: ['missed_mate'] }),
    ];
    const result = missedMotifs(facts, games, null);
    expect(result).toEqual([
      { motif: 'hung_piece', count: 2 },
      { motif: 'missed_mate', count: 1 },
    ]);
  });
});

describe('phaseCollapse', () => {
  it('computes avgWinDrop and badMovePct per phase, filtered to the user side, omitting empty phases', () => {
    const games: ReportGameRow[] = [game({ id: 'g1', white_name: 'hikaru' })];
    const p = profile({ chesscom_username: 'hikaru' });
    const facts: ReportFactRow[] = [
      fact({ side: 'white', phase: 'opening', classification: 'best', win_drop: 0 }),
      fact({ side: 'white', phase: 'opening', classification: 'blunder', win_drop: 30 }),
      fact({ side: 'white', phase: 'middlegame', classification: 'mistake', win_drop: 20 }),
      // Opponent's endgame fact — excluded since the user is white.
      fact({ side: 'black', phase: 'endgame', classification: 'blunder', win_drop: 40 }),
    ];
    const result = phaseCollapse(facts, games, p);
    expect(result).toEqual([
      { phase: 'opening', moves: 2, avgWinDrop: 15, badMovePct: 50 },
      { phase: 'middlegame', moves: 1, avgWinDrop: 20, badMovePct: 100 },
    ]);
  });
});

describe('accuracyTrend', () => {
  it('returns one point per reviewed game, sorted ascending, preferring played_at over created_at', () => {
    const games: ReportGameRow[] = [
      game({ id: 'g2', played_at: '2026-02-01', created_at: '2026-02-05T00:00:00.000Z', reviews: { white_accuracy: 80, black_accuracy: 60, white_est_rating: 1700, black_est_rating: 1500 } }),
      // No played_at — falls back to created_at, which sorts before g2's played_at.
      game({ id: 'g1', played_at: null, created_at: '2026-01-01T00:00:00.000Z', reviews: { white_accuracy: 70, black_accuracy: 50, white_est_rating: 1600, black_est_rating: 1400 } }),
      // No review at all — excluded entirely.
      game({ id: 'g3', played_at: '2026-03-01', reviews: null }),
    ];
    const result = accuracyTrend(games, null);
    expect(result).toEqual([
      { date: '2026-01-01T00:00:00.000Z', accuracy: 60, estRating: 1500 },
      { date: '2026-02-01', accuracy: 70, estRating: 1600 },
    ]);
  });
});

const ALL: TrendFilter = { color: 'all', range: 'all' };

describe('gameResult', () => {
  it('maps result + side to win/loss/draw', () => {
    expect(gameResult(game({ result: '1-0' }), 'white')).toBe('win');
    expect(gameResult(game({ result: '1-0' }), 'black')).toBe('loss');
    expect(gameResult(game({ result: '0-1' }), 'black')).toBe('win');
    expect(gameResult(game({ result: '1/2-1/2' }), 'white')).toBe('draw');
  });
  it('returns null when side or result is unknown', () => {
    expect(gameResult(game({ result: '1-0' }), null)).toBeNull();
    expect(gameResult(game({ result: null }), 'white')).toBeNull();
    expect(gameResult(game({ result: '*' }), 'white')).toBeNull();
  });
});

describe('trendSeries', () => {
  const profile = { display_name: 'Alice', chesscom_username: null, lichess_username: null };
  it('emits one point per reviewed game, user side, sorted by date', () => {
    const games = [
      game({ id: 'b', played_at: '2026-02-01', result: '1-0',
        reviews: { white_accuracy: 90, black_accuracy: 50, white_est_rating: 1500, black_est_rating: 1200 } }),
      game({ id: 'a', played_at: '2026-01-01', result: '0-1',
        reviews: { white_accuracy: 80, black_accuracy: 60, white_est_rating: 1400, black_est_rating: 1300 } }),
    ];
    const s = trendSeries(games, profile, ALL);
    expect(s.map((p) => p.date)).toEqual(['2026-01-01', '2026-02-01']);
    expect(s[0]).toEqual({ date: '2026-01-01', accuracy: 80, estRating: 1400, result: 'loss' });
    expect(s[1].result).toBe('win');
  });
  it('skips games without a review', () => {
    const games = [game({ reviews: null })];
    expect(trendSeries(games, profile, ALL)).toEqual([]);
  });
  it('filters by color, excluding undeterminable sides', () => {
    const games = [
      game({ id: 'w', white_name: 'Alice', black_name: 'Bob', played_at: '2026-01-01' }),
      game({ id: 'x', white_name: 'Carol', black_name: 'Dave', played_at: '2026-01-02' }),
    ];
    expect(trendSeries(games, profile, { color: 'white', range: 'all' }).length).toBe(1);
  });
  it('filters by range relative to the newest game', () => {
    const games = [
      game({ id: 'old', played_at: '2026-01-01' }),
      game({ id: 'new', played_at: '2026-03-01' }),
    ];
    // 30d window ends at 2026-03-01, so the January game is excluded.
    const s = trendSeries(games, profile, { color: 'all', range: '30d' });
    expect(s.map((p) => p.date)).toEqual(['2026-03-01']);
  });
});

describe('rollingAverage', () => {
  it('averages a trailing window, shrinking at the start', () => {
    expect(rollingAverage([10, 20, 30], 2)).toEqual([10, 15, 25]);
  });
  it('handles an empty array', () => {
    expect(rollingAverage([], 5)).toEqual([]);
  });
});

describe('blundersPerGame', () => {
  const profile = { display_name: 'Alice', chesscom_username: null, lichess_username: null };
  it('counts blunders per game, including zero-blunder games, sorted by date', () => {
    const games = [
      game({ id: 'g1', white_name: 'Alice', black_name: 'Bob', played_at: '2026-01-01' }),
      game({ id: 'g2', white_name: 'Alice', black_name: 'Bob', played_at: '2026-01-02' }),
    ];
    const facts = [
      fact({ game_id: 'g1', side: 'white', classification: 'blunder' }),
      fact({ game_id: 'g1', side: 'white', classification: 'mistake' }),
      fact({ game_id: 'g1', side: 'black', classification: 'blunder' }), // opponent — excluded
    ];
    const out = blundersPerGame(facts, games, profile, ALL);
    expect(out).toEqual([
      { date: '2026-01-01', blunders: 1 },
      { date: '2026-01-02', blunders: 0 },
    ]);
  });
});
