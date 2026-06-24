import type { Classification } from '../chess/types';
import { cpToWinPercent } from './winPercent';
import {
  WIN_DROP, GREAT_GAP_CP, GREAT_MIN_WIN, GREAT_MAX_WIN,
  BRILLIANT_MIN_SAC, BRILLIANT_MIN_WIN_AFTER, BRILLIANT_MAX_DROP,
} from './thresholds';

export interface ClassifyInput {
  isBook: boolean;
  playedUci: string;
  bestUci: string;
  evalBeforeCp: number;             // mover perspective
  evalAfterCp: number;              // mover perspective
  secondBestEvalCp: number | null;  // mover perspective at fenBefore
  materialSacrificed: number;       // pawns net given up after best reply
}

export function classify(i: ClassifyInput): Classification {
  if (i.isBook) return 'book';

  const winBefore = cpToWinPercent(i.evalBeforeCp);
  const winAfter = cpToWinPercent(i.evalAfterCp);
  const drop = winBefore - winAfter;
  const playedBest = i.playedUci === i.bestUci;

  if (
    i.materialSacrificed >= BRILLIANT_MIN_SAC &&
    winAfter >= BRILLIANT_MIN_WIN_AFTER &&
    drop <= BRILLIANT_MAX_DROP
  ) {
    return 'brilliant';
  }

  if (playedBest && i.secondBestEvalCp !== null) {
    const gap = i.evalBeforeCp - i.secondBestEvalCp;
    if (gap >= GREAT_GAP_CP && winBefore >= GREAT_MIN_WIN && winBefore <= GREAT_MAX_WIN) {
      return 'great';
    }
  }

  if (playedBest || drop < WIN_DROP.best) return 'best';
  if (drop < WIN_DROP.excellent) return 'excellent';
  if (drop < WIN_DROP.good) return 'good';
  if (drop < WIN_DROP.inaccuracy) return 'inaccuracy';
  if (drop < WIN_DROP.mistake) return 'mistake';
  return 'blunder';
}
