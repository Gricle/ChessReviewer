export type Color = 'white' | 'black';

export interface Ply {
  index: number;       // 0-based ply index
  fenBefore: string;   // FEN before the move (side to move = mover)
  fenAfter: string;    // FEN after the move (side to move = opponent)
  san: string;         // move in SAN, e.g. "Nf3"
  uci: string;         // move in UCI, e.g. "g1f3"
  color: Color;        // side that moved
  moveNumber: number;  // full move number (1-based)
}

export interface ParsedGame {
  plies: Ply[];
  headers: Record<string, string>;
  white: string;
  black: string;
}

// Engine evaluation of ONE position, from the side-to-move perspective.
export interface PositionAnalysis {
  fen: string;
  bestMoveUci: string;
  bestEvalCp: number;            // centipawns; mate encoded as +/- 32000
  secondBestEvalCp: number | null;
  mate: number | null;           // signed moves-to-mate, or null
}

export type Classification =
  | 'book' | 'brilliant' | 'great' | 'best' | 'excellent'
  | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface AnalyzedPly extends Ply {
  bestMoveUci: string;
  evalBeforeCp: number;   // mover perspective (= best eval at fenBefore)
  evalAfterCp: number;    // mover perspective (= -best eval at fenAfter)
  classification: Classification;
  accuracy: number;       // 0..100
}

export interface ReviewSummary {
  opening: { eco: string; name: string } | null;
  whiteAccuracy: number;
  blackAccuracy: number;
  counts: Record<Classification, { white: number; black: number }>;
}
