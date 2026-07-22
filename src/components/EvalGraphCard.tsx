import { EvalGraph } from './EvalGraph';
import type { Classification } from '../chess/types';

interface Props {
  evalsCp: number[];
  classifications?: Classification[];
  current: number;
  onSelect: (i: number) => void;
}

export function EvalGraphCard({ evalsCp, classifications, current, onSelect }: Props) {
  return (
    <div className="glass-panel rounded-2xl p-4 border border-indigo-400/20 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
          Evaluation History
        </h3>
        <span className="text-[11px] font-mono text-slate-400">
          White advantage (+10) / Black advantage (-10)
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
