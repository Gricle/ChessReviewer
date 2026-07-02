import { describe, it, expect } from 'vitest';
import { estimatePerformanceRating } from './performanceRating';

const clean = { inaccuracies: 0, mistakes: 0, blunders: 0 };

describe('estimatePerformanceRating', () => {
  it('rates a perfect game at the ceiling', () => {
    expect(estimatePerformanceRating({ accuracy: 100, moveCount: 40, ...clean })).toBe(3200);
  });

  it('hits the calibration anchors exactly when error-free', () => {
    expect(estimatePerformanceRating({ accuracy: 95, moveCount: 40, ...clean })).toBe(2500);
    expect(estimatePerformanceRating({ accuracy: 80, moveCount: 40, ...clean })).toBe(1500);
    expect(estimatePerformanceRating({ accuracy: 70, moveCount: 40, ...clean })).toBe(1000);
  });

  it('interpolates between anchors', () => {
    // midway between 90 → 2100 and 95 → 2500
    expect(estimatePerformanceRating({ accuracy: 92.5, moveCount: 40, ...clean })).toBe(2300);
  });

  it('penalizes blunders at equal accuracy', () => {
    const noErr = estimatePerformanceRating({ accuracy: 85, moveCount: 40, ...clean });
    const blundery = estimatePerformanceRating({
      accuracy: 85, moveCount: 40, inaccuracies: 0, mistakes: 0, blunders: 3,
    });
    expect(blundery).toBeLessThan(noErr);
  });

  it('is monotonic in accuracy', () => {
    let prev = -Infinity;
    for (const acc of [40, 55, 65, 72, 78, 84, 88, 93, 97, 100]) {
      const r = estimatePerformanceRating({ accuracy: acc, moveCount: 40, ...clean });
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });

  it('never returns below the floor or above the ceiling', () => {
    expect(estimatePerformanceRating({
      accuracy: 5, moveCount: 10, inaccuracies: 3, mistakes: 3, blunders: 4,
    })).toBeGreaterThanOrEqual(100);
    expect(estimatePerformanceRating({ accuracy: 100, moveCount: 1, ...clean })).toBeLessThanOrEqual(3200);
  });

  it('handles zero moves without NaN', () => {
    const r = estimatePerformanceRating({ accuracy: 100, moveCount: 0, ...clean });
    expect(Number.isFinite(r)).toBe(true);
  });

  it('rounds to the nearest 50', () => {
    const r = estimatePerformanceRating({ accuracy: 87.3, moveCount: 38, inaccuracies: 2, mistakes: 1, blunders: 0 });
    expect(r % 50).toBe(0);
  });
});
