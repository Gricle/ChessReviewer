import { cpToWinPercent } from '../analysis/winPercent';

interface Props {
  cp: number; // current evaluation in centipawns, white perspective
}

// Vertical evaluation bar: white fills from the bottom, black from the top,
// proportional to white's win probability.
export function EvalBar({ cp }: Props) {
  const whitePct = Math.max(0, Math.min(100, cpToWinPercent(cp)));
  const pawns = cp / 100;
  const label = Math.abs(pawns) >= 100 ? (pawns > 0 ? 'M' : '-M') : pawns.toFixed(1);

  return (
    <div className="evalbar" title={`${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`}>
      <div className="black" style={{ height: `${100 - whitePct}%` }} />
      <div className="white" style={{ height: `${whitePct}%` }} />
      <span className="num">{label}</span>
    </div>
  );
}
