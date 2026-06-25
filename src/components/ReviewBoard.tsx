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

/** Build the full SVG content for a square: optional overlay rect + badge icon.
 *  Chessground wraps this in <svg width="1" height="1" viewBox="0 0 100 100">
 *  and translates the <g> to the square center in user coordinates.
 *
 *  To fill the entire square we use a <rect> that goes from -50,-50 to +50,+50
 *  in viewBox units (= -0.5,-0.5 to +0.5,+0.5 in user units from square center).
 *  The badge is placed at the top-right corner via translate(50,-50).
 */
function fullSquareSvg(cls: Classification): string {
  let html = '';
  if (BAD_CLASS.has(cls) && OVERLAY_FILL[cls]) {
    html += `<rect x="-50" y="-50" width="100" height="100" fill="${OVERLAY_FILL[cls]}" stroke="none" />`;
  }
  const hex = BADGE_COLOR[cls] ?? '#888';
  const sym = BADGE_SYM[cls] ?? '?';
  const fontSize = sym.length > 1 ? 30 : 38;
  html += `<g transform="translate(50,-50)">
    <circle r="27" fill="${hex}" stroke="#ffffff" stroke-width="4" />
    <text dy="0.34em" text-anchor="middle" font-family="Arial,sans-serif"
      font-weight="700" font-size="${fontSize}" fill="#ffffff">${sym}</text>
  </g>`;
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
