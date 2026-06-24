interface Props {
  // White-perspective evals in centipawns, one per ply (already converted).
  evalsCp: number[];
  current: number;            // current ply index (0-based) to highlight
  onSelect: (ply: number) => void;
}

const W = 480;
const H = 120;
const CLAMP = 1000; // clamp eval display to +/-10 pawns

export function EvalGraph({ evalsCp, current, onSelect }: Props) {
  if (evalsCp.length === 0) return null;
  const x = (i: number) => (i / Math.max(1, evalsCp.length - 1)) * W;
  const y = (cp: number) => {
    const c = Math.max(-CLAMP, Math.min(CLAMP, cp));
    return H / 2 - (c / CLAMP) * (H / 2);
  };
  const points = evalsCp.map((cp, i) => `${x(i)},${y(cp)}`).join(' ');

  return (
    <svg width={W} height={H} style={{ background: '#eee' }}
         onClick={(e) => {
           const rect = (e.target as SVGElement).ownerSVGElement!.getBoundingClientRect();
           const px = e.clientX - rect.left;
           onSelect(Math.round((px / W) * (evalsCp.length - 1)));
         }}>
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#999" />
      <polyline points={points} fill="none" stroke="#2a7" strokeWidth={2} />
      <line x1={x(current)} y1={0} x2={x(current)} y2={H} stroke="#c33" strokeWidth={1} />
    </svg>
  );
}
