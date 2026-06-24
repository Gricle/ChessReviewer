import { describe, it, expect } from 'vitest';
import { materialBalance } from './material';

describe('materialBalance', () => {
  it('is 0 at the start position', () => {
    expect(materialBalance('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(0);
  });
  it('reports from the side-to-move perspective (white up a queen, white to move)', () => {
    // White has an extra queen on d1; black has none.
    expect(materialBalance('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(9);
  });
  it('negates for black to move', () => {
    // Same material edge for white, but black to move -> negative.
    expect(materialBalance('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1')).toBe(-9);
  });
});
