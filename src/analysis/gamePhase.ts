// Coarse game-phase tag for a position, used to bucket move_facts so
// weakness reports can say "you collapse in the endgame". Heuristic:
// few minor/major pieces left → endgame; otherwise early plies → opening.

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

const OPENING_PLIES = 20;      // first 10 full moves
const ENDGAME_PIECE_LIMIT = 6; // total N/B/R/Q (both sides) at or below → endgame

export function gamePhase(fen: string, plyIndex: number): GamePhase {
  const board = fen.split(' ')[0];
  const minorMajor = (board.match(/[nbrq]/gi) ?? []).length;
  if (minorMajor <= ENDGAME_PIECE_LIMIT) return 'endgame';
  return plyIndex < OPENING_PLIES ? 'opening' : 'middlegame';
}
