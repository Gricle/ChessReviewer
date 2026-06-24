import type { Classification } from '../chess/types';

export interface ClassMeta {
  sym: string;    // short symbol shown in the badge
  label: string;  // human label
  cls: string;    // CSS modifier class, e.g. "c-blunder"
  hex: string;    // literal color (for SVG board overlays)
}

// Single source of truth for how each classification looks (badge symbol,
// label, color class, and literal hex). Shared by MoveList, SummaryPanel,
// and the on-board badge overlay.
export const CLASS_META: Record<Classification, ClassMeta> = {
  brilliant: { sym: '!!', label: 'Brilliant', cls: 'c-brilliant', hex: '#26c2a3' },
  great: { sym: '!', label: 'Great', cls: 'c-great', hex: '#749bbf' },
  best: { sym: '★', label: 'Best', cls: 'c-best', hex: '#81b64c' },
  excellent: { sym: '✓', label: 'Excellent', cls: 'c-excellent', hex: '#96bc4b' },
  good: { sym: '✓', label: 'Good', cls: 'c-good', hex: '#95af6b' },
  book: { sym: '📖', label: 'Book', cls: 'c-book', hex: '#a88865' },
  inaccuracy: { sym: '?!', label: 'Inaccuracy', cls: 'c-inaccuracy', hex: '#f4bf3e' },
  mistake: { sym: '?', label: 'Mistake', cls: 'c-mistake', hex: '#e58f2a' },
  blunder: { sym: '??', label: 'Blunder', cls: 'c-blunder', hex: '#fa412d' },
};

// Display order for the summary breakdown (best → worst).
export const CLASS_ORDER: Classification[] = [
  'brilliant', 'great', 'best', 'excellent', 'good', 'book',
  'inaccuracy', 'mistake', 'blunder',
];
