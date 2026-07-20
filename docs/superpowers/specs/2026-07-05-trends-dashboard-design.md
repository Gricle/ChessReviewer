# Trends Dashboard — Design Spec

**Date:** 2026-07-05
**Status:** Approved (brainstorming)
**Feature:** A dedicated "Trends" dashboard showing accuracy, estimated rating,
win rate, and blunders-per-game over time, with color/time filters.

## Goal

Turn the Library from a static list + weakness snapshot into something that
shows **progress over time**. Reuse data already stored in Supabase (`games`,
`reviews`, `move_facts`) — no new tables, no new engine work.

A minimal version already exists: `accuracyTrend()` in
`src/reports/aggregate.ts` and `TrendCard` in `ReportsView.tsx` (a tiny
480×96 SVG, one point per game, no axis/tooltip/filters). This feature
**replaces** that with a proper dashboard and removes the redundant card.

## Placement & Navigation

- New component `src/components/TrendsView.tsx`.
- `LibraryView` gains a **segmented control** at the top: `Games · Reports ·
  Trends` (defaults to `Games`). Selecting a tab swaps the section below.
  - `Games` → existing library list (current default content)
  - `Reports` → existing `<ReportsView>`
  - `Trends` → new `<TrendsView user={user} />`
- Auth-gated identically to Reports (only rendered inside `LibraryView`, which
  only renders for `auth.user`). Guest mode never sees it.

## Data Layer (pure, unit-tested)

All new logic lives in `src/reports/aggregate.ts` as pure functions operating
on the row shapes from `src/supabase/reports.ts`. No Supabase/chess.js imports
— same discipline as the existing aggregations.

### Required upstream change (additive)
`fetchReportGames` and `ReportGameRow` must also carry `result`:
- Add `result` to the `.select(...)` column list.
- Add `result: string | null` to `ReportGameRow`.
This is additive and harmless to `ReportsView` (it ignores the extra field).

### Filter model
```ts
type ColorFilter = 'all' | 'white' | 'black';
type RangeFilter = 'all' | '30d' | '3mo';
interface TrendFilter { color: ColorFilter; range: RangeFilter; }
```
Filtering is client-side over already-fetched rows. `range` is computed
relative to the newest game's date in the set (not wall-clock "now"), so the
dashboard is deterministic and testable without mocking the clock. Color
filtering uses the existing `userSide(game, profile)`; games whose side can't
be determined are **included** under `all` and **excluded** under
`white`/`black` (matching existing sided-filter behavior).

### New functions
- `trendSeries(games, profile, filter): TrendPoint[]`
  - One point per game that has a `reviews` row and passes the filter.
  - `TrendPoint = { date: string; accuracy: number; estRating: number; result: 'win' | 'loss' | 'draw' | null }`
  - `accuracy`/`estRating` = user's side when known, else mean of both (reuse
    existing `sidedValue`).
  - `result` derived from `game.result` + `userSide`: `'1-0'`→white wins,
    `'0-1'`→black wins, draw tokens (`1/2-1/2`, `½-½`)→draw. `null` when side
    unknown or result missing.
  - Sorted ascending by `played_at ?? created_at`.
- `rollingAverage(values: number[], window = 5): number[]`
  - Trailing average; positions with fewer than `window` prior points average
    what's available (no leading gaps).
- `blundersPerGame(facts, games, profile, filter): { date: string; blunders: number }[]`
  - Count `classification === 'blunder'` facts per game (side-filtered via
    `userSide` like `missedMotifs`), joined to the game's date, filtered and
    sorted like `trendSeries`. Games in range with zero blunders produce a
    `0` point.
- `headlineStats(games, facts, profile, filter): HeadlineStats`
  - `HeadlineStats = { avgAccuracy: Stat; estRating: Stat; winRate: Stat | null; blundersPerGame: Stat }`
  - `Stat = { value: number; delta: number | null }`
  - `value` = mean over the **current** filtered window.
  - `delta` = current minus the **previous** equal-length window immediately
    before it (by date). `null` when there's no previous window.
  - `winRate` is `null` when no game in the window has a determinable result.
  - `winRate` counts draws as 0.5 (standard score %), documented in the tile.

## UI (`TrendsView` + small chart subcomponents)

- **Filter bar:** two segmented controls (Color, Range). Pure local state;
  re-runs the pure aggregations on change (data fetched once).
- **Stat tiles (4):** avg accuracy · est. rating · win rate · blunders/game.
  Each shows the value and a ▲/▼ delta. Delta color semantics: higher is
  better for accuracy/rating/win-rate (▲ green); **lower is better for
  blunders** (▼ green). `null` delta renders muted "—". `winRate === null`
  renders "—" with a tooltip "set your username in profile to track wins".
- **Main chart** (`TrendChart`): larger responsive SVG.
  - Accuracy raw line (faint) + 5-game rolling average (bold).
  - Est. rating as a secondary faint line on its own min/max scale.
  - Real **date x-axis** with ~4–5 tick labels.
  - **Hover/focus tooltip**: nearest point → date, accuracy, rating, result.
    Pointer + keyboard (arrow-key) navigation, `role`/`aria` like `EvalGraph`.
- **Secondary chart:** blunders/game as bars over the same date range.
- **Colors:** follow the `dataviz` palette; both light and dark themes.
  Accuracy = primary green; rating = blue; blunders = warm/red.

## Empty / edge states

- `< 3` games in the filtered set → the two charts show "Analyze more games to
  see your trend." (matches current `TrendCard` threshold). Stat tiles still
  render what they can (deltas may be `—`).
- No games at all → `TrendsView` shows the same "Analyze a few games…" empty
  card style as `ReportsView`.

## Cleanup / refactor

- Remove `TrendCard` and its render from `ReportsView.tsx` (Reports stays
  focused on weaknesses).
- `accuracyTrend()` is superseded by `trendSeries()`. Remove `accuracyTrend`
  and its `TrendPoint` export once nothing references them, or re-implement
  `trendSeries` and delete the old one. Update `reports/aggregate.test.ts`
  accordingly.

## Testing

- **Unit (`reports/aggregate.test.ts`)** — new cases:
  - `trendSeries`: side selection, mean fallback, result derivation (win/
    loss/draw/null), color + range filtering, date sort.
  - `rollingAverage`: window math, short-series behavior.
  - `blundersPerGame`: counting, side filter, zero-blunder points, sort.
  - `headlineStats`: current vs previous window deltas, `winRate` null case,
    blunders-lower-is-better sign is left to the UI (function returns raw
    delta).
- **Component (`TrendsView.test.tsx`)** — renders tiles + charts for a small
  fixture; shows empty state under threshold; tab switch in `LibraryView`
  renders the right section.

## Out of scope (YAGNI)

Opening-level filter, CSV/PNG export, per-classification trend lines,
server-side aggregation. All are easy follow-ups on this foundation.

## Files touched

- `src/supabase/reports.ts` — add `result` to select + `ReportGameRow`.
- `src/reports/aggregate.ts` — new pure functions; remove `accuracyTrend`.
- `src/reports/aggregate.test.ts` — new/updated tests.
- `src/components/TrendsView.tsx` — new.
- `src/components/TrendsView.test.tsx` — new.
- `src/components/LibraryView.tsx` — segmented tab control.
- `src/components/ReportsView.tsx` — remove `TrendCard`.
- `src/index.css` — dashboard/tile/chart styles.
