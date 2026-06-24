import { describe, it, expect } from 'vitest';
import { moveAccuracy, gameAccuracy } from './accuracy';

describe('moveAccuracy', () => {
  it('is ~100 when the win% does not drop', () => {
    expect(moveAccuracy(60, 60)).toBeGreaterThan(99);
  });
  it('decreases as the win% drop grows', () => {
    const small = moveAccuracy(60, 55);
    const big = moveAccuracy(60, 30);
    expect(small).toBeGreaterThan(big);
    expect(big).toBeGreaterThanOrEqual(0);
  });
  it('clamps to 0..100', () => {
    expect(moveAccuracy(100, 0)).toBeGreaterThanOrEqual(0);
    expect(moveAccuracy(50, 80)).toBeLessThanOrEqual(100);
  });
});

describe('gameAccuracy', () => {
  it('averages the per-move accuracies', () => {
    expect(gameAccuracy([100, 100, 100])).toBeCloseTo(100, 5);
    expect(gameAccuracy([100, 0])).toBeCloseTo(50, 5);
  });
  it('returns 100 for an empty list (no moves to fault)', () => {
    expect(gameAccuracy([])).toBe(100);
  });
});
