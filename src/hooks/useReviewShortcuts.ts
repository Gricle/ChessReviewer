import { useEffect } from 'react';

export interface ShortcutHandlers {
  onPrev: () => void;
  onNext: () => void;
  onStart: () => void;
  onEnd: () => void;
  onToggleAutoplay: () => void;
  onFlip: () => void;
}

const IGNORE_SELECTOR = 'input, textarea, select, button, [contenteditable="true"]';

export function useReviewShortcuts(enabled: boolean, h: ShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(IGNORE_SELECTOR)) return;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); h.onPrev(); break;
        case 'ArrowRight': e.preventDefault(); h.onNext(); break;
        case 'Home': e.preventDefault(); h.onStart(); break;
        case 'End': e.preventDefault(); h.onEnd(); break;
        case ' ': e.preventDefault(); h.onToggleAutoplay(); break;
        case 'f': case 'F': e.preventDefault(); h.onFlip(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, h.onPrev, h.onNext, h.onStart, h.onEnd, h.onToggleAutoplay, h.onFlip]);
}
