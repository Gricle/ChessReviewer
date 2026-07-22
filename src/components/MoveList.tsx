import { useEffect, useRef, type RefObject } from 'react';
import type { AnalyzedPly } from '../chess/types';
import { CLASS_META } from './classMeta';
import { ClassChip } from './ClassChip';

interface Props {
  plies: AnalyzedPly[];
  current: number;
  onSelect: (ply: number) => void;
}

function Cell({
  ply, current, onSelect, activeRef,
}: {
  ply?: AnalyzedPly;
  current: number;
  onSelect: (p: number) => void;
  activeRef: RefObject<HTMLButtonElement | null>;
}) {
  if (!ply) return <div />;
  const active = current === ply.index + 1;
  const meta = CLASS_META[ply.classification];
  return (
    <button
      ref={active ? activeRef : null}
      onClick={() => onSelect(ply.index + 1)}
      aria-current={active ? 'true' : undefined}
      aria-label={`${ply.san}, ${meta.label}`}
      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
        active
          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(56,225,214,0.3)] font-bold'
          : 'bg-indigo-950/30 border-indigo-500/15 text-slate-200 hover:bg-indigo-900/40'
      }`}
    >
      <span>{ply.san}</span>
      <span className="ml-1">
        <ClassChip cls={ply.classification} size="sm" showLabel={false} />
      </span>
    </button>
  );
}

export function MoveList({ plies, current, onSelect }: Props) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll the active move into view as playback moves through the game.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [current]);

  const rows: { num: number; white?: AnalyzedPly; black?: AnalyzedPly }[] = [];
  for (let i = 0; i < plies.length; i += 2) {
    rows.push({ num: Math.floor(i / 2) + 1, white: plies[i], black: plies[i + 1] });
  }

  return (
    <div className="glass-panel rounded-2xl p-4 border border-indigo-400/20 flex flex-col h-[280px]">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-indigo-400/10">
        <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
          Game Move List
        </h3>
        <span className="text-xs font-mono text-slate-400">
          {current} / {plies.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-1">
        {rows.map((r) => (
          <div
            key={r.num}
            className="grid grid-cols-[40px_1fr_1fr] gap-2 items-center text-xs font-mono py-1 px-2 rounded-lg hover:bg-indigo-950/40"
          >
            <span className="text-slate-500 font-bold">{r.num}.</span>
            <Cell ply={r.white} current={current} onSelect={onSelect} activeRef={activeRef} />
            <Cell ply={r.black} current={current} onSelect={onSelect} activeRef={activeRef} />
          </div>
        ))}
      </div>
    </div>
  );
}
