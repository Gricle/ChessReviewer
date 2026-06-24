import type { Classification } from '../chess/types';
import { CLASS_META } from './classMeta';

export interface CurrentMove {
  san: string;
  cls: Classification;
  bestSan: string;
  isBest: boolean;
}

interface Props {
  opening: { eco: string; name: string } | null;
  evalCp: number;        // white-perspective centipawns
  move: CurrentMove | null;
}

function formatEval(cp: number): string {
  if (Math.abs(cp) >= 10000) return cp > 0 ? '#' : '-#';
  const p = cp / 100;
  return `${p > 0 ? '+' : ''}${p.toFixed(1)}`;
}

function comment(move: CurrentMove | null): string {
  if (!move) return 'Step through the game to see each move reviewed.';
  const lead: Record<Classification, string> = {
    book: `${move.san} is still theory.`,
    brilliant: `${move.san} is brilliant!`,
    great: `${move.san} is a great move.`,
    best: `${move.san} is the best move.`,
    excellent: `${move.san} is excellent.`,
    good: `${move.san} is a good move.`,
    inaccuracy: `${move.san} is an inaccuracy.`,
    mistake: `${move.san} is a mistake.`,
    blunder: `${move.san} is a blunder.`,
  };
  const wantsBetter = move.cls === 'inaccuracy' || move.cls === 'mistake' || move.cls === 'blunder';
  const suggest = wantsBetter && !move.isBest ? ` ${move.bestSan} was stronger.` : '';
  return lead[move.cls] + suggest;
}

export function CoachCard({ opening, evalCp, move }: Props) {
  const meta = move ? CLASS_META[move.cls] : null;
  const evalPositive = evalCp >= 0;

  return (
    <div className="card coach">
      <div className="coach-head">
        <div className="avatar" aria-hidden="true">♞</div>
        <div className="coach-title">
          <h3>Game Review</h3>
          {opening && <div className="opening">{opening.eco} · {opening.name}</div>}
        </div>
        <div className={`eval-pill ${evalPositive ? 'pos' : 'neg'}`}>{formatEval(evalCp)}</div>
      </div>
      <div className="comment">
        {meta && <span className={`badge lg ${meta.cls}`}>{meta.sym}</span>}
        <p>{comment(move)}</p>
      </div>
    </div>
  );
}
