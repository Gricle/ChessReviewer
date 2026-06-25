import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';
import type { DrawShape } from 'chessground/draw';
import type { Classification } from '../chess/types';
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

const BADGE_COLOR: Record<string, string> = {
  brilliant: '#26c2a3', great: '#749bbf', best: '#81b64c',
  excellent: '#96bc4b', good: '#95af6b', book: '#a88865',
  inaccuracy: '#f4bf3e', mistake: '#e58f2a', blunder: '#fa412d',
};

const BADGE_SYM: Record<string, string> = {
  brilliant: '!!', great: '!', best: '★', excellent: '✓', good: '✓',
  book: '📖', inaccuracy: '?!', mistake: '?', blunder: '??',
};

/** Build SVG content for a square: overlay rect + badge icon.
 *
 *  Chessground places this customSvg.html inside:
 *    <svg width="1" height="1" viewBox="0 0 100 100">
 *  which is positioned at the square center in user coordinates.
 *
 *  The inner <svg> has overflow:hidden by default, so coordinates
 *  must stay within the 0..100 viewBox. To cover the full square area
 *  (-50..50 from center), we set overflow:visible on the group so
 *  the rect at x="-50" y="-50" width="100" height="100" renders
 *  without being clipped to the bottom-right quadrant.
 *
 *  Badge is placed at translate(50,-50) = top-right of the square.
 */
function fullSquareSvg(cls: Classification): string {
  let html = '<g style="overflow:visible">';
  if (BAD_CLASS.has(cls) && OVERLAY_FILL[cls]) {
    html += `<rect x="-50" y="-50" width="100" height="100" fill="${OVERLAY_FILL[cls]}" />`;
  }
  const hex = BADGE_COLOR[cls] ?? '#888';
  const sym = BADGE_SYM[cls] ?? '?';
  const fontSize = sym.length > 1 ? 30 : 36;
  const r = sym.length > 1 ? 20 : 24;
  html += `<g transform="translate(50,-50)">
    <circle r="${r}" fill="${hex}" stroke="#ffffff" stroke-width="3" />
    <text dy="0.33em" text-anchor="middle" font-family="Arial,sans-serif"
      font-weight="700" font-size="${fontSize}" fill="#ffffff">${sym}</text>
  </g></g>`;
  return html;
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
      shapes.push({
        orig: badge.square as Key,
        customSvg: { html: fullSquareSvg(badge.cls) },
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
