import type { ParsedGame, PositionAnalysis } from '../chess/types';
import { Engine } from '../engine/engine';

// Analyze every distinct position needed: fenBefore of each ply, plus the final fenAfter.
// Returns a map keyed by FEN. Reports progress 0..1 via onProgress.
export async function analyzeGame(
  game: ParsedGame,
  depth: number,
  onProgress?: (done: number, total: number) => void,
  engine: Engine = new Engine(),
): Promise<Map<string, PositionAnalysis>> {
  const fens: string[] = [];
  for (const ply of game.plies) fens.push(ply.fenBefore);
  const last = game.plies[game.plies.length - 1];
  if (last) fens.push(last.fenAfter);

  const unique = Array.from(new Set(fens));
  const result = new Map<string, PositionAnalysis>();
  let done = 0;
  for (const fen of unique) {
    result.set(fen, await engine.analyze(fen, depth));
    done += 1;
    onProgress?.(done, unique.length);
  }
  return result;
}
