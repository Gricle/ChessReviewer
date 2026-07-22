import { describe, expect, it } from 'vitest';
import { SAMPLE_PGNS } from './samplePgns';
import { parsePgn } from '../chess/pgnParser';

describe('SAMPLE_PGNS', () => {
  it('contains the three demo games', () => {
    expect(Object.keys(SAMPLE_PGNS)).toEqual(['immortal', 'opera', 'blunderfest']);
  });

  it.each(Object.entries(SAMPLE_PGNS))('%s parses to a full game', (_key, s) => {
    const parsed = parsePgn(s.pgn);
    expect(parsed.plies.length).toBeGreaterThan(20);
    expect(parsed.white).toBeTruthy();
    expect(parsed.black).toBeTruthy();
  });
});
