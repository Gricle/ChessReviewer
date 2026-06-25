import type { AnalyzedPly, Classification } from '../chess/types';

interface Props {
  plies: AnalyzedPly[];
  current: number;
  onSelect: (ply: number) => void;
}

const SAN_COLORS: Record<Classification, string> = {
  brilliant: '#26c2a3',
  great: '#749bbf',
  best: '#81b64c',
  excellent: '#96bc4b',
  good: '#95af6b',
  book: '#a88865',
  inaccuracy: '#f4bf3e',
  mistake: '#e58f2a',
  blunder: '#fa412d',
};

const BADGE_SYM: Record<Classification, string> = {
  brilliant: '!!', great: '!', best: '★', excellent: '✓', good: '✓',
  book: '📖', inaccuracy: '?!', mistake: '?', blunder: '??',
};

function Cell({ ply, current, onSelect }: { ply?: AnalyzedPly; current: number; onSelect: (p: number) => void }) {
  if (!ply) return <div className="move-cell empty" />;
  const active = current === ply.index + 1;
  return (
    <div className={`move-cell${active ? ' active' : ''}`} onClick={() => onSelect(ply.index + 1)}>
      <span className="badge" style={{ background: SAN_COLORS[ply.classification], color: '#15140f' }}>
        {BADGE_SYM[ply.classification]}
      </span>
      <span className="san" style={{ color: SAN_COLORS[ply.classification] }}>{ply.san}</span>
    </div>
  );
}

export function MoveList({ plies, current, onSelect }: Props) {
  const rows: { num: number; white?: AnalyzedPly; black?: AnalyzedPly }[] = [];
  for (let i = 0; i < plies.length; i += 2) {
    rows.push({ num: Math.floor(i / 2) + 1, white: plies[i], black: plies[i + 1] });
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
