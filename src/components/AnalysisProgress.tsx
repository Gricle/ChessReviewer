import { Cpu, Loader2 } from 'lucide-react';

interface Props {
  label: string;
  pct: number;
}

export function AnalysisProgress({ label, pct }: Props) {
  const p = Math.min(100, Math.max(0, Math.round(pct)));

  return (
    <div className="w-full max-w-xl mx-auto my-12 glass-panel rounded-3xl p-8 border border-cyan-400/30 shadow-[0_0_40px_rgba(56,225,214,0.15)] flex flex-col items-center gap-5 text-center">
      <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_20px_rgba(56,225,214,0.3)]">
        <Cpu className="w-7 h-7 animate-pulse" />
      </div>

      <div>
        <h3 className="text-xl font-extrabold text-white font-display">
          Evaluating Positions
        </h3>
        <p className="text-xs font-mono text-slate-400 mt-1">
          Stockfish Depth 14 · Client-side
        </p>
      </div>

      {/* Progress Bar Container */}
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-300 font-semibold">
            {label}
          </span>
          <span className="text-cyan-300 font-bold">{p}%</span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={p}
          aria-valuemin={0}
          aria-valuemax={100}
          className="w-full h-3 bg-indigo-950 rounded-full overflow-hidden border border-indigo-500/30 p-0.5"
        >
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(56,225,214,0.6)]"
            style={{ width: `${p}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs font-mono text-indigo-200/60">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
        <span>Computing move classifications and coach insights...</span>
      </div>
    </div>
  );
}
