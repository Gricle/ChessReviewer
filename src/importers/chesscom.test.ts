import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchRecentGames, summarizeGames, type ChessComGame } from './chesscom';

const games: ChessComGame[] = [
  {
    url: 'https://www.chess.com/game/live/123',
    pgn: '[White "a"]\n[Black "b"]\n\n1. e4 *',
    white: { username: 'a' }, black: { username: 'b' },
    end_time: 1700000000,
  } as ChessComGame,
];

describe('summarizeGames', () => {
  it('extracts id, players, and date for the picker', () => {
    const [s] = summarizeGames(games);
    expect(s.id).toBe('123');
    expect(s.white).toBe('a');
    expect(s.black).toBe('b');
    expect(s.pgn).toContain('1. e4');
  });
});

describe('fetchRecentGames', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(byUrl: Record<string, unknown>) {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: url in byUrl,
      status: url in byUrl ? 200 : 404,
      json: async () => byUrl[url],
    })));
  }

  const ARCHIVES = 'https://api.chess.com/pub/player/u/games/archives';

  it('skips a trailing empty archive month and returns the prior month', async () => {
    stubFetch({
      [ARCHIVES]: { archives: ['https://x/2026/06', 'https://x/2026/07'] },
      'https://x/2026/07': { games: [] },
      'https://x/2026/06': { games },
    });
    const out = await fetchRecentGames('u');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('123');
  });

  it('returns [] when every recent archive month is empty', async () => {
    stubFetch({
      [ARCHIVES]: { archives: ['https://x/2026/06', 'https://x/2026/07'] },
      'https://x/2026/07': { games: [] },
      'https://x/2026/06': { games: [] },
    });
    expect(await fetchRecentGames('u')).toEqual([]);
  });
});
