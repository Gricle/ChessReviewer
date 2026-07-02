import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp } from './useCountUp';

afterEach(() => {
  vi.restoreAllMocks();
  // remove any matchMedia stub between tests
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe('useCountUp', () => {
  it('stays at 0 while inactive', () => {
    const { result } = renderHook(() => useCountUp(87.5, false));
    expect(result.current).toBe(0);
  });

  it('jumps straight to the target under prefers-reduced-motion', () => {
    (window as { matchMedia?: unknown }).matchMedia = (q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
    });
    const { result } = renderHook(() => useCountUp(87.5, true));
    expect(result.current).toBe(87.5);
  });

  it('animates toward the target via requestAnimationFrame', () => {
    let now = 0;
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const { result } = renderHook(() => useCountUp(100, true, 1000));
    // run first frame at t=500 (halfway, eased > 50%)
    now = 500;
    act(() => { frames.shift()!(now); });
    expect(result.current).toBeGreaterThan(50);
    expect(result.current).toBeLessThan(100);
    // final frame at t=1000
    now = 1000;
    act(() => { frames.shift()!(now); });
    expect(result.current).toBe(100);
  });
});
