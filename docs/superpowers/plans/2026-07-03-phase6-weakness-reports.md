# Phase 6: Weakness Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Reports section inside the Library view: worst openings by accuracy, motif types most often missed, per-phase accuracy collapse, and accuracy/performance trend over time — aggregated from the signed-in user's saved history.

**Architecture:** Fetch raw-ish rows via three thin wrappers in `src/supabase/reports.ts` (games+reviews joined list — reuse shape; move_facts slim rows). All aggregation happens client-side in pure TDD'd `src/reports/aggregate.ts` (a user's history is a few thousand rows — no server-side SQL views needed, keeps RLS simple and avoids new migrations). `ReportsView` renders four cards below the profile card in LibraryView. Also adds the deferred `reviews(user_id)` index migration flagged in Phase 2a's review.

**Tech Stack:** existing. No new deps. Charts = simple CSS bars (no chart lib).

**Key facts:**
- Baseline: 110 tests / 21 files. Conventions as all prior phases (TDD red→green, surgical edits, gates: test/build/lint with the 2 accepted App.tsx exhaustive-deps warnings).
- move_facts rows: { game_id, ply, side, classification, win_drop, phase, motifs: string[] }. games rows carry opening_name, played_at, created_at; reviews carry white_accuracy/black_accuracy/white_est_rating/black_est_rating.
- IMPORTANT identity nuance: move_facts have no "was this the user's move" marker — the user may be white OR black. Determine the user's side per game by matching `profiles.chesscom_username`/`lichess_username`/`display_name` against white_name/black_name; when no match, INCLUDE BOTH SIDES (own-analysis of both) but prefer matched side when available. Keep this logic pure and tested (`userSide(game, profile)`).
- Guest mode: Reports render nothing new (LibraryView already requires auth).

---

### Task 1: reviews user_id index migration + report row wrappers

**Files:** Create `supabase/migrations/20260703200000_reports.sql`; create `src/supabase/reports.ts`.

Migration:
```sql
-- Deferred from Phase 2a review: reviews had no user_id index; the trend
-- query filters reviews by user, and the auth.users cascade benefits too.
create index reviews_user_idx on public.reviews (user_id);
```

`src/supabase/reports.ts` (thin, no tests — mirrors library.ts style):
```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ReportGameRow {
  id: string;
  white_name: string; black_name: string;
  opening_name: string | null;
  played_at: string | null; created_at: string;
  reviews: { white_accuracy: number; black_accuracy: number; white_est_rating: number; black_est_rating: number } | null;
}
export interface ReportFactRow {
  game_id: string; side: 'white' | 'black';
  classification: string; phase: string; motifs: string[];
  win_drop: number;
}

export async function fetchReportGames(client: SupabaseClient, limit = 200): Promise<ReportGameRow[]> {
  const { data, error } = await client
    .from('games')
    .select('id, white_name, black_name, opening_name, played_at, created_at, reviews(white_accuracy, black_accuracy, white_est_rating, black_est_rating)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ReportGameRow[];
}

export async function fetchReportFacts(client: SupabaseClient, limit = 10000): Promise<ReportFactRow[]> {
  const { data, error } = await client
    .from('move_facts')
    .select('game_id, side, classification, phase, motifs, win_drop')
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ReportFactRow[];
}
```

Gates: tests unchanged (110/110), build, lint.
Commit: `feat: reports data wrappers + reviews user index`

---

### Task 2: pure aggregations (TDD)

**Files:** Create `src/reports/aggregate.ts` + `src/reports/aggregate.test.ts`.

```ts
import type { ReportGameRow, ReportFactRow } from '../supabase/reports';
import type { Profile } from '../supabase/library';

/** Which side the user played, or null when undeterminable. */
export function userSide(game: ReportGameRow, profile: Profile | null): 'white' | 'black' | null

export interface OpeningStat { opening: string; games: number; avgAccuracy: number; }
/** Openings sorted by avgAccuracy ascending (worst first); openings with < minGames excluded; accuracy = user's side when known, else mean of both. */
export function worstOpenings(games: ReportGameRow[], profile: Profile | null, minGames = 2): OpeningStat[]

export interface MotifStat { motif: string; count: number; }
/** Counts of weakness motifs (missed_mate, walked_into_mate, hung_piece, missed_fork) over the user's facts (side-filtered when known via the games list), sorted desc. Ignores the ungated 'fork' tag. */
export function missedMotifs(facts: ReportFactRow[], games: ReportGameRow[], profile: Profile | null): MotifStat[]

export interface PhaseStat { phase: 'opening' | 'middlegame' | 'endgame'; moves: number; avgWinDrop: number; badMovePct: number; }
/** Per-phase aggregation over the user's facts (side-filtered when known). badMove = inaccuracy|mistake|blunder. */
export function phaseCollapse(facts: ReportFactRow[], games: ReportGameRow[], profile: Profile | null): PhaseStat[]

export interface TrendPoint { date: string; accuracy: number; estRating: number; }
/** One point per game with a review, user side when known else mean, sorted by played_at ?? created_at ascending. */
export function accuracyTrend(games: ReportGameRow[], profile: Profile | null): TrendPoint[]
```

userSide rules: case-insensitive match of profile.chesscom_username / lichess_username / display_name against white_name → 'white', black_name → 'black' (first match wins; test tie goes to white). Null profile or no match → null.

Tests (~10): userSide matches each field + case-insensitivity + null; worstOpenings sorts ascending, respects minGames, uses matched side's accuracy, falls back to mean when side unknown, skips games without reviews or opening_name; missedMotifs counts only the 4 weakness tags and filters to user side when known; phaseCollapse computes avgWinDrop + badMovePct per phase, empty phases omitted; accuracyTrend sorted by date with played_at preferred. Suite target: ~120/120 (state real count).

Commit: `feat: pure report aggregations`

---

### Task 3: ReportsView UI in Library

**Files:** Create `src/components/ReportsView.tsx`; modify `src/components/LibraryView.tsx`, `src/index.css`.

ReportsView props: `{ user: User }`. On mount (when supabase): fetch profile (reuse fetchProfile), fetchReportGames, fetchReportFacts in parallel; compute the four aggregates; render four `.card report-card` sections:
1. **Worst openings** — rows `opening · N games · [bar] 71.2` (bar width = accuracy%, mono numbers).
2. **Missed motifs** — rows `hung piece ×12` with human names (missed_mate → "missed mates", walked_into_mate → "walked into mate", hung_piece → "hung pieces", missed_fork → "missed forks") and count bars scaled to max.
3. **Phase breakdown** — three columns opening/middlegame/endgame: avg win-drop + bad-move % (highlight the worst phase with the blunder color).
4. **Trend** — inline SVG polyline of accuracy over games (like EvalGraph's minimal style) with est-rating as a second muted line; skip if < 3 points, show "Analyze more games to see your trend."
Empty history → single friendly empty card. Loading → `.card.skel`. Errors → `.err`.
LibraryView renders `<ReportsView user={user} />` after the games list. CSS: `.report-card` grid rows, `.rep-bar` (green fill on --bg), phase highlight, responsive.

Gates: tests unchanged, build, lint. Dev smoke: guest unaffected (Library gated on auth already).
Commit: `feat: weakness reports dashboard in library`

---

### Task 4: verification (controller)
Local: guest flow untouched; suite/build/lint green. Live (needs user's Supabase): after several analyzed games, Reports show plausible aggregates; RLS scopes to own rows. Documented as pending user setup.
