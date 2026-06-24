import type { AnalyzedPly } from '../chess/types';
import { CLASS_META } from './classMeta';

interface Props {
  plies: AnalyzedPly[];
  current: number;             // current ply (0 = start, n = after ply n-1)
  onSelect: (ply: number) => void;
}

function Cell({ ply, current, onSelect }: { ply?: AnalyzedPly; current: number; onSelect: (p: number) => void }) {
  if (!ply) return <div className="move-cell empty" />;
  const meta = CLASS_META[ply.classification];
  const active = current === ply.index + 1;
  return (
    <div className={`move-cell${active ? ' active' : ''}`} onClick={() => onSelect(ply.index + 1)}>
      <span className="san">{ply.san}</span>
      <span className={`badge ${meta.cls}`} title={meta.label}>{meta.sym}</span>
    </div>
  );
}

export function MoveList({ plies, current, onSelect }: Props) {
  // Group plies into full-move rows: [whitePly, blackPly?].
  const rows: { num: number; white?: AnalyzedPly; black?: AnalyzedPly }[] = [];
  for (let i = 0; i < plies.length; i += 2) {
    rows.push({
      num: Math.floor(i / 2) + 1,
      white: plies[i],
      black: plies[i + 1],
    });
  }

  return (
    <div className="movelist">
      {rows.map((r) => (
        <div className="move-row" key={r.num}>
          <span className="num">{r.num}.</span>
          <Cell ply={r.white} current={current} onSelect={onSelect} />
          <Cell ply={r.black} current={current} onSelect={onSelect} />
        </div>
      ))}
    </div>
  );
}
