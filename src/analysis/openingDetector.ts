export interface Opening {
  eco: string;
  name: string;
  uciMoves: string[];
}

export interface OpeningMatch {
  opening: Opening | null;
  bookPlies: number;
}

export function detectOpening(gameUci: string[], book: Opening[]): OpeningMatch {
  let best: Opening | null = null;
  for (const o of book) {
    if (o.uciMoves.length > gameUci.length) continue;
    const matches = o.uciMoves.every((m, i) => m === gameUci[i]);
    if (matches && (!best || o.uciMoves.length > best.uciMoves.length)) {
      best = o;
    }
  }
  return { opening: best, bookPlies: best ? best.uciMoves.length : 0 };
}
