import { useEffect, useState } from 'react';
import { prefersReducedMotion } from './reducedMotion';

/** Animates 0 → target with an ease-out cubic once `active` becomes true. */
export function useCountUp(target: number, active: boolean, durationMs = 1200): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (nowMs: number) => {
      const t = durationMs <= 0 ? 1 : Math.min(1, (nowMs - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(t >= 1 ? target : target * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active, durationMs]);

  return value;
}
