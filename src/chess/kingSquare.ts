import type { Color } from './types';

/** Square ("e1") of the given side's king in a FEN, or null if absent. */
export function kingSquare(fen: string, color: Color): string | null {
  const board = fen.split(' ')[0];
  const target = color === 'white' ? 'K' : 'k';
  const ranks = board.split('/');
  for (let r = 0; r < ranks.length; r++) {
    let file = 0;
    for (const ch of ranks[r]) {
      if (ch >= '1' && ch <= '8') { file += Number(ch); continue; }
      if (ch === target) return `${'abcdefgh'[file]}${8 - r}`;
      file++;
    }
  }
  return null;
}
