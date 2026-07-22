import { useTranslation } from 'react-i18next';
import type { Classification } from '../chess/types';
import { CLASS_META } from './classMeta';

interface Props {
  cls: Classification;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'text-[10px] px-1.5 py-0.5 rounded font-bold',
  md: 'text-xs px-2.5 py-1 rounded-md font-extrabold',
};

// Single shared chip for classification badges (MoveList, SummaryPanel,
// CoachCard) — keeps the visual (CLASS_META hex + dark text) and the
// accessible name (the label is always available to screen readers, even
// when visually hidden) consistent everywhere it's used.
export function ClassChip({ cls, size = 'md', showLabel = true }: Props) {
  const { t } = useTranslation('review');
  const meta = CLASS_META[cls];
  const label = t(`cls.${cls}`);
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono ${SIZE_CLASSES[size]}`}
      style={{ backgroundColor: meta.hex, color: '#05040c' }}
    >
      <span>{meta.sym}</span>
      {showLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  );
}
