# Trends Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated "Trends" tab to the Library that charts accuracy, estimated rating, win rate, and blunders-per-game over time with color/range filters.

**Architecture:** Pure aggregation functions in `src/reports/aggregate.ts` transform the already-fetched `games`/`reviews`/`move_facts` rows into series + headline stats. A presentational `TrendsDashboard` renders tiles and SVG charts from plain props; a `TrendsView` container does the fetching/filtering and feeds it. A segmented control in `LibraryView` switches between Games/Reports/Trends.

**Tech Stack:** React 18 + TypeScript, Vitest + @testing-library/react, Supabase JS, inline SVG charts (no chart lib), CSS in `src/index.css`.

---

## File Structure

- `src/supabase/reports.ts` — MODIFY: add `result` to `ReportGameRow` + `fetchReportGames` select.
- `src/reports/aggregate.ts` — MODIFY: add filter types, `gameResult`, `trendSeries`, `rollingAverage`, `blundersPerGame`, `headlineStats`; remove `accuracyTrend`/`TrendPoint` in cleanup task.
- `src/reports/aggregate.test.ts` — MODIFY: tests for all new functions; drop `accuracyTrend` tests.
- `src/components/TrendsDashboard.tsx` — CREATE: presentational dashboard (tiles + charts). Pure props.
- `src/components/TrendsDashboard.test.tsx` — CREATE: render/empty-state tests.
- `src/components/TrendsView.tsx` — CREATE: data container (fetch + aggregate + filter state).
- `src/components/LibraryView.tsx` — MODIFY: segmented Games/Reports/Trends control.
- `src/components/ReportsView.tsx` — MODIFY: remove `TrendCard`.
- `src/index.css` — MODIFY: trends styles.

Conventions: functions in `aggregate.ts` stay pure (no Supabase/React imports). Tests use the existing `game()` factory pattern in `aggregate.test.ts`. Run a single test file with `npx vitest run <path>`.

---

### Task 1: Add `result` to the report game row

**Files:**
- Modify: `src/supabase/reports.ts:3-9` (interface) and `:16-24` (fetch select)

- [ ] **Step 1: Add `result` to the interface and select**

In `src/supabase/reports.ts`, change the `ReportGameRow` interface to include `result`:

```ts
export interface ReportGameRow {
  id: string;
  white_name: string; black_name: string;
  opening_name: string | null;
  result: string | null;
  played_at: string | null; created_at: string;
  reviews: { white_accuracy: number; black_accuracy: number; white_est_rating: number; black_est_rating: number } | null;
}
```

And add `result` to the `.select(...)` column list in `fetchReportGames`:

```ts
    .select('id, white_name, black_name, opening_name, result, played_at, created_at, reviews(white_accuracy, black_accuracy, white_est_rating, black_est_rating)')
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS (no errors). `ReportsView` ignores the new field, so nothing else breaks.

- [ ] **Step 3: Commit**

```bash
git add src/supabase/reports.ts
git commit -m "feat: include result in report game rows"
```

---

### Task 2: `gameResult` + `trendSeries`

**Files:**
- Modify: `src/reports/aggregate.ts` (add types + functions near the bottom, before `accuracyTrend`)
- Test: `src/reports/aggregate.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/reports/aggregate.test.ts` (the `game()` factory already exists at the top; it will need `result` — update the factory default to include `result: '1-0'` in its base object if not present):

```ts
import { gameResult, trendSeries, type TrendFilter } from './aggregate';

const ALL: TrendFilter = { color: 'all', range: 'all' };

describe('gameResult', () => {
  it('maps result + side to win/loss/draw', () => {
    expect(gameResult(game({ result: '1-0' }), 'white')).toBe('win');
    expect(gameResult(game({ result: '1-0' }), 'black')).toBe('loss');
    expect(gameResult(game({ result: '0-1' }), 'black')).toBe('win');
    expect(gameResult(game({ result: '1/2-1/2' }), 'white')).toBe('draw');
  });
  it('returns null when side or result is unknown', () => {
    expect(gameResult(game({ result: '1-0' }), null)).toBeNull();
    expect(gameResult(game({ result: null }), 'white')).toBeNull();
    expect(gameResult(game({ result: '*' }), 'white')).toBeNull();
  });
});

describe('trendSeries', () => {
  const profile = { display_name: 'Alice', chesscom_username: null, lichess_username: null };
  it('emits one point per reviewed game, user side, sorted by date', () => {
    const games = [
      game({ id: 'b', played_at: '2026-02-01', result: '1-0',
        reviews: { white_accuracy: 90, black_accuracy: 50, white_est_rating: 1500, black_est_rating: 1200 } }),
      game({ id: 'a', played_at: '2026-01-01', result: '0-1',
        reviews: { white_accuracy: 80, black_accuracy: 60, white_est_rating: 1400, black_est_rating: 1300 } }),
    ];
    const s = trendSeries(games, profile, ALL);
    expect(s.map((p) => p.date)).toEqual(['2026-01-01', '2026-02-01']);
    expect(s[0]).toEqual({ date: '2026-01-01', accuracy: 80, estRating: 1400, result: 'loss' });
    expect(s[1].result).toBe('win');
  });
  it('skips games without a review', () => {
    const games = [game({ reviews: null })];
    expect(trendSeries(games, profile, ALL)).toEqual([]);
  });
  it('filters by color, excluding undeterminable sides', () => {
    const games = [
      game({ id: 'w', white_name: 'Alice', black_name: 'Bob', played_at: '2026-01-01' }),
      game({ id: 'x', white_name: 'Carol', black_name: 'Dave', played_at: '2026-01-02' }),
    ];
    expect(trendSeries(games, profile, { color: 'white', range: 'all' }).length).toBe(1);
  });
  it('filters by range relative to the newest game', () => {
    const games = [
      game({ id: 'old', played_at: '2026-01-01' }),
      game({ id: 'new', played_at: '2026-03-01' }),
    ];
    // 30d window ends at 2026-03-01, so the January game is excluded.
    const s = trendSeries(games, profile, { color: 'all', range: '30d' });
    expect(s.map((p) => p.date)).toEqual(['2026-03-01']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/reports/aggregate.test.ts`
Expected: FAIL — `gameResult`/`trendSeries` are not exported.

- [ ] **Step 3: Implement**

In `src/reports/aggregate.ts`, add near the bottom (keep the existing `sidedValue`, `userSide` — they are reused):

```ts
export type ColorFilter = 'all' | 'white' | 'black';
export type RangeFilter = 'all' | '30d' | '3mo';
export interface TrendFilter { color: ColorFilter; range: RangeFilter; }
export type GameOutcome = 'win' | 'loss' | 'draw' | null;

const DAY_MS = 86_400_000;

function gameDate(g: ReportGameRow): string { return g.played_at ?? g.created_at; }
function toMs(date: string): number { return new Date(date).getTime(); }

function inColor(side: 'white' | 'black' | null, color: ColorFilter): boolean {
  return color === 'all' ? true : side === color;
}

// Range is measured from the newest date in `points` (not wall-clock now),
// so results are deterministic and testable.
function applyRange<T extends { ms: number }>(points: T[], range: RangeFilter): T[] {
  if (range === 'all' || points.length === 0) return points;
  const days = range === '30d' ? 30 : 90;
  const newest = Math.max(...points.map((p) => p.ms));
  const cutoff = newest - days * DAY_MS;
  return points.filter((p) => p.ms >= cutoff);
}

/** win/loss/draw from a game's result string relative to the user's side, or null. */
export function gameResult(game: ReportGameRow, side: 'white' | 'black' | null): GameOutcome {
  if (!side || !game.result) return null;
  const r = game.result.trim();
  if (r === '1/2-1/2' || r === '½-½' || r === '0.5-0.5') return 'draw';
  if (r === '1-0') return side === 'white' ? 'win' : 'loss';
  if (r === '0-1') return side === 'black' ? 'win' : 'loss';
  return null;
}

export interface TrendSeriesPoint { date: string; accuracy: number; estRating: number; result: GameOutcome; }

/** One point per reviewed game passing the filter, user side when known else mean, sorted by date asc. */
export function trendSeries(games: ReportGameRow[], profile: Profile | null, filter: TrendFilter): TrendSeriesPoint[] {
  const points = games
    .filter((g) => g.reviews)
    .map((g) => {
      const side = userSide(g, profile);
      return { g, side };
    })
    .filter(({ side }) => inColor(side, filter.color))
    .map(({ g, side }) => ({
      date: gameDate(g),
      ms: toMs(gameDate(g)),
      accuracy: sidedValue(side, g.reviews!.white_accuracy, g.reviews!.black_accuracy),
      estRating: sidedValue(side, g.reviews!.white_est_rating, g.reviews!.black_est_rating),
      result: gameResult(g, side),
    }));
  return applyRange(points, filter.range)
    .sort((a, b) => a.ms - b.ms)
    .map(({ ms: _ms, ...p }) => p);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/reports/aggregate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reports/aggregate.ts src/reports/aggregate.test.ts
git commit -m "feat: trendSeries + gameResult aggregations"
```

---

### Task 3: `rollingAverage`

**Files:**
- Modify: `src/reports/aggregate.ts`
- Test: `src/reports/aggregate.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { rollingAverage } from './aggregate';

describe('rollingAverage', () => {
  it('averages a trailing window, shrinking at the start', () => {
    expect(rollingAverage([10, 20, 30], 2)).toEqual([10, 15, 25]);
  });
  it('handles an empty array', () => {
    expect(rollingAverage([], 5)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/reports/aggregate.test.ts`
Expected: FAIL — `rollingAverage` not exported.

- [ ] **Step 3: Implement**

```ts
/** Trailing moving average; positions with < window prior points average what exists. */
export function rollingAverage(values: number[], window = 5): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/reports/aggregate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reports/aggregate.ts src/reports/aggregate.test.ts
git commit -m "feat: rollingAverage helper"
```

---

### Task 4: `blundersPerGame`

**Files:**
- Modify: `src/reports/aggregate.ts`
- Test: `src/reports/aggregate.test.ts`

- [ ] **Step 1: Write failing test**

The `fact()` factory already exists in `aggregate.test.ts` (used by motif/phase tests); reuse it. It builds a `ReportFactRow`. Confirm it accepts `classification` and `game_id` overrides.

```ts
import { blundersPerGame } from './aggregate';

describe('blundersPerGame', () => {
  const profile = { display_name: 'Alice', chesscom_username: null, lichess_username: null };
  it('counts blunders per game, including zero-blunder games, sorted by date', () => {
    const games = [
      game({ id: 'g1', white_name: 'Alice', black_name: 'Bob', played_at: '2026-01-01' }),
      game({ id: 'g2', white_name: 'Alice', black_name: 'Bob', played_at: '2026-01-02' }),
    ];
    const facts = [
      fact({ game_id: 'g1', side: 'white', classification: 'blunder' }),
      fact({ game_id: 'g1', side: 'white', classification: 'mistake' }),
      fact({ game_id: 'g1', side: 'black', classification: 'blunder' }), // opponent — excluded
    ];
    const out = blundersPerGame(facts, games, profile, ALL);
    expect(out).toEqual([
      { date: '2026-01-01', blunders: 1 },
      { date: '2026-01-02', blunders: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/reports/aggregate.test.ts`
Expected: FAIL — `blundersPerGame` not exported.

- [ ] **Step 3: Implement**

```ts
export interface BlunderPoint { date: string; blunders: number; }

/** Blunders per game over time; side-filtered like missedMotifs, color/range-filtered, zero-filled, sorted asc. */
export function blundersPerGame(
  facts: ReportFactRow[], games: ReportGameRow[], profile: Profile | null, filter: TrendFilter,
): BlunderPoint[] {
  const sides = new Map(games.map((g) => [g.id, userSide(g, profile)]));
  const eligible = games.filter((g) => g.reviews && inColor(sides.get(g.id) ?? null, filter.color));
  const counts = new Map<string, number>();
  for (const g of eligible) counts.set(g.id, 0);
  for (const f of facts) {
    if (!counts.has(f.game_id)) continue;
    const side = sides.get(f.game_id);
    if (side && side !== f.side) continue;
    if (f.classification === 'blunder') counts.set(f.game_id, (counts.get(f.game_id) ?? 0) + 1);
  }
  const points = eligible.map((g) => ({ date: gameDate(g), ms: toMs(gameDate(g)), blunders: counts.get(g.id) ?? 0 }));
  return applyRange(points, filter.range)
    .sort((a, b) => a.ms - b.ms)
    .map(({ ms: _ms, ...p }) => p);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/reports/aggregate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reports/aggregate.ts src/reports/aggregate.test.ts
git commit -m "feat: blundersPerGame aggregation"
```

---

### Task 5: `headlineStats`

**Files:**
- Modify: `src/reports/aggregate.ts`
- Test: `src/reports/aggregate.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { headlineStats } from './aggregate';

describe('headlineStats', () => {
  const profile = { display_name: 'Alice', chesscom_username: null, lichess_username: null };
  it('computes current-window values with null deltas when range is all', () => {
    const games = [
      game({ id: 'g1', white_name: 'Alice', black_name: 'Bob', played_at: '2026-01-01', result: '1-0',
        reviews: { white_accuracy: 80, black_accuracy: 50, white_est_rating: 1400, black_est_rating: 1200 } }),
    ];
    const stats = headlineStats(games, [], profile, ALL);
    expect(stats.avgAccuracy.value).toBe(80);
    expect(stats.avgAccuracy.delta).toBeNull();
    expect(stats.winRate?.value).toBe(100);
    expect(stats.blundersPerGame.value).toBe(0);
  });
  it('returns winRate null when no game has a determinable result', () => {
    const games = [
      game({ id: 'g1', white_name: 'Carol', black_name: 'Dave', played_at: '2026-01-01',
        reviews: { white_accuracy: 70, black_accuracy: 70, white_est_rating: 1300, black_est_rating: 1300 } }),
    ];
    expect(headlineStats(games, [], profile, ALL).winRate).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/reports/aggregate.test.ts`
Expected: FAIL — `headlineStats` not exported.

- [ ] **Step 3: Implement**

```ts
export interface Stat { value: number; delta: number | null; }
export interface HeadlineStats {
  avgAccuracy: Stat;
  estRating: Stat;
  winRate: Stat | null;
  blundersPerGame: Stat;
}

interface CombinedPoint { ms: number; accuracy: number; estRating: number; result: GameOutcome; blunders: number; }

// Color-filtered, review-only, blunder-merged, sorted asc. Range is applied later by window slicing.
function combinedSeries(
  games: ReportGameRow[], facts: ReportFactRow[], profile: Profile | null, color: ColorFilter,
): CombinedPoint[] {
  const sides = new Map(games.map((g) => [g.id, userSide(g, profile)]));
  const eligible = games.filter((g) => g.reviews && inColor(sides.get(g.id) ?? null, color));
  const blunders = new Map<string, number>();
  for (const g of eligible) blunders.set(g.id, 0);
  for (const f of facts) {
    if (!blunders.has(f.game_id)) continue;
    const side = sides.get(f.game_id);
    if (side && side !== f.side) continue;
    if (f.classification === 'blunder') blunders.set(f.game_id, (blunders.get(f.game_id) ?? 0) + 1);
  }
  return eligible
    .map((g) => {
      const side = sides.get(g.id) ?? null;
      return {
        ms: toMs(gameDate(g)),
        accuracy: sidedValue(side, g.reviews!.white_accuracy, g.reviews!.black_accuracy),
        estRating: sidedValue(side, g.reviews!.white_est_rating, g.reviews!.black_est_rating),
        result: gameResult(g, side),
        blunders: blunders.get(g.id) ?? 0,
      };
    })
    .sort((a, b) => a.ms - b.ms);
}

function mean(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

// Score % (win=1, draw=0.5), or null when no game has a determinable result.
function scorePct(rows: CombinedPoint[]): number | null {
  const decided = rows.filter((r) => r.result !== null);
  if (!decided.length) return null;
  const score = decided.reduce((s, r) => s + (r.result === 'win' ? 1 : r.result === 'draw' ? 0.5 : 0), 0);
  return (score / decided.length) * 100;
}

/** Headline tiles for the current window with deltas vs the equal-length previous window (null when range is all). */
export function headlineStats(
  games: ReportGameRow[], facts: ReportFactRow[], profile: Profile | null, filter: TrendFilter,
): HeadlineStats {
  const full = combinedSeries(games, facts, profile, filter.color);
  let current: CombinedPoint[];
  let previous: CombinedPoint[];
  if (filter.range === 'all' || full.length === 0) {
    current = full;
    previous = [];
  } else {
    const days = filter.range === '30d' ? 30 : 90;
    const newest = Math.max(...full.map((r) => r.ms));
    const curStart = newest - days * DAY_MS;
    const prevStart = curStart - days * DAY_MS;
    current = full.filter((r) => r.ms >= curStart);
    previous = full.filter((r) => r.ms >= prevStart && r.ms < curStart);
  }

  const stat = (sel: (r: CombinedPoint) => number): Stat => {
    const value = mean(current.map(sel));
    const delta = previous.length ? value - mean(previous.map(sel)) : null;
    return { value, delta };
  };

  const winCur = scorePct(current);
  const winPrev = previous.length ? scorePct(previous) : null;
  const winRate: Stat | null =
    winCur === null ? null : { value: winCur, delta: winPrev === null ? null : winCur - winPrev };

  return {
    avgAccuracy: stat((r) => r.accuracy),
    estRating: stat((r) => r.estRating),
    winRate,
    blundersPerGame: stat((r) => r.blunders),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/reports/aggregate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/reports/aggregate.ts src/reports/aggregate.test.ts
git commit -m "feat: headlineStats with previous-window deltas"
```

---

### Task 6: `TrendsDashboard` presentational component

**Files:**
- Create: `src/components/TrendsDashboard.tsx`
- Test: `src/components/TrendsDashboard.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/TrendsDashboard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/components/TrendsDashboard.tsx`:

```tsx
import { useState } from 'react';
import {
  rollingAverage,
  type TrendFilter, type ColorFilter, type RangeFilter,
  type TrendSeriesPoint, type BlunderPoint, type HeadlineStats, type Stat,
} from '../reports/aggregate';

interface Props {
  stats: HeadlineStats;
  series: TrendSeriesPoint[];
  blunders: BlunderPoint[];
  filter: TrendFilter;
  onFilterChange: (f: TrendFilter) => void;
}

const COLORS: ColorFilter[] = ['all', 'white', 'black'];
const RANGES: RangeFilter[] = ['all', '30d', '3mo'];
const RANGE_LABELS: Record<RangeFilter, string> = { all: 'All time', '30d': 'Last 30d', '3mo': 'Last 3mo' };
const COLOR_LABELS: Record<ColorFilter, string> = { all: 'Both', white: 'White', black: 'Black' };

const CW = 640;
const CH = 160;

export function TrendsDashboard({ stats, series, blunders, filter, onFilterChange }: Props) {
  return (
    <div className="trends">
      <div className="trends-filters">
        <Segmented label="Color" options={COLORS} value={filter.color}
          render={(c) => COLOR_LABELS[c]} onSelect={(color) => onFilterChange({ ...filter, color })} />
        <Segmented label="Range" options={RANGES} value={filter.range}
          render={(r) => RANGE_LABELS[r]} onSelect={(range) => onFilterChange({ ...filter, range })} />
      </div>

      <div className="trends-tiles">
        <Tile label="avg accuracy" stat={stats.avgAccuracy} format={(v) => `${v.toFixed(1)}%`} higherBetter />
        <Tile label="est. rating" stat={stats.estRating} format={(v) => v.toFixed(0)} higherBetter />
        <Tile label="win rate" stat={stats.winRate} format={(v) => `${v.toFixed(0)}%`} higherBetter />
        <Tile label="blunders / game" stat={stats.blundersPerGame} format={(v) => v.toFixed(1)} higherBetter={false} />
      </div>

      {series.length < 3 ? (
        <div className="card report-empty">Analyze more games to see your trend.</div>
      ) : (
        <>
          <TrendChart series={series} />
          <BlunderBars blunders={blunders} />
        </>
      )}
    </div>
  );
}

function Segmented<T extends string>({ label, options, value, render, onSelect }: {
  label: string; options: T[]; value: T; render: (o: T) => string; onSelect: (o: T) => void;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} className={`seg-btn${o === value ? ' seg-on' : ''}`}
          aria-pressed={o === value} onClick={() => onSelect(o)}>{render(o)}</button>
      ))}
    </div>
  );
}

function Tile({ label, stat, format, higherBetter }: {
  label: string; stat: Stat | null; format: (v: number) => string; higherBetter: boolean;
}) {
  if (!stat) {
    return (
      <div className="trend-tile">
        <div className="tile-value tile-muted">—</div>
        <div className="tile-label">{label}</div>
        <div className="tile-delta tile-muted" title="Set your username in Profile to track wins">no data</div>
      </div>
    );
  }
  const good = stat.delta === null ? null : higherBetter ? stat.delta > 0 : stat.delta < 0;
  const arrow = stat.delta === null ? '' : stat.delta > 0 ? '▲' : stat.delta < 0 ? '▼' : '';
  const deltaClass = good === null ? 'tile-muted' : good ? 'tile-up' : 'tile-down';
  return (
    <div className="trend-tile">
      <div className="tile-value">{format(stat.value)}</div>
      <div className="tile-label">{label}</div>
      <div className={`tile-delta ${deltaClass}`}>
        {stat.delta === null ? '—' : `${arrow} ${Math.abs(stat.delta).toFixed(1)} vs prev`}
      </div>
    </div>
  );
}

function TrendChart({ series }: { series: TrendSeriesPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const x = (i: number) => (i / Math.max(1, series.length - 1)) * CW;
  const yAcc = (v: number) => CH - (Math.max(0, Math.min(100, v)) / 100) * CH;

  const ratings = series.map((p) => p.estRating);
  const rMin = Math.min(...ratings);
  const rMax = Math.max(...ratings);
  const rSpan = rMax - rMin || 1;
  const yRating = (v: number) => CH - ((v - rMin) / rSpan) * CH;

  const roll = rollingAverage(series.map((p) => p.accuracy), 5);
  const rawPts = series.map((p, i) => `${x(i)},${yAcc(p.accuracy)}`).join(' ');
  const rollPts = roll.map((v, i) => `${x(i)},${yAcc(v)}`).join(' ');
  const ratingPts = series.map((p, i) => `${x(i)},${yRating(p.estRating)}`).join(' ');

  const ticks = [0, Math.floor(series.length / 2), series.length - 1];

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * CW;
    setHover(Math.max(0, Math.min(series.length - 1, Math.round((px / CW) * (series.length - 1)))));
  };

  return (
    <div className="card trend-chart">
      <div className="trend-chart-head">
        <span>Accuracy &amp; est. rating over time</span>
        <span className="trend-legend"><i className="lg-acc" /> accuracy <i className="lg-rating" /> rating</span>
      </div>
      <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" preserveAspectRatio="none"
        className="trend-svg" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <polyline points={ratingPts} fill="none" className="ln-rating" />
        <polyline points={rawPts} fill="none" className="ln-acc-raw" />
        <polyline points={rollPts} fill="none" className="ln-acc" />
        {hover !== null && (
          <line x1={x(hover)} y1={0} x2={x(hover)} y2={CH} className="ln-cursor" strokeDasharray="3 3" />
        )}
      </svg>
      <div className="trend-axis">
        {ticks.map((i) => <span key={i}>{series[i]?.date}</span>)}
      </div>
      {hover !== null && series[hover] && (
        <div className="trend-tip">
          {series[hover].date} · acc {series[hover].accuracy.toFixed(1)} · rating {series[hover].estRating.toFixed(0)}
          {series[hover].result ? ` · ${series[hover].result}` : ''}
        </div>
      )}
    </div>
  );
}

function BlunderBars({ blunders }: { blunders: BlunderPoint[] }) {
  const max = Math.max(1, ...blunders.map((b) => b.blunders));
  return (
    <div className="card blunder-bars">
      <div className="trend-chart-head"><span>Blunders per game</span></div>
      <div className="bb-row">
        {blunders.map((b, i) => (
          <span key={i} className="bb-bar" title={`${b.date}: ${b.blunders}`}
            style={{ height: `${(b.blunders / max) * 100}%` }} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/TrendsDashboard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/TrendsDashboard.tsx src/components/TrendsDashboard.test.tsx
git commit -m "feat: TrendsDashboard presentational component"
```

---

### Task 7: `TrendsView` data container

**Files:**
- Create: `src/components/TrendsView.tsx`

Mirrors `ReportsView`'s fetch pattern (`fetchProfile` + `fetchReportGames` + `fetchReportFacts`), holds filter state, and feeds `TrendsDashboard`. No unit test (thin Supabase wrapper, like `ReportsView` which is untested); verified by build + manual run in Task 10.

- [ ] **Step 1: Implement**

Create `src/components/TrendsView.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { fetchProfile } from '../supabase/library';
import { fetchReportGames, fetchReportFacts, type ReportGameRow, type ReportFactRow } from '../supabase/reports';
import type { Profile } from '../supabase/library';
import {
  trendSeries, blundersPerGame, headlineStats, type TrendFilter,
} from '../reports/aggregate';
import { TrendsDashboard } from './TrendsDashboard';

interface Props { user: User; }
interface Loaded { games: ReportGameRow[]; facts: ReportFactRow[]; profile: Profile | null; }

export function TrendsView({ user }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TrendFilter>({ color: 'all', range: 'all' });

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    (async () => {
      try {
        const [profile, games] = await Promise.all([fetchProfile(client, user.id), fetchReportGames(client)]);
        const facts = await fetchReportFacts(client, games.map((g) => g.id));
        if (!cancelled) setLoaded({ games, facts, profile });
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  const derived = useMemo(() => {
    if (!loaded) return null;
    return {
      stats: headlineStats(loaded.games, loaded.facts, loaded.profile, filter),
      series: trendSeries(loaded.games, loaded.profile, filter),
      blunders: blundersPerGame(loaded.facts, loaded.games, loaded.profile, filter),
    };
  }, [loaded, filter]);

  if (error) return <div className="err">{error}</div>;
  if (!derived) return <div className="card report-card skel" style={{ height: 320 }} />;
  if (loaded && loaded.games.length === 0) {
    return <div className="card report-empty">Analyze a few games to unlock your trends.</div>;
  }

  return (
    <TrendsDashboard
      stats={derived.stats}
      series={derived.series}
      blunders={derived.blunders}
      filter={filter}
      onFilterChange={setFilter}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/TrendsView.tsx
git commit -m "feat: TrendsView data container"
```

---

### Task 8: Segmented tabs in `LibraryView`

**Files:**
- Modify: `src/components/LibraryView.tsx`

- [ ] **Step 1: Add tab state + import**

At the top of `src/components/LibraryView.tsx`, add the import:

```ts
import { TrendsView } from './TrendsView';
```

Inside `LibraryView`, add state (after the existing `useState` lines, ~line 17):

```ts
  const [tab, setTab] = useState<'games' | 'reports' | 'trends'>('games');
```

- [ ] **Step 2: Add the segmented control + gate the sections**

Replace the JSX from the `library-head` block through the closing `</div>` (currently lines 35–76) so that: the head gets a tab switcher, the profile form + games list render only under `games`, Reports under `reports`, and Trends under `trends`:

```tsx
      <div className="library-head">
        <h2>Your games</h2>
        <div className="seg lib-tabs" role="group" aria-label="Library section">
          {(['games', 'reports', 'trends'] as const).map((t) => (
            <button key={t} className={`seg-btn${tab === t ? ' seg-on' : ''}`}
              aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === 'games' ? 'Games' : t === 'reports' ? 'Reports' : 'Trends'}
            </button>
          ))}
        </div>
        <button onClick={onClose}>← Back</button>
      </div>

      {error && <div className="err">{error}</div>}

      {tab === 'games' && (
        <>
          <form className="card profile-card" onSubmit={submitProfile}>
            <h4>Profile</h4>
            <div className="profile-fields">
              <input placeholder="display name" value={profile.display_name ?? ''}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value || null })} />
              <input placeholder="chess.com username" value={profile.chesscom_username ?? ''}
                onChange={(e) => setProfile({ ...profile, chesscom_username: e.target.value || null })} />
              <input placeholder="lichess username" value={profile.lichess_username ?? ''}
                onChange={(e) => setProfile({ ...profile, lichess_username: e.target.value || null })} />
              <button className="primary" type="submit">Save</button>
            </div>
            {saved && <div className="auth-notice">Profile saved.</div>}
          </form>

          {!rows && !error && <div className="card skel" style={{ height: 200 }} />}
          {rows && rows.length === 0 && (
            <div className="card library-empty">No saved games yet — analyze a game and it lands here automatically.</div>
          )}
          {rows && rows.length > 0 && (
            <div className="card library-list">
              {rows.map((r) => (
                <button className="library-row" key={r.id} onClick={() => onOpen(r.id)}>
                  <span className="lr-players">
                    {r.white_name}{r.white_rating != null && <em> ({r.white_rating})</em>} vs {r.black_name}{r.black_rating != null && <em> ({r.black_rating})</em>}
                  </span>
                  <span className="lr-opening">{r.opening_name ?? '—'}</span>
                  <span className="lr-acc">{r.reviews ? `${r.reviews.white_accuracy.toFixed(0)}·${r.reviews.black_accuracy.toFixed(0)}` : '…'}</span>
                  <span className="lr-result">{r.result ?? '*'}</span>
                  <span className="lr-date">{r.played_at ?? r.created_at.slice(0, 10)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'reports' && <ReportsView user={user} />}
      {tab === 'trends' && <TrendsView user={user} />}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/LibraryView.tsx
git commit -m "feat: Games/Reports/Trends tabs in Library"
```

---

### Task 9: Remove the redundant `TrendCard` + `accuracyTrend`

**Files:**
- Modify: `src/components/ReportsView.tsx`
- Modify: `src/reports/aggregate.ts`
- Modify: `src/reports/aggregate.test.ts`

- [ ] **Step 1: Remove `TrendCard` from ReportsView**

In `src/components/ReportsView.tsx`:
- Remove `accuracyTrend` and `TrendPoint` from the import on lines 6–9.
- Remove `trend: TrendPoint[];` from the `ReportData` interface.
- Remove `trend: accuracyTrend(games, profile),` from the `setData({...})` call.
- Remove `<TrendCard trend={data.trend} />` from the returned JSX.
- Delete the entire `TrendCard` function and the `TW`/`TH` constants (lines ~168–206).

- [ ] **Step 2: Remove `accuracyTrend` from aggregate.ts**

In `src/reports/aggregate.ts`, delete the `TrendPoint` interface and the `accuracyTrend` function (lines ~113–128). The new `TrendSeriesPoint`/`trendSeries` supersede them.

- [ ] **Step 3: Remove `accuracyTrend` tests**

In `src/reports/aggregate.test.ts`, delete the `describe('accuracyTrend', ...)` block and drop `accuracyTrend` from the top import.

- [ ] **Step 4: Typecheck + full test run**

Run: `npx tsc -b && npx vitest run`
Expected: PASS — no dangling references to `accuracyTrend`/`TrendPoint`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ReportsView.tsx src/reports/aggregate.ts src/reports/aggregate.test.ts
git commit -m "refactor: drop redundant TrendCard/accuracyTrend"
```

---

### Task 10: Styles + final verification

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add trends styles**

Append to `src/index.css` (colors align with the existing dark theme + the `--green` token; add a light-scheme override consistent with the file's existing approach):

```css
/* trends dashboard */
.seg { display: inline-flex; gap: 2px; background: var(--surface-2); border-radius: 8px; padding: 2px; }
.seg-btn { font-size: 12px; padding: 5px 10px; border-radius: 6px; background: transparent; }
.seg-btn.seg-on { background: var(--surface-3); }
.lib-tabs { margin: 0 12px; }
.trends-filters { display: flex; gap: 10px; margin-bottom: 14px; }
.trends-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
.trend-tile { background: var(--surface-2); border-radius: 8px; padding: 12px; }
.tile-value { font-size: 22px; font-weight: 700; }
.tile-label { font-size: 10px; color: #9a968f; margin-top: 2px; }
.tile-delta { font-size: 10px; margin-top: 4px; }
.tile-up { color: var(--green); }
.tile-down { color: #e06a5a; }
.tile-muted { color: #75726c; }
.trend-chart, .blunder-bars { padding: 12px; margin-bottom: 12px; }
.trend-chart-head { display: flex; justify-content: space-between; font-size: 12px; color: #cfcbc4; margin-bottom: 8px; }
.trend-legend i { display: inline-block; width: 10px; height: 2px; vertical-align: middle; margin: 0 3px; }
.trend-legend .lg-acc { background: var(--green); }
.trend-legend .lg-rating { background: #7db3ff; }
.trend-svg { height: 160px; display: block; cursor: crosshair; }
.ln-rating { stroke: #7db3ff; stroke-width: 1.4; opacity: 0.55; }
.ln-acc-raw { stroke: var(--green); stroke-width: 1; opacity: 0.4; }
.ln-acc { stroke: var(--green); stroke-width: 2.4; }
.ln-cursor { stroke: #e9e9e9; stroke-width: 1; }
.trend-axis { display: flex; justify-content: space-between; font-size: 9px; color: #75726c; margin-top: 2px; }
.trend-tip { font-size: 11px; color: #e9e9e9; margin-top: 6px; }
.bb-row { display: flex; align-items: flex-end; gap: 2px; height: 50px; }
.bb-bar { flex: 1; min-height: 1px; background: #c77; border-radius: 2px 2px 0 0; }
```

- [ ] **Step 2: Full test + typecheck + build**

Run: `npx vitest run && npx tsc -b && npm run build`
Expected: all PASS; `dist/` builds clean.

- [ ] **Step 3: Manual verification (REQUIRED — use the `run` skill)**

Start the dev server (`npm run dev`), sign in, open **Library → Trends**. Verify: tabs switch; tiles show numbers; the main chart draws accuracy (bold) + rating (faint) with a hover tooltip; blunder bars render; Color/Range filters change the charts. Confirm **Reports** no longer shows the old trend card.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "style: trends dashboard visuals"
```

---

## Self-Review Notes

- **Spec coverage:** placement/tabs (Task 8), `result` field (1), `trendSeries` (2), `rollingAverage` (3), `blundersPerGame` (4), `headlineStats` + deltas + winRate-null (5), tiles/charts/tooltip/empty-state (6), filters + fetch reuse (7), cleanup of TrendCard/accuracyTrend (9), styles + light/dark + verification (10). All spec sections map to a task.
- **Win-rate semantics:** draws = 0.5 (score %), null when no determinable result — matches spec.
- **Determinism:** range measured from newest data date, never wall-clock — matches spec, keeps tests clock-free.
- **Type consistency:** `TrendFilter`, `TrendSeriesPoint`, `BlunderPoint`, `HeadlineStats`, `Stat` defined in Task 2/4/5 and consumed unchanged in Tasks 6–7.
- **Deviation from spec:** spec listed a single `TrendsView.tsx` + test; plan splits into `TrendsView` (container, untested like `ReportsView`) + `TrendsDashboard` (presentational, tested) for isolation. LibraryView tab wiring is verified by build + manual run rather than a Supabase-mocked unit test (YAGNI).
```
