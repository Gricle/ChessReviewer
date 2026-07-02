import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { RevealOverlay } from './RevealOverlay';
import { parsePgn } from '../chess/pgnParser';
import { assembleReview } from '../analysis/assemble';
import { OPENINGS } from '../data/openings.sample';
import type { ParsedGame, PositionAnalysis } from '../chess/types';
import { STAGE_MS } from './revealStages';

function flatAnalyses(g: ParsedGame): Map<string, PositionAnalysis> {
  const m = new Map<string, PositionAnalysis>();
  const add = (fen: string, bestUci: string) =>
    m.set(fen, { fen, bestMoveUci: bestUci, bestEvalCp: 0, secondBestEvalCp: 0, mate: null });
  g.plies.forEach((p) => add(p.fenBefore, p.uci));
  add(g.plies[g.plies.length - 1].fenAfter, 'a2a3');
  return m;
}

const game = parsePgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 *');
const review = assembleReview(game, flatAnalyses(game), OPENINGS);

function renderOverlay(onClose = vi.fn()) {
  render(
    <RevealOverlay
      summary={review.summary}
      white="Hikaru"
      black="Magnus"
      ratings={{ white: 2802, black: 2839 }}
      soundOn={false}
      onClose={onClose}
    />,
  );
  return onClose;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('RevealOverlay', () => {
  it('advances through the stages on the timeline', () => {
    renderOverlay();
    expect(screen.getByText('Game Review')).toBeTruthy();
    // ratings cards not yet visible as "in"
    act(() => { vi.advanceTimersByTime(STAGE_MS.enter + STAGE_MS.accuracy + STAGE_MS.ratings + STAGE_MS.badges + 50); });
    // done stage: start button present
    expect(screen.getByRole('button', { name: /start review/i })).toBeTruthy();
  });

  it('skips to done on click, then closes on second click', () => {
    const onClose = renderOverlay();
    const overlay = document.querySelector('.reveal-overlay')!;
    fireEvent.click(overlay);              // skip animation
    expect(screen.getByRole('button', { name: /start review/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /start review/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows both players, accuracies and estimated ratings by the done stage', () => {
    renderOverlay();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('Hikaru')).toBeTruthy();
    expect(screen.getByText('Magnus')).toBeTruthy();
    expect(screen.getAllByText(/~\d+/)).toHaveLength(2);
  });
});
