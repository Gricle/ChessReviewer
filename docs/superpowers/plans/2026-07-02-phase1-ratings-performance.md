# Phase 1: Player Ratings + Performance Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show both players' real ratings (from PGN headers) and an estimated per-side performance rating ("played like ~1850") in the review UI.

**Architecture:** A pure-math `estimatePerformanceRating` module maps game accuracy + mistake counts to an Elo-like number via anchor-point interpolation and an error-rate penalty. `assembleReview` computes it into `ReviewSummary.estRating`. A tiny `playerRatings` helper parses `WhiteElo`/`BlackElo` headers. `SummaryPanel` and the gamebar render both.

**Tech Stack:** TypeScript, React, Vitest (existing setup — no new dependencies).

**Context notes for the implementer:**
- Run tests with `npm test` (this is `vitest run` — single pass, no watch). Filter to one file with `npm test -- <path>`.
- All analysis logic is pure functions under `src/analysis/`, one `*.test.ts` beside each module. Match that style.
- `ReviewSummary` lives in `src/chess/types.ts`; it is assembled in `src/analysis/assemble.ts` and rendered by `src/components/SummaryPanel.tsx`.
- PGN headers are already preserved verbatim in `ParsedGame.headers` (see `src/chess/pgnParser.ts`), so `WhiteElo`/`BlackElo` are available whenever the source PGN includes them (chess.com and lichess exports both do).

---

### Task 1: Performance-rating estimator (pure math, TDD)

**Files:**
- Create: `src/analysis/performanceRating.ts`
- Test: `src/analysis/performanceRating.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/analysis/performanceRating.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { estimatePerformanceRating } from './performanceRating';

const clean = { inaccuracies: 0, mistakes: 0, blunders: 0 };

describe('estimatePerformanceRating', () => {
  it('rates a perfect game at the ceiling', () => {
    expect(estimatePerformanceRating({ accuracy: 100, moveCount: 40, ...clean })).toBe(3200);
  });

  it('hits the calibration anchors exactly when error-free', () => {
    expect(estimatePerformanceRating({ accuracy: 95, moveCount: 40, ...clean })).toBe(2500);
    expect(estimatePerformanceRating({ accuracy: 80, moveCount: 40, ...clean })).toBe(1500);
    expect(estimatePerformanceRating({ accuracy: 70, moveCount: 40, ...clean })).toBe(1000);
  });

  it('interpolates between anchors', () => {
    // midway between 90 → 2100 and 95 → 2500
    expect(estimatePerformanceRating({ accuracy: 92.5, moveCount: 40, ...clean })).toBe(2300);
  });

  it('penalizes blunders at equal accuracy', () => {
    const noErr = estimatePerformanceRating({ accuracy: 85, moveCount: 40, ...clean });
    const blundery = estimatePerformanceRating({
      accuracy: 85, moveCount: 40, inaccuracies: 0, mistakes: 0, blunders: 3,
    });
    expect(blundery).toBeLessThan(noErr);
  });

  it('is monotonic in accuracy', () => {
    let prev = -Infinity;
    for (const acc of [40, 55, 65, 72, 78, 84, 88, 93, 97, 100]) {
      const r = estimatePerformanceRating({ accuracy: acc, moveCount: 40, ...clean });
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });

  it('never returns below the floor or above the ceiling', () => {
    expect(estimatePerformanceRating({
      accuracy: 5, moveCount: 10, inaccuracies: 3, mistakes: 3, blunders: 4,
    })).toBeGreaterThanOrEqual(100);
    expect(estimatePerformanceRating({ accuracy: 100, moveCount: 1, ...clean })).toBeLessThanOrEqual(3200);
  });

  it('handles zero moves without NaN', () => {
    const r = estimatePerformanceRating({ accuracy: 100, moveCount: 0, ...clean });
    expect(Number.isFinite(r)).toBe(true);
  });

  it('rounds to the nearest 50', () => {
    const r = estimatePerformanceRating({ accuracy: 87.3, moveCount: 38, inaccuracies: 2, mistakes: 1, blunders: 0 });
    expect(r % 50).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/analysis/performanceRating.test.ts`
Expected: FAIL — cannot resolve `./performanceRating`.

- [ ] **Step 3: Write the implementation**

Create `src/analysis/performanceRating.ts`:

```ts
// Estimate an Elo-like performance rating from a player's game accuracy and
// mistake distribution. Same spirit as chess.com's "you played like ~1850":
// a monotonic accuracy → rating curve (piecewise-linear between calibration
// anchors) minus a penalty for concentrated errors. The anchors are tuned by
// feel, not fitted to real data — adjust them here if estimates feel off.

export interface PerformanceInput {
  accuracy: number;      // player's game accuracy, 0..100
  moveCount: number;     // number of moves the player made
  inaccuracies: number;
  mistakes: number;
  blunders: number;
}

const FLOOR = 100;
const CEILING = 3200;

// [accuracy, rating] — must stay sorted by accuracy ascending.
const ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0, FLOOR],
  [50, 400],
  [60, 700],
  [70, 1000],
  [75, 1250],
  [80, 1500],
  [85, 1800],
  [90, 2100],
  [95, 2500],
  [100, CEILING],
];

function baseRating(accuracy: number): number {
  const acc = Math.max(0, Math.min(100, accuracy));
  for (let i = 1; i < ANCHORS.length; i++) {
    const [a1, r1] = ANCHORS[i - 1];
    const [a2, r2] = ANCHORS[i];
    if (acc <= a2) {
      const t = (acc - a1) / (a2 - a1);
      return r1 + t * (r2 - r1);
    }
  }
  return CEILING;
}

export function estimatePerformanceRating(input: PerformanceInput): number {
  const { accuracy, moveCount, inaccuracies, mistakes, blunders } = input;

  // Errors per move, weighted by severity. Accuracy already reflects errors
  // on average; this penalty separates "one huge blunder" games from
  // "uniformly sloppy" ones at the same accuracy.
  const errorWeight = 2 * blunders + mistakes + 0.5 * inaccuracies;
  const errorRate = errorWeight / Math.max(1, moveCount);
  const penalty = Math.min(400, errorRate * 900);

  const raw = baseRating(accuracy) - penalty;
  const clamped = Math.max(FLOOR, Math.min(CEILING, raw));
  return Math.round(clamped / 50) * 50;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/analysis/performanceRating.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/analysis/performanceRating.ts src/analysis/performanceRating.test.ts
git commit -m "feat: performance-rating estimator from accuracy + mistakes"
```

---

### Task 2: Compute estRating into ReviewSummary

**Files:**
- Modify: `src/chess/types.ts` (ReviewSummary, lines 41-46)
- Modify: `src/analysis/assemble.ts` (imports + return value, lines 76-84)
- Test: `src/analysis/assemble.test.ts`

- [ ] **Step 1: Write the failing test**

Add to the `describe('assembleReview', ...)` block in `src/analysis/assemble.test.ts`:

```ts
  it('estimates a high performance rating for both sides when every move is best/book', () => {
    const { summary } = assembleReview(game, flatAnalyses(game), OPENINGS);
    expect(summary.estRating.white).toBeGreaterThanOrEqual(2500);
    expect(summary.estRating.black).toBeGreaterThanOrEqual(2500);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/analysis/assemble.test.ts`
Expected: FAIL — `summary.estRating` is undefined (TypeScript will also complain that the property doesn't exist).

- [ ] **Step 3: Add the field to ReviewSummary**

In `src/chess/types.ts`, change the `ReviewSummary` interface to:

```ts
export interface ReviewSummary {
  opening: { eco: string; name: string } | null;
  whiteAccuracy: number;
  blackAccuracy: number;
  counts: Record<Classification, { white: number; black: number }>;
  estRating: { white: number; black: number };  // estimated performance rating
}
```

- [ ] **Step 4: Compute it in assembleReview**

In `src/analysis/assemble.ts`, add the import at the top:

```ts
import { estimatePerformanceRating } from './performanceRating';
```

Then replace the final `return` block (currently lines 76-84) with:

```ts
  const estRatingFor = (color: 'white' | 'black', accuracy: number) =>
    estimatePerformanceRating({
      accuracy,
      moveCount: plies.filter((p) => p.color === color).length,
      inaccuracies: counts.inaccuracy[color],
      mistakes: counts.mistake[color],
      blunders: counts.blunder[color],
    });

  return {
    plies,
    summary: {
      opening: opening ? { eco: opening.eco, name: opening.name } : null,
      whiteAccuracy: whiteAcc,
      blackAccuracy: blackAcc,
      counts,
      estRating: {
        white: estRatingFor('white', whiteAcc),
        black: estRatingFor('black', blackAcc),
      },
    },
  };
```

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: ALL PASS (the new assemble test plus every existing suite).

- [ ] **Step 6: Commit**

```bash
git add src/chess/types.ts src/analysis/assemble.ts src/analysis/assemble.test.ts
git commit -m "feat: estimated performance rating per side in ReviewSummary"
```

---

### Task 3: Parse player ratings from PGN headers

**Files:**
- Create: `src/chess/ratings.ts`
- Test: `src/chess/ratings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/chess/ratings.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { playerRatings } from './ratings';

describe('playerRatings', () => {
  it('parses numeric WhiteElo/BlackElo headers', () => {
    expect(playerRatings({ WhiteElo: '1543', BlackElo: '1601' }))
      .toEqual({ white: 1543, black: 1601 });
  });

  it('returns null for missing headers', () => {
    expect(playerRatings({})).toEqual({ white: null, black: null });
  });

  it('returns null for the PGN "?" placeholder and other junk', () => {
    expect(playerRatings({ WhiteElo: '?', BlackElo: 'unrated' }))
      .toEqual({ white: null, black: null });
  });

  it('rejects non-positive values', () => {
    expect(playerRatings({ WhiteElo: '0', BlackElo: '-5' }))
      .toEqual({ white: null, black: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/chess/ratings.test.ts`
Expected: FAIL — cannot resolve `./ratings`.

- [ ] **Step 3: Write the implementation**

Create `src/chess/ratings.ts`:

```ts
// Extract player ratings from PGN headers. PGN uses "?" (or omits the tag)
// when a rating is unknown; chess.com and lichess exports both emit numeric
// WhiteElo/BlackElo.

export interface PlayerRatings {
  white: number | null;
  black: number | null;
}

function parseElo(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function playerRatings(headers: Record<string, string>): PlayerRatings {
  return {
    white: parseElo(headers.WhiteElo),
    black: parseElo(headers.BlackElo),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/chess/ratings.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/chess/ratings.ts src/chess/ratings.test.ts
git commit -m "feat: parse WhiteElo/BlackElo ratings from PGN headers"
```

---

### Task 4: Render ratings + performance rating in the UI

**Files:**
- Modify: `src/components/SummaryPanel.tsx`
- Modify: `src/App.tsx` (gamebar title ~line 165, SummaryPanel usage ~line 202, player labels ~lines 188/195)
- Modify: `src/index.css` (append new rules)

No unit test for this task (presentational); verification is the full suite +
build + a manual smoke test with a real PGN.

- [ ] **Step 1: Extend SummaryPanel**

Replace the `Props` interface and the `acc-row` block in
`src/components/SummaryPanel.tsx` so the component becomes:

```tsx
import type { ReactNode } from 'react';
import type { ReviewSummary } from '../chess/types';
import type { PlayerRatings } from '../chess/ratings';
import { CLASS_META, CLASS_ORDER } from './classMeta';

interface Props {
  summary: ReviewSummary;
  white: string;
  black: string;
  ratings: PlayerRatings;
  result?: string | null;
  children?: ReactNode;
}

export function SummaryPanel({ summary, white, black, ratings, result, children }: Props) {
  return (
    <div className="card panel-card">
      <div className="acc-row">
        <div className="acc white">
          <div className="who" title={white}>{white}</div>
          <div className="val">{summary.whiteAccuracy.toFixed(1)}</div>
          <div className="perf" title="Estimated performance this game">
            {ratings.white !== null && <span className="elo">{ratings.white}</span>}
            <span className="est">~{summary.estRating.white}</span>
          </div>
        </div>
        <div className={`acc result${result ? '' : ' hidden'}`}>
          <div className="who">Result</div>
          <div className="val">{result ?? '?'}</div>
        </div>
        <div className="acc black">
          <div className="who" title={black}>{black}</div>
          <div className="val">{summary.blackAccuracy.toFixed(1)}</div>
          <div className="perf" title="Estimated performance this game">
            {ratings.black !== null && <span className="elo">{ratings.black}</span>}
            <span className="est">~{summary.estRating.black}</span>
          </div>
        </div>
      </div>

      <div className="panel-scroll">
        {children}

        <div className="breakdown">
          <div className="bd-head"><span /><span>Move</span><span>W</span><span>B</span></div>
          {CLASS_ORDER.map((label) => {
            const c = summary.counts[label];
            if (c.white === 0 && c.black === 0) return null;
            const meta = CLASS_META[label];
            return (
              <div className="bd-row" key={label}>
                <span className={`badge ${meta.cls}`}>{meta.sym}</span>
                <span className="label">{meta.label}</span>
                <span className="w">{c.white}</span>
                <span className="b">{c.black}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire ratings through App.tsx**

In `src/App.tsx`:

a) Add the import next to the other chess imports:

```ts
import { playerRatings } from './chess/ratings';
```

b) Add a memo after the `result` line (`const result = game?.headers.Result ?? null;`):

```ts
const ratings = useMemo(
  () => playerRatings(game?.headers ?? {}),
  [game],
);
```

c) Update the gamebar title (currently `{game.white} <span className="vs">vs</span> {game.black}`) to include ratings:

```tsx
<span className="gamebar-title">
  {game.white}{ratings.white !== null && <span className="elo"> ({ratings.white})</span>}
  <span className="vs">vs</span>
  {game.black}{ratings.black !== null && <span className="elo"> ({ratings.black})</span>}
  {result && <span className="result">{result}</span>}
  {review.summary.opening && <span className="muted"> · {review.summary.opening.name}</span>}
</span>
```

d) Update the player labels above/below the board:

```tsx
<div className="player black-name">
  {game.black}{ratings.black !== null && <span className="player-elo"> ({ratings.black})</span>}
</div>
```

and

```tsx
<div className="player white-name">
  {game.white}{ratings.white !== null && <span className="player-elo"> ({ratings.white})</span>}
</div>
```

e) Pass ratings into SummaryPanel:

```tsx
<SummaryPanel summary={review.summary} white={game.white} black={game.black} ratings={ratings} result={result}>
```

- [ ] **Step 3: Add CSS**

Append to `src/index.css`:

```css
/* ── ratings & performance ── */
.gamebar-title .elo { color: var(--text-mute); font-weight: 500; }
.player .player-elo { color: var(--text-mute); font-weight: 400; }
.acc .perf { margin-top: 4px; display: flex; gap: 6px; justify-content: center; align-items: baseline; }
.acc .perf .elo { font-size: 11px; color: var(--text-mute); }
.acc .perf .est {
  font-size: 11px; font-weight: 700; color: var(--green);
  background: rgba(129, 182, 76, 0.12);
  padding: 1px 6px; border-radius: 999px;
}
```

- [ ] **Step 4: Verify tests and build**

Run: `npm test`
Expected: ALL PASS.

Run: `npm run build`
Expected: builds with no TypeScript errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, open the app, paste a PGN that includes Elo headers, e.g.:

```
[White "Hikaru"]
[Black "Magnus"]
[WhiteElo "2802"]
[BlackElo "2839"]
[Result "1/2-1/2"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1/2-1/2
```

Expected after analysis completes:
- Gamebar: `Hikaru (2802) vs Magnus (2839)`.
- Player labels above/below the board show `(2839)` / `(2802)`.
- SummaryPanel shows, under each accuracy number, the real Elo plus a green `~NNNN` performance pill.
- Paste a PGN *without* Elo headers → no `( )` ratings anywhere, but the `~NNNN` performance pill still shows.

- [ ] **Step 6: Commit**

```bash
git add src/components/SummaryPanel.tsx src/App.tsx src/index.css
git commit -m "feat: show player ratings and estimated performance rating in review UI"
```
