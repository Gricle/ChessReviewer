import { Chess, type Square } from 'chess.js';

export interface HangingPiece {
  square: string;
  type: 'p' | 'n' | 'b' | 'r' | 'q';
}

// Piece values in pawns. Kings get a value higher than any real piece so
// they never register as a "cheaper attacker".
const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/** Pieces of `color` capturable for free or by a cheaper attacker. Excludes kings. */
export function hangingPieces(fen: string, color: 'w' | 'b'): HangingPiece[] {
  const chess = new Chess(fen);
  const enemyColor: 'w' | 'b' = color === 'w' ? 'b' : 'w';
  const result: HangingPiece[] = [];

  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== color || sq.type === 'k') continue;

      const attackers = chess.attackers(sq.square, enemyColor);
      if (attackers.length === 0) continue;

      const defenders = chess.attackers(sq.square, color);
      const pieceValue = VALUES[sq.type];
      const minAttackerValue = Math.min(
        ...attackers.map((s) => VALUES[chess.get(s)!.type]),
      );

      if (defenders.length === 0 || minAttackerValue < pieceValue) {
        result.push({ square: sq.square, type: sq.type as HangingPiece['type'] });
      }
    }
  }

  return result;
}

/**
 * Squares of enemy pieces worth >= the mover (or the king) attacked by the
 * piece that lands via `uci`; a fork = 2+ results.
 */
export function forkTargets(fenBefore: string, uci: string): string[] {
  const chess = new Chess(fenBefore);
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const promotion = uci.slice(4) || undefined;
  const mover = chess.turn();

  try {
    chess.move({ from, to, promotion });
  } catch {
    return [];
  }

  const landed = chess.get(to);
  if (!landed) return [];

  const moverValue = VALUES[landed.type];
  const enemyColor: 'w' | 'b' = mover === 'w' ? 'b' : 'w';
  const targets: string[] = [];

  for (const row of chess.board()) {
    for (const sq of row) {
      if (!sq || sq.color !== enemyColor) continue;
      const isKing = sq.type === 'k';
      if (!isKing && VALUES[sq.type] < moverValue) continue;

      const attackerSquares = chess.attackers(sq.square, mover);
      if (attackerSquares.includes(to)) {
        targets.push(sq.square);
      }
    }
  }

  return targets;
}

/** True when a mover-perspective cp encodes a forced mate for the mover. */
export function isMateScore(cp: number): boolean {
  return cp >= 31000;
}

/** True when it encodes being mated. */
export function isMatedScore(cp: number): boolean {
  return cp <= -31000;
}
