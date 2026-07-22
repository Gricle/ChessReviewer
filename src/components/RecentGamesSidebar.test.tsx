import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RecentGamesSidebar } from './RecentGamesSidebar';
import { hashString } from '../supabase/syncQueue';

vi.mock('../importers/chesscom', () => ({ fetchRecentGames: vi.fn() }));
vi.mock('../importers/lichess', () => ({ fetchRecentGames: vi.fn() }));

import { fetchRecentGames as fetchComGames } from '../importers/chesscom';
import { fetchRecentGames as fetchLiGames } from '../importers/lichess';

const comGame = {
  id: 'c1', url: 'https://chess.com/game/live/c1', white: 'GriCle', black: 'Rival',
  date: '2026-06-25', pgn: '[White "GriCle"]\n\n1. e4 *', playedAt: 2000,
};
const liGame = {
  id: 'l1', url: 'https://lichess.org/l1', white: 'gricle', black: 'Foe',
  date: '2026-06-20', pgn: '[White "gricle"]\n\n1. d4 *', playedAt: 1000,
};

function makeProps(overrides: Partial<Parameters<typeof RecentGamesSidebar>[0]> = {}) {
  return {
    chesscomUsername: 'gricle' as string | null,
    lichessUsername: null as string | null,
    reviewedIdByHash: new Map<string, string>(),
    onAnalyze: vi.fn(),
    onOpenSaved: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(fetchComGames).mockReset().mockResolvedValue([comGame]);
  vi.mocked(fetchLiGames).mockReset().mockResolvedValue([liGame]);
});

describe('RecentGamesSidebar', () => {
  it('prompts for a username when no account is linked', () => {
    render(<RecentGamesSidebar {...makeProps({ chesscomUsername: null })} />);
    expect(screen.getByText(/Add your chess\.com or lichess username/)).toBeTruthy();
    expect(fetchComGames).not.toHaveBeenCalled();
  });

  it('fetches and merges games from both linked accounts, newest first', async () => {
    render(<RecentGamesSidebar {...makeProps({ lichessUsername: 'gricle' })} />);
    await waitFor(() => expect(screen.getByText('GriCle vs Rival')).toBeTruthy());
    expect(screen.getByText('gricle vs Foe')).toBeTruthy();
    const names = screen.getAllByText(/vs/).map((el) => el.textContent);
    expect(names[0]).toContain('GriCle vs Rival'); // playedAt 2000 sorts first
  });

  it('starts analysis for an unreviewed game', async () => {
    const props = makeProps();
    render(<RecentGamesSidebar {...props} />);
    await waitFor(() => expect(screen.getByText('GriCle vs Rival')).toBeTruthy());
    fireEvent.click(screen.getByText('GriCle vs Rival'));
    expect(props.onAnalyze).toHaveBeenCalledWith(comGame.pgn, 'chesscom');
    expect(props.onOpenSaved).not.toHaveBeenCalled();
  });

  it('opens the saved review for an already-analyzed game', async () => {
    const props = makeProps({ reviewedIdByHash: new Map([[hashString(comGame.pgn), 'row-9']]) });
    render(<RecentGamesSidebar {...props} />);
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy());
    fireEvent.click(screen.getByText('GriCle vs Rival'));
    expect(props.onOpenSaved).toHaveBeenCalledWith('row-9');
    expect(props.onAnalyze).not.toHaveBeenCalled();
  });

  it('still lists one platform when the other fails', async () => {
    vi.mocked(fetchLiGames).mockRejectedValue(new Error('lichess.org: user "x" not found (404)'));
    render(<RecentGamesSidebar {...makeProps({ lichessUsername: 'x' })} />);
    await waitFor(() => expect(screen.getByText('GriCle vs Rival')).toBeTruthy());
    expect(screen.getByText(/not found/)).toBeTruthy();
  });

  it('shows the empty state when accounts have no games', async () => {
    vi.mocked(fetchComGames).mockResolvedValue([]);
    render(<RecentGamesSidebar {...makeProps()} />);
    await waitFor(() => expect(screen.getByText('No recent games found.')).toBeTruthy());
  });
});
