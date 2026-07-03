import type { AnalyzedPly } from '../chess/types';
import { forkTargets, isMateScore, isMatedScore, newlyHungPiece } from './motifs';

export interface ExplainCtx {
  bestSan: string; // SAN of ply.bestMoveUci at fenBefore
  nextBestSan: string | null; // opponent's best reply (SAN at fenAfter), null on last ply
}

const PIECE_NAMES: Record<'p' | 'n' | 'b' | 'r' | 'q', string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
};

export const BAD_CLASSES = new Set(['inaccuracy', 'mistake', 'blunder']);

export function explainMove(ply: AnalyzedPly, ctx: ExplainCtx): string {
  const { san, uci, bestMoveUci, classification, evalBeforeCp, evalAfterCp, fenBefore, fenAfter } =
    ply;
  const moverColor: 'w' | 'b' = ply.color === 'white' ? 'w' : 'b';

  // 1. Book move.
  if (classification === 'book') {
    return `${san} is a book move — theory continues.`;
  }

  // 2. Bad moves: lead with the better alternative, then explain why.
  if (BAD_CLASSES.has(classification)) {
    const lead = `Better was ${ctx.bestSan}.`;
    let why = '';

    if (isMatedScore(evalAfterCp) && !isMatedScore(evalBeforeCp)) {
      // 2a
      why = 'This walks into a forced mate.';
    } else if (isMateScore(evalBeforeCp) && !isMateScore(evalAfterCp)) {
      // 2b
      why = 'You had a forced mate and let it slip.';
    } else {
      const newlyHung = newlyHungPiece(fenBefore, fenAfter, moverColor);

      if (newlyHung) {
        // 2c
        why = `This leaves your ${PIECE_NAMES[newlyHung.type]} on ${newlyHung.square} hanging.`;
      } else if (ctx.nextBestSan) {
        // 2d
        why = `The threat is now ${ctx.nextBestSan}.`;
      } else if (classification === 'blunder') {
        // 2e
        why = 'This loses significant ground.';
      } else if (classification === 'mistake') {
        // 2e
        why = 'This could have been punished.';
      }
      // inaccuracy: no extra clause, lead sentence stands alone.
    }

    return why ? `${lead} ${why}` : lead;
  }

  // 3. Brilliant.
  if (classification === 'brilliant') {
    const forks = forkTargets(fenBefore, uci);
    const forkClause = forks.length >= 2 ? ' and sets up a fork' : '';
    return `A stunning sacrifice! ${san} gives up material${forkClause}.`;
  }

  // 4. Great.
  if (classification === 'great') {
    return `${san} is the only good move here.`;
  }

  // 5. best / excellent / good.
  if (uci === bestMoveUci && isMateScore(evalBeforeCp)) {
    // 5a
    return `${san} keeps the forced mate on track.`;
  }

  const forks = forkTargets(fenBefore, uci);
  if (forks.length >= 2) {
    // 5b
    return `${san} forks ${forks.length} pieces.`;
  }

  // 5c
  if (classification === 'best') {
    return `${san} is the strongest move.`;
  }
  if (classification === 'excellent') {
    return `${san} is strong — only ${ctx.bestSan} was better.`;
  }
  return `${san} keeps the balance, but ${ctx.bestSan} was more accurate.`;
}
