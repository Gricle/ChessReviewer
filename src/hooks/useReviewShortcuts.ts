import { useEffect } from 'react';

export interface ShortcutHandlers {
  onPrev: () => void;
  onNext: () => void;
  onStart: () => void;
  onEnd: () => void;
  onToggleAutoplay: () => void;
  onFlip: () => void;
}

export function useReviewShortcuts(enabled: boolean, h: ShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
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
