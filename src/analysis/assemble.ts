import { Chess } from 'chess.js';
import type {
  AnalyzedPly, Classification, ParsedGame, PositionAnalysis, ReviewSummary,
} from '../chess/types';
import { classify } from './classifier';
import { moveAccuracy, gameAccuracy } from './accuracy';
import { cpToWinPercent } from './winPercent';
import { materialBalance } from '../chess/material';
import { detectOpening, type Opening } from './openingDetector';

const ALL_LABELS: Classification[] = [
  'book', 'brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder',
];

export interface Review {
  plies: AnalyzedPly[];
  summary: ReviewSummary;
}

export function assembleReview(
  game: ParsedGame,
  analyses: Map<string, PositionAnalysis>,
  book: Opening[],
): Review {
  const gameUci = game.plies.map((p) => p.uci);
  const { opening, bookPlies } = detectOpening(gameUci, book);

  const plies: AnalyzedPly[] = game.plies.map((ply) => {
    const before = analyses.get(ply.fenBefore)!;
    const after = analyses.get(ply.fenAfter);

    const evalBeforeCp = before.bestEvalCp;                       // mover perspective
    const evalAfterCp = after ? -after.bestEvalCp : evalBeforeCp; // mover perspective

    // Material sacrificed: compare mover-perspective material at fenBefore vs the
    // position two plies later (after the opponent's best reply). Both have the
    // mover to move, so materialBalance is directly comparable.
    let materialSacrificed = 0;
    if (after) {
      try {
        const board = new Chess(ply.fenAfter);
        board.move({
          from: after.bestMoveUci.slice(0, 2),
          to: after.bestMoveUci.slice(2, 4),
          promotion: after.bestMoveUci.slice(4) || undefined,
        });
        materialSacrificed = materialBalance(ply.fenBefore) - materialBalance(board.fen());
      } catch {
        materialSacrificed = 0;
      }
    }

    const classification = classify({
      isBook: ply.index < bookPlies,
      playedUci: ply.uci,
      bestUci: before.bestMoveUci,
      evalBeforeCp,
      evalAfterCp,
      secondBestEvalCp: before.secondBestEvalCp,
      materialSacrificed,
    });

    const accuracy = moveAccuracy(cpToWinPercent(evalBeforeCp), cpToWinPercent(evalAfterCp));

    return { ...ply, bestMoveUci: before.bestMoveUci, evalBeforeCp, evalAfterCp, classification, accuracy };
  });

  const counts = Object.fromEntries(
    ALL_LABELS.map((l) => [l, { white: 0, black: 0 }]),
  ) as ReviewSummary['counts'];
  for (const p of plies) counts[p.classification][p.color] += 1;

  const whiteAcc = gameAccuracy(plies.filter((p) => p.color === 'white').map((p) => p.accuracy));
  const blackAcc = gameAccuracy(plies.filter((p) => p.color === 'black').map((p) => p.accuracy));

  return {
    plies,
    summary: {
      opening: opening ? { eco: opening.eco, name: opening.name } : null,
      whiteAccuracy: whiteAcc,
      blackAccuracy: blackAcc,
      counts,
    },
  };
}
