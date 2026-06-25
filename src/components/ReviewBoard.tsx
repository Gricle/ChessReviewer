import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import type { DrawShape } from 'chessground/draw';
import type { Classification } from '../chess/types';
import { CLASS_META } from './classMeta';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.cburnett.css';

interface Props {
  fen: string;
  lastMove?: [string, string] | null;
  badge?: { square: string; cls: Classification } | null;
  arrow?: [string, string] | null;
}

const BAD_CLASS = new Set<Classification>(['blunder', 'mistake', 'inaccuracy']);

const OVERLAY_FILL: Record<string, string> = {
  blunder: 'rgba(250, 65, 45, 0.40)',
  mistake: 'rgba(229, 143, 42, 0.35)',
  inaccuracy: 'rgba(244, 191, 62, 0.30)',
};

function badgeSvg(cls: Classification): string {
  const { sym, hex } = CLASS_META[cls];
  const fontSize = sym.length > 1 ? 30 : 38;
  // Chessground customSvg viewBox is 0 0 100 100 per square.
  // translate(50,-50) positions the badge at the top-center of the square.
  return `<g transform="translate(50,-50)">
    <circle r="27" fill="${hex}" stroke="#ffffff" stroke-width="4" />
    <text dy="0.34em" text-anchor="middle" font-family="Arial, sans-serif"
      font-weight="700" font-size="${fontSize}" fill="#ffffff">${sym}</text>
  </g>`;
}

export function ReviewBoard({ fen, lastMove, badge, arrow }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, { fen, viewOnly: true, coordinates: true });
    return () => api.current?.destroy();
  }, []);

  useEffect(() => {
    const shapes: DrawShape[] = [];
    if (arrow) shapes.push({ orig: arrow[0] as Key, dest: arrow[1] as Key, brush: 'green' });
    if (badge) {
      if (BAD_CLASS.has(badge.cls) && OVERLAY_FILL[badge.cls]) {
        // Semi-transparent square overlay covering the full square.
        // Chessground positions the SVG at the square's center, so we
        // offset by -50 in both axes (half the 100×100 viewBox) to fill
        // from center-0.5 to center+0.5 in board units.
        shapes.push({
          orig: badge.square as Key,
          customSvg: { html: `<rect x="-50" y="-50" width="100" height="100" fill="${OVERLAY_FILL[badge.cls]}" stroke="none" />` },
        });
      }
      shapes.push({
        orig: badge.square as Key,
        customSvg: { html: badgeSvg(badge.cls) },
      });
    }
    api.current?.set({
      fen,
      lastMove: lastMove ? (lastMove as Key[]) : undefined,
      drawable: { autoShapes: shapes },
    });
  }, [fen, lastMove, badge, arrow]);

  return <div ref={el} style={{ width: '100%', height: '100%' }} />;
}
