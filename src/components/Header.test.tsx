import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

function makeProps(overrides: Partial<Parameters<typeof Header>[0]> = {}) {
  return {
    activeTab: 'import' as const,
    onSelectTab: vi.fn(),
    hasActiveReview: false,
    authEnabled: true,
    userEmail: null as string | null,
    onOpenAuth: vi.fn(),
    ...overrides,
  };
}

describe('Header', () => {
  it('hides the review tab without an active review', () => {
    render(<Header {...makeProps()} />);
    expect(screen.queryByText('Active Review')).toBeNull();
    expect(screen.getByText('New Import')).toBeTruthy();
    expect(screen.getByText('Library & Trends')).toBeTruthy();
  });

  it('shows the review tab with an active review', () => {
    render(<Header {...makeProps({ hasActiveReview: true })} />);
    expect(screen.getByText('Active Review')).toBeTruthy();
  });

  it('shows Guest Mode when signed out and email when signed in', () => {
    const { rerender } = render(<Header {...makeProps()} />);
    expect(screen.getByText('Guest Mode')).toBeTruthy();
    rerender(<Header {...makeProps({ userEmail: 'a@b.c' })} />);
    expect(screen.getByText('a@b.c')).toBeTruthy();
  });

  it('hides the auth button when auth is disabled', () => {
    render(<Header {...makeProps({ authEnabled: false })} />);
    expect(screen.queryByText('Guest Mode')).toBeNull();
  });

  it('calls onSelectTab with the tab id when a tab pill is clicked', () => {
    const props = makeProps({ hasActiveReview: true });
    render(<Header {...props} />);
    fireEvent.click(screen.getByText('Library & Trends'));
    expect(props.onSelectTab).toHaveBeenCalledWith('library');
    fireEvent.click(screen.getByText('Active Review'));
    expect(props.onSelectTab).toHaveBeenCalledWith('review');
  });

  it('calls onOpenAuth when the auth button is clicked', () => {
    const props = makeProps();
    render(<Header {...props} />);
    fireEvent.click(screen.getByText('Guest Mode'));
    expect(props.onOpenAuth).toHaveBeenCalledTimes(1);
  });
});
