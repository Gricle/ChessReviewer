// Per-move accuracy from the moving player's win% before vs after the move.
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * (winBefore - winAfter)) - 3.1669;
  return Math.max(0, Math.min(100, raw));
}

// Per-player game accuracy = mean of that player's per-move accuracies.
export function gameAccuracy(moveAccuracies: number[]): number {
  if (moveAccuracies.length === 0) return 100;
  const sum = moveAccuracies.reduce((a, b) => a + b, 0);
  return sum / moveAccuracies.length;
}
