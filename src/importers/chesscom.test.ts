import { describe, it, expect } from 'vitest';
import { summarizeGames, type ChessComGame } from './chesscom';

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
