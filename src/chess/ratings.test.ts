import { describe, it, expect } from 'vitest';
import { playerRatings } from './ratings';

describe('playerRatings', () => {
  it('parses numeric WhiteElo/BlackElo headers', () => {
    expect(playerRatings({ WhiteElo: '1543', BlackElo: '1601' }))
      .toEqual({ white: 1543, black: 1601 });
  });

  it('returns null for missing headers', () => {
    expect(playerRatings({})).toEqual({ white: null, black: null });
  });

  it('returns null for the PGN "?" placeholder and other junk', () => {
    expect(playerRatings({ WhiteElo: '?', BlackElo: 'unrated' }))
      .toEqual({ white: null, black: null });
  });

  it('rejects non-positive values', () => {
    expect(playerRatings({ WhiteElo: '0', BlackElo: '-5' }))
      .toEqual({ white: null, black: null });
  });
});
