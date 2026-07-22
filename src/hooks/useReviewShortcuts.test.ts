import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReviewShortcuts } from './useReviewShortcuts';

function press(
  key: string,
  opts: { target?: HTMLElement; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; cancelable?: boolean } = {},
): KeyboardEvent {
  const target = opts.target ?? document.body;
  const ev = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: opts.cancelable ?? true,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    altKey: opts.altKey ?? false,
  });
  target.dispatchEvent(ev);
  return ev;
}

describe('useReviewShortcuts', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

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

  it('uppercase F also flips', () => {
    const h = make();
    press('F');
    expect(h.onFlip).toHaveBeenCalled();
  });

  it('ignores keys while typing in a real textarea', () => {
    const h = make();
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    press('ArrowLeft', { target: textarea });
    expect(h.onPrev).not.toHaveBeenCalled();
  });

  it('ignores Space dispatched from a focused button (does not steal activation)', () => {
    const h = make();
    const button = document.createElement('button');
    document.body.appendChild(button);
    press(' ', { target: button });
    expect(h.onToggleAutoplay).not.toHaveBeenCalled();
  });

  it('ignores Ctrl/Cmd modified keys so browser/app shortcuts are not hijacked', () => {
    const h = make();
    press('f', { ctrlKey: true });
    press('ArrowLeft', { ctrlKey: true });
    press('f', { metaKey: true });
    expect(h.onFlip).not.toHaveBeenCalled();
    expect(h.onPrev).not.toHaveBeenCalled();
  });

  it('calls preventDefault for a handled plain key', () => {
    make();
    const ev = press('ArrowLeft', { cancelable: true });
    expect(ev.defaultPrevented).toBe(true);
  });

  it('does nothing when disabled', () => {
    const h = { onPrev: vi.fn(), onNext: vi.fn(), onStart: vi.fn(), onEnd: vi.fn(), onToggleAutoplay: vi.fn(), onFlip: vi.fn() };
    renderHook(() => useReviewShortcuts(false, h));
    press('ArrowLeft');
    expect(h.onPrev).not.toHaveBeenCalled();
  });
});
