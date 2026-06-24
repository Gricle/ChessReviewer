import type { AnalyzedPly, Classification } from '../chess/types';

const ICON: Record<Classification, string> = {
  brilliant: '!!', great: '!', best: '★', excellent: '✓', good: '·',
  book: '📖', inaccuracy: '?!', mistake: '?', blunder: '??',
};
const COLOR: Record<Classification, string> = {
  brilliant: '#1baca6', great: '#5c8bb0', best: '#3a3', excellent: '#4a4', good: '#777',
  book: '#a88', inaccuracy: '#e6a23c', mistake: '#e67e22', blunder: '#c0392b',
};

interface Props {
  plies: AnalyzedPly[];
  current: number;             // current ply (0 = start, n = after ply n-1)
  onSelect: (ply: number) => void;
}

export function MoveList({ plies, current, onSelect }: Props) {
  return (
    <div style={{ maxHeight: 480, overflowY: 'auto', width: 220 }}>
      {plies.map((p) => (
        <div
          key={p.index}
          onClick={() => onSelect(p.index + 1)}
          style={{
            cursor: 'pointer',
            padding: '2px 6px',
            background: current === p.index + 1 ? '#dde' : 'transparent',
          }}
        >
          {p.color === 'white' ? <b>{p.moveNumber}. </b> : <span>… </span>}
          {p.san}{' '}
          <span style={{ color: COLOR[p.classification] }}>{ICON[p.classification]}</span>
        </div>
      ))}
    </div>
  );
}
