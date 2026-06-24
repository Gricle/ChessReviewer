// Convert a centipawn eval (side-to-move perspective) to a win percentage 0..100.
// Uses the published Lichess/chess.com logistic curve.
export function cpToWinPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
