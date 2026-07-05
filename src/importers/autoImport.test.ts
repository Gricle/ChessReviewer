import { describe, it, expect } from 'vitest';
import { chooseImportSource, latestGames, unreviewedGames } from './autoImport';

describe('chooseImportSource', () => {
  it('prefers chess.com when both usernames are set', () => {
    expect(chooseImportSource({ chesscom_username: 'alice', lichess_username: 'bob' }))
      .toEqual({ source: 'chesscom', username: 'alice' });
  });

  it('falls back to lichess when only lichess is set', () => {
    expect(chooseImportSource({ chesscom_username: null, lichess_username: 'bob' }))
      .toEqual({ source: 'lichess', username: 'bob' });
  });

  it('trims whitespace and treats blank usernames as unset', () => {
    expect(chooseImportSource({ chesscom_username: '   ', lichess_username: ' bob ' }))
      .toEqual({ source: 'lichess', username: 'bob' });
  });

  it('returns null when neither username is set or profile is missing', () => {
    expect(chooseImportSource({ chesscom_username: null, lichess_username: null })).toBeNull();
    expect(chooseImportSource(null)).toBeNull();
  });
});

describe('latestGames', () => {
  const g = (id: string, playedAt: number) => ({ id, playedAt });

  it('returns the n newest games, newest first', () => {
    const games = [g('a', 100), g('b', 300), g('c', 200), g('d', 50)];
    expect(latestGames(games, 2).map((x) => x.id)).toEqual(['b', 'c']);
  });

  it('is stable for equal timestamps (keeps input order)', () => {
    const games = [g('a', 100), g('b', 100), g('c', 100)];
    expect(latestGames(games, 3).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('clamps to the available count and to non-negative n', () => {
    const games = [g('a', 1), g('b', 2)];
    expect(latestGames(games, 10).map((x) => x.id)).toEqual(['b', 'a']);
    expect(latestGames(games, 0)).toEqual([]);
    expect(latestGames(games, -5)).toEqual([]);
    expect(latestGames([], 5)).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const games = [g('a', 100), g('b', 300)];
    const copy = [...games];
    latestGames(games, 2);
    expect(games).toEqual(copy);
  });
});

describe('unreviewedGames', () => {
  const hash = (s: string) => s; // identity hash for the test

  it('drops games whose pgn hash is already stored', () => {
    const games = [{ pgn: 'x' }, { pgn: 'y' }, { pgn: 'z' }];
    const result = unreviewedGames(games, new Set(['y']), hash);
    expect(result.map((g) => g.pgn)).toEqual(['x', 'z']);
  });

  it('returns all games when nothing is stored yet', () => {
    const games = [{ pgn: 'x' }, { pgn: 'y' }];
    expect(unreviewedGames(games, new Set(), hash)).toHaveLength(2);
  });

  it('returns an empty array when every game is already reviewed', () => {
    const games = [{ pgn: 'x' }, { pgn: 'y' }];
    expect(unreviewedGames(games, new Set(['x', 'y']), hash)).toEqual([]);
  });
});
