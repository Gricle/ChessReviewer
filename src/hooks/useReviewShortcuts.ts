import { useEffect } from 'react';

export interface ShortcutHandlers {
  onPrev: () => void;
  onNext: () => void;
  onStart: () => void;
  onEnd: () => void;
  onToggleAutoplay: () => void;
  onFlip: () => void;
}

export const IGNORE_SELECTOR = 'input, textarea, select, button, [contenteditable="true"]';

export function useReviewShortcuts(enabled: boolean, h: ShortcutHandlers) {
  const { onPrev, onNext, onStart, onEnd, onToggleAutoplay, onFlip } = h;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(IGNORE_SELECTOR)) return;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); onPrev(); break;
        case 'ArrowRight': e.preventDefault(); onNext(); break;
        case 'Home': e.preventDefault(); onStart(); break;
        case 'End': e.preventDefault(); onEnd(); break;
        case ' ': e.preventDefault(); onToggleAutoplay(); break;
        case 'f': case 'F': e.preventDefault(); onFlip(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, onPrev, onNext, onStart, onEnd, onToggleAutoplay, onFlip]);
}
