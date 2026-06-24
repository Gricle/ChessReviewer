interface Props {
  // White-perspective evals in centipawns, one per ply (already converted).
  evalsCp: number[];
  current: number;            // current ply index (0-based) to highlight
  onSelect: (ply: number) => void;
}

const W = 480;
const H = 96;
const CLAMP = 800; // clamp eval display to +/-8 pawns

export function EvalGraph({ evalsCp, current, onSelect }: Props) {
  if (evalsCp.length === 0) return null;
  const x = (i: number) => (i / Math.max(1, evalsCp.length - 1)) * W;
  const y = (cp: number) => {
    const c = Math.max(-CLAMP, Math.min(CLAMP, cp));
    return H / 2 - (c / CLAMP) * (H / 2);
  };
  const line = evalsCp.map((cp, i) => `${x(i)},${y(cp)}`).join(' ');
  // Area under the curve down to the midline, for a filled look.
  const area = `0,${H / 2} ${line} ${W},${H / 2}`;

  return (
    <svg
      className="evalgraph"
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: 'block', cursor: 'pointer' }}
      onClick={(e) => {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * W;
        onSelect(Math.round((px / W) * (evalsCp.length - 1)));
      }}
    >
      <rect x={0} y={0} width={W} height={H / 2} fill="rgba(255,255,255,0.06)" />
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
      <polygon points={area} fill="rgba(129,182,76,0.18)" />
      <polyline points={line} fill="none" stroke="#81b64c" strokeWidth={1.6} />
      <line x1={x(current)} y1={0} x2={x(current)} y2={H} stroke="#e9e9e9" strokeWidth={1} strokeDasharray="3 3" />
    </svg>
  );
}
