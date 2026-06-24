import { describe, it, expect } from 'vitest';
import { cpToWinPercent } from './winPercent';

describe('cpToWinPercent', () => {
  it('is 50 at a dead-equal position', () => {
    expect(cpToWinPercent(0)).toBeCloseTo(50, 5);
  });
  it('rises above 50 when ahead and below 50 when behind', () => {
    expect(cpToWinPercent(300)).toBeGreaterThan(70);
    expect(cpToWinPercent(-300)).toBeLessThan(30);
  });
  it('saturates near 100 / 0 for mate-sized scores', () => {
    expect(cpToWinPercent(32000)).toBeGreaterThan(99.9);
    expect(cpToWinPercent(-32000)).toBeLessThan(0.1);
  });
});
