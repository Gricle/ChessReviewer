import type { AnalyzedPly } from '../chess/types';
import { forkTargets, isMateScore, isMatedScore, newlyHungPiece } from './motifs';
import i18n from '../i18n';

export interface ExplainCtx {
  bestSan: string; // SAN of ply.bestMoveUci at fenBefore
  nextBestSan: string | null; // opponent's best reply (SAN at fenAfter), null on last ply
}

const PIECE_KEYS: Record<'p' | 'n' | 'b' | 'r' | 'q', string> = {
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
    return i18n.t('coach:bookMove', { san });
  }

  // 2. Bad moves: lead with the better alternative, then explain why.
  if (BAD_CLASSES.has(classification)) {
    const lead = i18n.t('coach:betterWas', { bestSan: ctx.bestSan });
    let why = '';

    if (isMatedScore(evalAfterCp) && !isMatedScore(evalBeforeCp)) {
      // 2a
      why = i18n.t('coach:walksIntoMate');
    } else if (isMateScore(evalBeforeCp) && !isMateScore(evalAfterCp)) {
      // 2b
      why = i18n.t('coach:hadForcedMateSlip');
    } else {
      const newlyHung = newlyHungPiece(fenBefore, fenAfter, moverColor);

      if (newlyHung) {
        // 2c
        why = i18n.t('coach:leavesHanging', {
          piece: i18n.t(`coach:piece.${PIECE_KEYS[newlyHung.type]}`),
          square: newlyHung.square,
        });
      } else if (ctx.nextBestSan) {
        // 2d
        why = i18n.t('coach:threatNow', { nextBestSan: ctx.nextBestSan });
      } else if (classification === 'blunder') {
        // 2e
        why = i18n.t('coach:losesSignificantGround');
      } else if (classification === 'mistake') {
        // 2e
        why = i18n.t('coach:couldHaveBeenPunished');
      }
      // inaccuracy: no extra clause, lead sentence stands alone.
    }

    return why ? `${lead} ${why}` : lead;
  }

  // 3. Brilliant.
  if (classification === 'brilliant') {
    const forks = forkTargets(fenBefore, uci);
    if (forks.length >= 2) {
      return i18n.t('coach:brilliantFork', { san });
    }
    return i18n.t('coach:brilliant', { san });
  }

  // 4. Great.
  if (classification === 'great') {
    return i18n.t('coach:onlyGoodMove', { san });
  }

  // 5. best / excellent / good.
  if (uci === bestMoveUci && isMateScore(evalBeforeCp)) {
    // 5a
    return i18n.t('coach:keepsForcedMate', { san });
  }

  const forks = forkTargets(fenBefore, uci);
  if (forks.length >= 2) {
    // 5b
    return i18n.t('coach:forksPieces', { san, count: forks.length });
  }

  // 5c
  if (classification === 'best') {
    return i18n.t('coach:strongestMove', { san });
  }
  if (classification === 'excellent') {
    return i18n.t('coach:strongOnlyBetter', { san, bestSan: ctx.bestSan });
  }
  return i18n.t('coach:keepsBalance', { san, bestSan: ctx.bestSan });
}
