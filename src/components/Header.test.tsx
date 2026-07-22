import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

const base = {
  activeTab: 'import' as const,
  onSelectTab: vi.fn(),
  hasActiveReview: false,
  authEnabled: true,
  userEmail: null as string | null,
  onOpenAuth: vi.fn(),
};

describe('Header', () => {
  it('hides the review tab without an active review', () => {
    render(<Header {...base} />);
    expect(screen.queryByText('Active Review')).toBeNull();
    expect(screen.getByText('New Import')).toBeTruthy();
    expect(screen.getByText('Library & Trends')).toBeTruthy();
  });

  it('shows the review tab with an active review', () => {
    render(<Header {...base} hasActiveReview />);
    expect(screen.getByText('Active Review')).toBeTruthy();
  });

  it('shows Guest Mode when signed out and email when signed in', () => {
    const { rerender } = render(<Header {...base} />);
    expect(screen.getByText('Guest Mode')).toBeTruthy();
    rerender(<Header {...base} userEmail="a@b.c" />);
    expect(screen.getByText('a@b.c')).toBeTruthy();
  });

  it('hides the auth button when auth is disabled', () => {
    render(<Header {...base} authEnabled={false} />);
    expect(screen.queryByText('Guest Mode')).toBeNull();
  });
});
