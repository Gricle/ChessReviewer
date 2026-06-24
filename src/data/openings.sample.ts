import type { Opening } from '../analysis/openingDetector';

// Minimal sample. The full Lichess ECO set (UCI move lists) can be dropped in later
// using the same shape.
export const OPENINGS: Opening[] = [
  { eco: 'C60', name: 'Ruy Lopez', uciMoves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'] },
  { eco: 'C50', name: 'Italian Game', uciMoves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'] },
  { eco: 'B20', name: 'Sicilian Defense', uciMoves: ['e2e4', 'c7c5'] },
  { eco: 'D02', name: "Queen's Pawn Game", uciMoves: ['d2d4', 'd7d5'] },
];
