import { describe, it, expect } from 'vitest';
import { kingSquare } from './kingSquare';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('kingSquare', () => {
  it('finds both kings in the start position', () => {
    expect(kingSquare(START, 'white')).toBe('e1');
    expect(kingSquare(START, 'black')).toBe('e8');
  });
  it('finds a displaced king', () => {
    expect(kingSquare('8/8/3k4/8/8/4K3/8/8 w - - 0 1', 'white')).toBe('e3');
    expect(kingSquare('8/8/3k4/8/8/4K3/8/8 w - - 0 1', 'black')).toBe('d6');
  });
  it('returns null when the king is absent', () => {
    expect(kingSquare('8/8/8/8/8/8/8/8 w - - 0 1', 'white')).toBeNull();
  });
});
