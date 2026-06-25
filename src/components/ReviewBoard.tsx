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

// CSS class applied to the square element (behind the piece) for bad moves.
const OVERLAY_CLASS: Record<string, string> = {
  blunder: 'ov-blunder',
  mistake: 'ov-mistake',
  inaccuracy: 'ov-inaccuracy',
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

/** Build SVG content for the move-quality badge icon.
 *
 *  The square color is NOT drawn here — it's applied via highlight.custom
 *  as a <square> class so it sits behind the piece. customSvg renders on
 *  top of pieces, so it's used only for the badge.
 *
 *  Chessground injects this html inside:
 *    <svg width="1" height="1" viewBox="0 0 100 100">
 *  inside the .cg-custom-svgs layer, whose own viewBox is "-3.5 -3.5 8 8"
 *  (offset by half a square vs the .cg-shapes layer's "-4 -4 8 8"). That
 *  offset makes this 1x1 inner svg land *centered* on the target square,
 *  so within the inner viewBox 0..100: (0,0) = top-left corner,
 *  (50,50) = center, (100,100) = bottom-right corner.
 *
 *  The badge sits at the top-right corner (100,0); it extends slightly
 *  outside the square, so the group is overflow:visible.
 */
function badgeSvg(cls: Classification): string {
  const hex = BADGE_COLOR[cls] ?? '#888';
  const sym = BADGE_SYM[cls] ?? '?';
  const fontSize = sym.length > 1 ? 30 : 36;
  const r = sym.length > 1 ? 20 : 24;
  return `<g style="overflow:visible"><g transform="translate(100,0)">
    <circle r="${r}" fill="${hex}" stroke="#ffffff" stroke-width="3" />
    <text dy="0.33em" text-anchor="middle" font-family="Arial,sans-serif"
      font-weight="700" font-size="${fontSize}" fill="#ffffff">${sym}</text>
  </g></g>`;
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
    const custom = new Map<Key, string>();
    if (badge) {
      shapes.push({
        orig: badge.square as Key,
        customSvg: { html: badgeSvg(badge.cls) },
      });
      if (BAD_CLASS.has(badge.cls) && OVERLAY_CLASS[badge.cls]) {
        custom.set(badge.square as Key, OVERLAY_CLASS[badge.cls]);
      }
    }
    api.current?.set({
      fen,
      lastMove: lastMove ? (lastMove as Key[]) : undefined,
      highlight: { custom },
      drawable: { autoShapes: shapes },
    });
  }, [fen, lastMove, badge, arrow]);

  return <div ref={el} style={{ width: '100%', height: '100%' }} />;
}
