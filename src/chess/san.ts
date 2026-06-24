import { Chess } from 'chess.js';

// Convert a UCI move to SAN in the context of a position (FEN).
// Returns the original UCI string if the move is somehow illegal here.
export function uciToSan(fen: string, uci: string): string {
  try {
    const c = new Chess(fen);
    const m = c.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.slice(4) || undefined,
    });
    return m.san;
  } catch {
    return uci;
  }
}
