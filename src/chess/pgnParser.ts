import { Chess } from 'chess.js';
import type { ParsedGame, Ply } from './types';

export function parsePgn(pgn: string): ParsedGame {
  const loader = new Chess();
  loader.loadPgn(pgn); // throws on invalid PGN
  const headers = loader.header() as Record<string, string>;
  const verbose = loader.history({ verbose: true });

  const replay = new Chess();
  const plies: Ply[] = verbose.map((m, i) => {
    const fenBefore = replay.fen();
    replay.move(m.san);
    const fenAfter = replay.fen();
    return {
      index: i,
      fenBefore,
      fenAfter,
      san: m.san,
      uci: m.from + m.to + (m.promotion ?? ''),
      color: m.color === 'w' ? 'white' : 'black',
      moveNumber: Math.floor(i / 2) + 1,
    };
  });

  return {
    plies,
    headers,
    white: headers.White ?? 'White',
    black: headers.Black ?? 'Black',
  };
}
