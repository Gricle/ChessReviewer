import type { Classification } from '../chess/types';

export interface ClassMeta {
  sym: string;    // short symbol shown in the badge
  label: string;  // human label
  cls: string;    // CSS modifier class, e.g. "c-blunder"
}

// Single source of truth for how each classification looks (badge symbol,
// label, and color class). Shared by MoveList and SummaryPanel.
export const CLASS_META: Record<Classification, ClassMeta> = {
  brilliant: { sym: '!!', label: 'Brilliant', cls: 'c-brilliant' },
  great: { sym: '!', label: 'Great', cls: 'c-great' },
  best: { sym: '★', label: 'Best', cls: 'c-best' },
  excellent: { sym: '✓', label: 'Excellent', cls: 'c-excellent' },
  good: { sym: '✓', label: 'Good', cls: 'c-good' },
  book: { sym: '📖', label: 'Book', cls: 'c-book' },
  inaccuracy: { sym: '?!', label: 'Inaccuracy', cls: 'c-inaccuracy' },
  mistake: { sym: '?', label: 'Mistake', cls: 'c-mistake' },
  blunder: { sym: '??', label: 'Blunder', cls: 'c-blunder' },
};

// Display order for the summary breakdown (best → worst).
export const CLASS_ORDER: Classification[] = [
  'brilliant', 'great', 'best', 'excellent', 'good', 'book',
  'inaccuracy', 'mistake', 'blunder',
];
