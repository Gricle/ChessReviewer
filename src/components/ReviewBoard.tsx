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
  lastMove?: [string, string] | null;       // highlight the squares of the move played
  badge?: { square: string; cls: Classification } | null; // chess.com-style move-quality badge
  arrow?: [string, string] | null;           // best-move arrow
}

// SVG for the on-board move-quality badge, anchored at the square's top-right
// corner (chessground maps viewBox 0..100 to one square from the square center).
function badgeSvg(cls: Classification): string {
  const { sym, hex } = CLASS_META[cls];
  const fontSize = sym.length > 1 ? 30 : 38;
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
      shapes.push({ orig: badge.square as Key, customSvg: { html: badgeSvg(badge.cls) } });
    }
    api.current?.set({
      fen,
      lastMove: lastMove ? (lastMove as Key[]) : undefined,
      drawable: { autoShapes: shapes },
    });
  }, [fen, lastMove, badge, arrow]);

  return <div ref={el} style={{ width: '100%', height: '100%' }} />;
}
