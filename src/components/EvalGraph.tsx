import type { Classification } from '../chess/types';
import { CLASS_META } from './classMeta';

interface Props {
  evalsCp: number[];
  classifications?: Classification[];
  current: number;
  onSelect: (ply: number) => void;
}

const W = 480;
const H = 96;
const CLAMP = 800;
const DOT_R = 3.5;

function pathSegment(a: { x: number; y: number }, b: { x: number; y: number }) {
  return `M${a.x},${H / 2} L${b.x},${H / 2} L${b.x},${b.y} L${a.x},${a.y} Z`;
}

export function EvalGraph({ evalsCp, classifications, current, onSelect }: Props) {
  if (evalsCp.length === 0) return null;

  const x = (i: number) => (i / Math.max(1, evalsCp.length - 1)) * W;
  const y = (cp: number) => {
    const c = Math.max(-CLAMP, Math.min(CLAMP, cp));
    return H / 2 - (c / CLAMP) * (H / 2);
  };
  const pts = evalsCp.map((cp, i) => ({ x: x(i), y: y(cp), raw: cp }));
  const lineStr = pts.map((p) => `${p.x},${p.y}`).join(' ');

  // Chess.com-style: fill green above midline when white is winning,
  // red below midline when black is winning.
  const fillDefs = pts.map((p, i) => ({
    key: i,
    d: i === 0 ? '' : pathSegment(pts[i - 1], p),
    pos: i === 0 ? false : (pts[i - 1].raw + p.raw) / 2 >= 0,
  }));

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    onSelect(Math.round((px / W) * (evalsCp.length - 1)));
  };

  const handleKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); onSelect(Math.min(evalsCp.length - 1, current + 1)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); onSelect(Math.max(0, current - 1)); }
  };

  return (
    <svg
      className="evalgraph"
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: 'block', cursor: 'pointer' }}
      tabIndex={0}
      role="slider"
      aria-label="Evaluation graph — use left/right arrows to navigate"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, evalsCp.length - 1)}
      aria-valuenow={current}
      aria-valuetext={`Move ${current + 1} of ${evalsCp.length}`}
      onClick={handleClick}
      onKeyDown={handleKey}
    >
      {/* Midline */}
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />

      {/* Area fill — green above when white ahead, red below when black ahead */}
      {fillDefs.slice(1).map((seg) => (
        <path key={seg.key} d={seg.d} fill={seg.pos ? 'rgba(129,182,76,0.25)' : 'rgba(250,65,45,0.18)'} />
      ))}

      {/* Line */}
      <polyline points={lineStr} fill="none" stroke="#81b64c" strokeWidth={1.6} />

      {/* Classification dots */}
      {classifications && evalsCp.map((cp, i) => {
        if (i % 2 !== 0) return null;
        const hex = CLASS_META[classifications[i]]?.hex;
        if (!hex) return null;
        return <circle key={i} cx={x(i)} cy={y(cp)} r={DOT_R} fill={hex} stroke="#262421" strokeWidth={1.2} />;
      })}

      {/* Current-position line */}
      <line x1={x(current)} y1={0} x2={x(current)} y2={H} stroke="#e9e9e9" strokeWidth={1} strokeDasharray="3 3" />
    </svg>
  );
}
