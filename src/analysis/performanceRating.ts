// Estimate an Elo-like performance rating from a player's game accuracy and
// mistake distribution. Same spirit as chess.com's "you played like ~1850":
// a monotonic accuracy → rating curve (piecewise-linear between calibration
// anchors) minus a penalty for concentrated errors. The anchors are tuned by
// feel, not fitted to real data — adjust them here if estimates feel off.

export interface PerformanceInput {
  accuracy: number;      // player's game accuracy, 0..100
  moveCount: number;     // number of moves the player made
  inaccuracies: number;
  mistakes: number;
  blunders: number;
}

const FLOOR = 100;
const CEILING = 3200;

// [accuracy, rating] — must stay sorted by accuracy ascending.
const ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0, FLOOR],
  [50, 400],
  [60, 700],
  [70, 1000],
  [75, 1250],
  [80, 1500],
  [85, 1800],
  [90, 2100],
  [95, 2500],
  [100, CEILING],
];

function baseRating(accuracy: number): number {
  const acc = Math.max(0, Math.min(100, accuracy));
  for (let i = 1; i < ANCHORS.length; i++) {
    const [a1, r1] = ANCHORS[i - 1];
    const [a2, r2] = ANCHORS[i];
    if (acc <= a2) {
      const t = (acc - a1) / (a2 - a1);
      return r1 + t * (r2 - r1);
    }
  }
  return CEILING;
}

export function estimatePerformanceRating(input: PerformanceInput): number {
  const { accuracy, moveCount, inaccuracies, mistakes, blunders } = input;

  // Errors per move, weighted by severity. Accuracy already reflects errors
  // on average; this penalty separates "one huge blunder" games from
  // "uniformly sloppy" ones at the same accuracy.
  const errorWeight = 2 * blunders + mistakes + 0.5 * inaccuracies;
  const errorRate = errorWeight / Math.max(1, moveCount);
  const penalty = Math.min(400, errorRate * 900);

  const raw = baseRating(accuracy) - penalty;
  const clamped = Math.max(FLOOR, Math.min(CEILING, raw));
  return Math.round(clamped / 50) * 50;
}
