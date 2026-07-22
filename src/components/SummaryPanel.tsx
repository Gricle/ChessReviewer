import type { ReviewSummary } from '../chess/types';
import type { PlayerRatings } from '../chess/ratings';
import { CLASS_META, CLASS_ORDER } from './classMeta';
import { ClassChip } from './ClassChip';

interface Props {
  summary: ReviewSummary;
  white: string;
  black: string;
  ratings: PlayerRatings;
  result?: string | null;
}

function movesPlayed(summary: ReviewSummary, color: 'white' | 'black'): number {
  return Object.values(summary.counts).reduce((n, c) => n + c[color], 0);
}

function AccuracyTile({
  name, accuracy, rating, est, hasMoves,
}: {
  name: string;
  accuracy: number;
  rating: number | null;
  est: number;
  hasMoves: boolean;
}) {
  return (
    <div className="bg-indigo-950/50 rounded-2xl p-3 border border-indigo-500/20 text-center min-w-0">
      <div className="text-xs font-mono text-slate-400 font-bold truncate" title={name}>{name}</div>
      <div className="text-2xl font-extrabold font-mono text-cyan-300">{accuracy.toFixed(1)}</div>
      <div className="text-[11px] font-mono text-slate-500" title="Estimated performance this game">
        {rating !== null && <span>{rating}</span>}
        {rating !== null && hasMoves && <span> → </span>}
        {hasMoves && <span>~{est}</span>}
      </div>
    </div>
  );
}

export function SummaryPanel({ summary, white, black, ratings, result }: Props) {
  const whiteHasMoves = movesPlayed(summary, 'white') > 0;
  const blackHasMoves = movesPlayed(summary, 'black') > 0;

  return (
    <div className="glass-panel rounded-2xl p-4 border border-indigo-400/20">
      <div className="grid grid-cols-3 gap-2 mb-4">
        <AccuracyTile
          name={white}
          accuracy={summary.whiteAccuracy}
          rating={ratings.white}
          est={summary.estRating.white}
          hasMoves={whiteHasMoves}
        />
        {result ? (
          <div className="bg-indigo-950/50 rounded-2xl p-3 border border-indigo-500/20 text-center flex flex-col justify-center">
            <div className="text-xs font-mono text-slate-400 font-bold">Result</div>
            <div className="text-lg font-extrabold font-mono text-cyan-300">{result}</div>
          </div>
        ) : <div />}
        <AccuracyTile
          name={black}
          accuracy={summary.blackAccuracy}
          rating={ratings.black}
          est={summary.estRating.black}
          hasMoves={blackHasMoves}
        />
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono mb-3">
          Move Classification Breakdown
        </h3>
        <div className="space-y-1.5 font-mono text-xs">
          <div className="grid grid-cols-[1fr_50px_50px] px-3 py-1.5 text-slate-400 font-bold border-b border-indigo-400/10">
            <span>Classification</span>
            <span className="text-center text-slate-200 truncate" title={white}>{white}</span>
            <span className="text-center text-slate-200 truncate" title={black}>{black}</span>
          </div>
          {CLASS_ORDER.map((label) => {
            const c = summary.counts[label];
            if (c.white === 0 && c.black === 0) return null;
            const meta = CLASS_META[label];
            return (
              <div
                key={label}
                className="grid grid-cols-[1fr_50px_50px] items-center px-3 py-1.5 rounded-lg bg-indigo-950/30 border border-indigo-500/10"
              >
                <div className="flex items-center gap-2">
                  <ClassChip cls={label} size="sm" showLabel={false} />
                  <span className="text-slate-200">{meta.label}</span>
                </div>
                <span className={`text-center font-bold ${c.white > 0 ? 'text-white' : 'text-slate-600'}`}>{c.white}</span>
                <span className={`text-center font-bold ${c.black > 0 ? 'text-white' : 'text-slate-600'}`}>{c.black}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
