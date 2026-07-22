import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReviewShortcuts } from './useReviewShortcuts';

function press(key: string, target?: Partial<EventTarget>) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true });
  if (target) Object.defineProperty(ev, 'target', { value: target });
  window.dispatchEvent(ev);
}

describe('useReviewShortcuts', () => {
  const make = () => {
    const h = { onPrev: vi.fn(), onNext: vi.fn(), onStart: vi.fn(), onEnd: vi.fn(), onToggleAutoplay: vi.fn(), onFlip: vi.fn() };
    renderHook(() => useReviewShortcuts(true, h));
    return h;
  };

  it('maps keys to actions', () => {
    const h = make();
    press('ArrowLeft'); expect(h.onPrev).toHaveBeenCalled();
    press('ArrowRight'); expect(h.onNext).toHaveBeenCalled();
    press('Home'); expect(h.onStart).toHaveBeenCalled();
    press('End'); expect(h.onEnd).toHaveBeenCalled();
    press(' '); expect(h.onToggleAutoplay).toHaveBeenCalled();
    press('f'); expect(h.onFlip).toHaveBeenCalled();
  });

  it('ignores keys while typing in inputs', () => {
    const h = make();
    press('ArrowLeft', { tagName: 'TEXTAREA' } as any);
    expect(h.onPrev).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const h = { onPrev: vi.fn(), onNext: vi.fn(), onStart: vi.fn(), onEnd: vi.fn(), onToggleAutoplay: vi.fn(), onFlip: vi.fn() };
    renderHook(() => useReviewShortcuts(false, h));
    press('ArrowLeft');
    expect(h.onPrev).not.toHaveBeenCalled();
  });
});
