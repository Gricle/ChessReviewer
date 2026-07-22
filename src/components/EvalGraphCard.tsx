import { useTranslation } from 'react-i18next';
import { EvalGraph } from './EvalGraph';
import type { Classification } from '../chess/types';

interface Props {
  evalsCp: number[];
  classifications?: Classification[];
  current: number;
  onSelect: (i: number) => void;
}

export function EvalGraphCard({ evalsCp, classifications, current, onSelect }: Props) {
  const { t } = useTranslation('review');
  return (
    <div className="glass-panel rounded-2xl p-4 border border-indigo-400/20 flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
          {t('evalGraph.title')}
        </h3>
        <span className="text-[10px] font-mono text-slate-400">
          {t('evalGraph.subtitle')}
        </span>
      </div>
      <EvalGraph
        evalsCp={evalsCp}
        classifications={classifications}
        current={current}
        onSelect={onSelect}
      />
    </div>
  );
}
