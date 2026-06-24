import { Chess } from 'chess.js';

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// Material balance in pawns, from the side-to-move perspective.
export function materialBalance(fen: string): number {
  const c = new Chess(fen);
  let white = 0;
  let black = 0;
  for (const row of c.board()) {
    for (const sq of row) {
      if (!sq) continue;
      const v = VALUES[sq.type];
      if (sq.color === 'w') white += v;
      else black += v;
    }
  }
  const fromWhite = white - black;
  return c.turn() === 'w' ? fromWhite : -fromWhite;
}
