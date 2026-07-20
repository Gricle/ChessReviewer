import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TrendsDashboard } from './TrendsDashboard';
import type { TrendFilter } from '../reports/aggregate';

const filter: TrendFilter = { color: 'all', range: 'all' };
const noop = () => {};

describe('TrendsDashboard', () => {
  it('shows the empty-state message under 3 games', () => {
    render(
      <TrendsDashboard
        stats={{ avgAccuracy: { value: 80, delta: null }, estRating: { value: 1400, delta: null }, winRate: null, blundersPerGame: { value: 0, delta: null } }}
        series={[{ date: '2026-01-01', accuracy: 80, estRating: 1400, result: 'win' }]}
        blunders={[{ date: '2026-01-01', blunders: 0 }]}
        filter={filter}
        onFilterChange={noop}
      />,
    );
    expect(screen.getByText(/analyze more games/i)).toBeTruthy();
  });

  it('renders the four stat tiles with values', () => {
    const series = Array.from({ length: 4 }, (_, i) => ({ date: `2026-01-0${i + 1}`, accuracy: 70 + i, estRating: 1400, result: 'win' as const }));
    render(
      <TrendsDashboard
        stats={{ avgAccuracy: { value: 72, delta: 3 }, estRating: { value: 1420, delta: 20 }, winRate: { value: 60, delta: -5 }, blundersPerGame: { value: 1.5, delta: -0.4 } }}
        series={series}
        blunders={series.map((s) => ({ date: s.date, blunders: 1 }))}
        filter={filter}
        onFilterChange={noop}
      />,
    );
    expect(screen.getByText('avg accuracy')).toBeTruthy();
    expect(screen.getByText('win rate')).toBeTruthy();
    expect(screen.getByText('blunders / game')).toBeTruthy();
  });
});
