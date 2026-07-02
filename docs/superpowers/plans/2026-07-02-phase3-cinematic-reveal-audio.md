# Phase 3: Cinematic Review Reveal + Audio Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When analysis completes, a full-screen animated results overlay plays — fanfare, accuracy counters ticking up, performance-rating cards flipping in, classification badges cascading — and the whole app gains a proper sound design: per-classification stingers while stepping through moves, UI ticks, a master volume slider, and persisted sound settings.

**Architecture:** All audio stays synthesized via the existing Web Audio module (`src/sound.ts`) — no external assets. It gains a master GainNode (volume, persisted to localStorage), new SoundKinds (tick/flip/fanfare + stingers), and a pure `classToStinger` map. A new `RevealOverlay` component runs a small stage state machine (`enter → accuracy → ratings → badges → done`) driven by timeouts, fully skippable by click, instant under `prefers-reduced-motion`. A `useCountUp` hook animates the accuracy numbers. App shows the overlay exactly once per fresh analysis and layers stingers onto move-step sounds.

**Tech Stack:** existing Vite + React 19 + TS + Vitest (jsdom) + @testing-library/react (already installed, currently unused). No new dependencies.

**Context notes for the implementer:**
- `npm test` = `vitest run` (73 tests / 15 files at branch start); vitest.config includes `src/**/*.test.tsx`. jsdom has NO `AudioContext` and NO `matchMedia` — code must guard both; audio tests only cover pure helpers.
- `src/sound.ts` synthesizes everything with three helpers (`noiseHit`, `thump`, `ring`) that currently connect to `c.destination`. `src/sound.test.ts` tests `sanToSound` — keep it passing.
- Review state: `App.tsx` sets `review` (type `Review` from `src/analysis/assemble.ts`) after `assembleReview`. `ReviewSummary` has `whiteAccuracy/blackAccuracy/counts/estRating/opening`. Ratings from `playerRatings` (already a memo `ratings` in App). `CLASS_META`/`CLASS_ORDER` in `src/components/classMeta.ts` give badge symbol/label/css-class per classification.
- CSS vars: `--bg --surface --text --text-dim --text-mute --green --line-strong --c-brilliant … --c-blunder --radius --shadow`. Existing overlay precedent: `.auth-overlay` at z-index 50.
- App already persists nothing; `soundOn`/`voiceOn` are plain useState. This plan adds localStorage persistence for both plus volume.

---

### Task 1: Audio engine — master volume + new sounds + stinger mapping (TDD for pure parts)

**Files:**
- Modify: `src/sound.ts`
- Test: `src/sound.test.ts` (append; existing sanToSound tests must keep passing)

- [ ] **Step 1: Write the failing tests**

Append to `src/sound.test.ts` (extend the import line accordingly):

```ts
import { sanToSound, clampVolume, loadVolume, saveVolume, classToStinger, VOLUME_KEY } from './sound';

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size; },
  } as Storage;
}

describe('volume persistence', () => {
  it('clamps to [0,1] and defaults garbage to 1', () => {
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(-2)).toBe(0);
    expect(clampVolume(7)).toBe(1);
    expect(clampVolume(NaN)).toBe(1);
  });

  it('round-trips through storage', () => {
    const s = fakeStorage();
    saveVolume(s, 0.35);
    expect(loadVolume(s)).toBe(0.35);
  });

  it('defaults to 1 on missing or corrupt values', () => {
    const s = fakeStorage();
    expect(loadVolume(s)).toBe(1);
    s.setItem(VOLUME_KEY, 'banana');
    expect(loadVolume(s)).toBe(1);
  });
});

describe('classToStinger', () => {
  it('maps the dramatic classifications to stingers', () => {
    expect(classToStinger('brilliant')).toBe('stBrilliant');
    expect(classToStinger('great')).toBe('stGreat');
    expect(classToStinger('mistake')).toBe('stMistake');
    expect(classToStinger('blunder')).toBe('stBlunder');
  });
  it('stays silent for ordinary moves', () => {
    expect(classToStinger('best')).toBeNull();
    expect(classToStinger('excellent')).toBeNull();
    expect(classToStinger('good')).toBeNull();
    expect(classToStinger('inaccuracy')).toBeNull();
    expect(classToStinger('book')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- src/sound.test.ts`
Expected: FAIL — `clampVolume` etc. not exported. Existing sanToSound tests still pass.

- [ ] **Step 3: Implement in src/sound.ts**

(a) Master gain + volume. Add after the `ctx` declaration:

```ts
let master: GainNode | null = null;

export const VOLUME_KEY = 'chessreviewer.volume';
let volume = typeof localStorage !== 'undefined' ? loadVolume(localStorage) : 1;

export function clampVolume(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

export function loadVolume(storage: Storage): number {
  const raw = storage.getItem(VOLUME_KEY);
  if (raw === null) return 1;
  return clampVolume(Number(raw));
}

export function saveVolume(storage: Storage, v: number): void {
  try { storage.setItem(VOLUME_KEY, String(clampVolume(v))); } catch { /* best-effort */ }
}

export function setVolume(v: number): void {
  volume = clampVolume(v);
  if (master) master.gain.value = volume;
  if (typeof localStorage !== 'undefined') saveVolume(localStorage, volume);
}

export function getVolume(): number {
  return volume;
}
```

(b) In `getCtx()`, after creating `ctx`, create the master gain:

```ts
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
```

(c) Route the three synth helpers through the master: in `noiseHit`, `thump`, and `ring`, replace `.connect(c.destination)` with `.connect(out(c))` and add one helper:

```ts
function out(c: AudioContext): AudioNode {
  return master ?? c.destination;
}
```

(d) New sound kinds. Extend the union:

```ts
export type SoundKind =
  | 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'gameEnd' | 'draw'
  | 'tick' | 'flip' | 'fanfare'
  | 'stBrilliant' | 'stGreat' | 'stMistake' | 'stBlunder';
```

and add cases to the `switch` in `playSound`:

```ts
    case 'tick': {
      // Tiny UI tick for counters
      noiseHit(c, t, 2400, 3.0, 0.02, 0.05);
      break;
    }

    case 'flip': {
      // Card-flip whoosh: bandpass noise sweeping upward
      const bufSize = c.sampleRate * 0.18;
      const buf = c.createBuffer(1, bufSize, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buf;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(400, t);
      bp.frequency.exponentialRampToValueAtTime(1600, t + 0.15);
      bp.Q.setValueAtTime(1.2, t);
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      src.connect(bp).connect(gain).connect(out(c));
      src.start(t);
      src.stop(t + 0.2);
      break;
    }

    case 'fanfare': {
      // Review-complete fanfare: rising triad landing on a bright octave
      ring(c, t, 523, 0.16, 0.08);        // C5
      ring(c, t + 0.10, 659, 0.16, 0.08); // E5
      ring(c, t + 0.20, 784, 0.18, 0.08); // G5
      ring(c, t + 0.32, 1047, 0.42, 0.09); // C6
      ring(c, t + 0.36, 1319, 0.38, 0.05); // E6 shimmer
      thump(c, t + 0.32, 130, 0.15, 0.12);
      break;
    }

    case 'stBrilliant': {
      // Sparkling ascending arpeggio — the teal moment
      ring(c, t, 1047, 0.12, 0.07);        // C6
      ring(c, t + 0.07, 1319, 0.12, 0.07); // E6
      ring(c, t + 0.14, 1568, 0.22, 0.08); // G6
      ring(c, t + 0.21, 2093, 0.30, 0.05); // C7 sparkle
      break;
    }

    case 'stGreat': {
      // Confident two-tone rise
      ring(c, t, 784, 0.12, 0.07);        // G5
      ring(c, t + 0.09, 988, 0.20, 0.07); // B5
      break;
    }

    case 'stMistake': {
      // Deflating two-tone fall
      ring(c, t, 659, 0.14, 0.07);        // E5
      ring(c, t + 0.11, 494, 0.22, 0.06); // B4
      break;
    }

    case 'stBlunder': {
      // Ominous low thud with a dissonant minor-second shadow
      thump(c, t, 65, 0.30, 0.30);
      ring(c, t + 0.02, 220, 0.30, 0.05);  // A3
      ring(c, t + 0.02, 233, 0.30, 0.05);  // Bb3 — beats against A3
      break;
    }
```

(e) The stinger map (pure, at the bottom of the file):

```ts
import type { Classification } from './chess/types';

/** Stinger layered on top of the move sound when stepping onto a move. */
export function classToStinger(cls: Classification): SoundKind | null {
  switch (cls) {
    case 'brilliant': return 'stBrilliant';
    case 'great': return 'stGreat';
    case 'mistake': return 'stMistake';
    case 'blunder': return 'stBlunder';
    default: return null;
  }
}
```

(Put the type import at the top of the file with a `type` keyword.)

- [ ] **Step 4: Run tests**

Run: `npm test -- src/sound.test.ts` — expected: PASS (all, old + new).
Run: `npm test` — expected: 78/78 (73 + 5 new).
Run: `npm run build` — expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/sound.ts src/sound.test.ts
git commit -m "feat: master volume, reveal sounds, and classification stingers"
```

---

### Task 2: useCountUp hook + reduced-motion util (TDD)

**Files:**
- Create: `src/hooks/reducedMotion.ts`
- Create: `src/hooks/useCountUp.ts`
- Test: `src/hooks/useCountUp.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useCountUp.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp } from './useCountUp';

afterEach(() => {
  vi.restoreAllMocks();
  // remove any matchMedia stub between tests
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe('useCountUp', () => {
  it('stays at 0 while inactive', () => {
    const { result } = renderHook(() => useCountUp(87.5, false));
    expect(result.current).toBe(0);
  });

  it('jumps straight to the target under prefers-reduced-motion', () => {
    (window as { matchMedia?: unknown }).matchMedia = (q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
    });
    const { result } = renderHook(() => useCountUp(87.5, true));
    expect(result.current).toBe(87.5);
  });

  it('animates toward the target via requestAnimationFrame', () => {
    let now = 0;
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const { result } = renderHook(() => useCountUp(100, true, 1000));
    // run first frame at t=500 (halfway, eased > 50%)
    now = 500;
    act(() => { frames.shift()!(now); });
    expect(result.current).toBeGreaterThan(50);
    expect(result.current).toBeLessThan(100);
    // final frame at t=1000
    now = 1000;
    act(() => { frames.shift()!(now); });
    expect(result.current).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/useCountUp.test.tsx`
Expected: FAIL — cannot resolve `./useCountUp`.

- [ ] **Step 3: Implement**

Create `src/hooks/reducedMotion.ts`:

```ts
// jsdom (tests) has no matchMedia — treat that as "no preference".
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
```

Create `src/hooks/useCountUp.ts`:

```ts
import { useEffect, useState } from 'react';
import { prefersReducedMotion } from './reducedMotion';

/** Animates 0 → target with an ease-out cubic once `active` becomes true. */
export function useCountUp(target: number, active: boolean, durationMs = 1200): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (nowMs: number) => {
      const t = Math.min(1, (nowMs - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(t >= 1 ? target : target * eased);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active, durationMs]);

  return value;
}
```

Note for the test's third case: the hook's first `requestAnimationFrame(step)` runs during the effect — with the mock, that pushes `step` into `frames`. `performance.now()` is mocked to 0 at that moment, so `start = 0` and the assertions hold. If the effect's initial rAF call happens before the spy is installed (it doesn't — renderHook runs after), report BLOCKED with observed behavior.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/hooks/useCountUp.test.tsx` — expected: PASS (3).
Run: `npm test` — expected: 81/81.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/reducedMotion.ts src/hooks/useCountUp.ts src/hooks/useCountUp.test.tsx
git commit -m "feat: count-up hook with reduced-motion support"
```

---

### Task 3: RevealOverlay component + stage machine + CSS (TDD via RTL)

**Files:**
- Create: `src/components/revealStages.ts` (pure stage machine — tested)
- Create: `src/components/RevealOverlay.tsx`
- Modify: `src/index.css` (append reveal styles)
- Test: `src/components/RevealOverlay.test.tsx`

- [ ] **Step 1: Create the pure stage machine first (it's needed by both test and component)**

Create `src/components/revealStages.ts`:

```ts
// Stage timeline for the results reveal. Each stage shows its section and
// schedules the next one; 'done' holds until the user starts the review.
export const REVEAL_STAGES = ['enter', 'accuracy', 'ratings', 'badges', 'done'] as const;
export type RevealStage = (typeof REVEAL_STAGES)[number];

export const STAGE_MS: Record<Exclude<RevealStage, 'done'>, number> = {
  enter: 500,
  accuracy: 1500,
  ratings: 900,
  badges: 1000,
};

export function nextStage(stage: RevealStage): RevealStage {
  const i = REVEAL_STAGES.indexOf(stage);
  return REVEAL_STAGES[Math.min(i + 1, REVEAL_STAGES.length - 1)];
}

/** Has `stage` reached (or passed) `target` in the timeline? */
export function stageReached(stage: RevealStage, target: RevealStage): boolean {
  return REVEAL_STAGES.indexOf(stage) >= REVEAL_STAGES.indexOf(target);
}
```

- [ ] **Step 2: Write the failing component test**

Create `src/components/RevealOverlay.test.tsx`:

```tsx
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/components/RevealOverlay.test.tsx`
Expected: FAIL — cannot resolve `./RevealOverlay`.

- [ ] **Step 4: Implement the component**

Create `src/components/RevealOverlay.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { ReviewSummary } from '../chess/types';
import type { PlayerRatings } from '../chess/ratings';
import { CLASS_META, CLASS_ORDER } from './classMeta';
import { playSound } from '../sound';
import { useCountUp } from '../hooks/useCountUp';
import { prefersReducedMotion } from '../hooks/reducedMotion';
import { STAGE_MS, nextStage, stageReached, type RevealStage } from './revealStages';

interface Props {
  summary: ReviewSummary;
  white: string;
  black: string;
  ratings: PlayerRatings;
  soundOn: boolean;
  onClose: () => void;
}

export function RevealOverlay({ summary, white, black, ratings, soundOn, onClose }: Props) {
  const [stage, setStage] = useState<RevealStage>(() => (prefersReducedMotion() ? 'done' : 'enter'));

  // Advance the timeline.
  useEffect(() => {
    if (stage === 'done') return;
    const id = window.setTimeout(() => setStage(nextStage(stage)), STAGE_MS[stage]);
    return () => window.clearTimeout(id);
  }, [stage]);

  // Stage-entry sounds.
  useEffect(() => {
    if (!soundOn) return;
    if (stage === 'enter') playSound('fanfare');
    if (stage === 'ratings') playSound('flip');
    if (stage === 'badges') playSound('tick');
  }, [stage, soundOn]);

  // Counter ticks while accuracy numbers run.
  useEffect(() => {
    if (!soundOn || stage !== 'accuracy') return;
    const id = window.setInterval(() => playSound('tick'), 150);
    return () => window.clearInterval(id);
  }, [stage, soundOn]);

  const counting = stageReached(stage, 'accuracy');
  const whiteAcc = useCountUp(summary.whiteAccuracy, counting);
  const blackAcc = useCountUp(summary.blackAccuracy, counting);
  const showRatings = stageReached(stage, 'ratings');
  const showBadges = stageReached(stage, 'badges');
  const done = stage === 'done';

  const badgeRows = CLASS_ORDER.filter(
    (l) => summary.counts[l].white > 0 || summary.counts[l].black > 0,
  );

  const skip = () => { if (!done) setStage('done'); };

  return (
    <div className="reveal-overlay" onClick={skip} role="dialog" aria-modal="true" aria-label="Game review results">
      <div className="reveal-card">
        <div className="reveal-head">
          <span className="reveal-knight" aria-hidden="true">♞</span>
          <h2>Game Review</h2>
          {summary.opening && <div className="reveal-opening">{summary.opening.name}</div>}
        </div>

        <div className={`reveal-sec acc${counting ? ' in' : ''}`}>
          <div className="reveal-player">
            <div className="rp-name">{white}</div>
            <div className="rp-acc">{whiteAcc.toFixed(1)}</div>
            <div className={`rp-rating${showRatings ? ' flip-in' : ''}`}>
              {ratings.white !== null && <span className="rp-elo">{ratings.white}</span>}
              <span className="rp-est">~{summary.estRating.white}</span>
            </div>
          </div>
          <div className="reveal-vs">vs</div>
          <div className="reveal-player">
            <div className="rp-name">{black}</div>
            <div className="rp-acc">{blackAcc.toFixed(1)}</div>
            <div className={`rp-rating${showRatings ? ' flip-in' : ''}`}>
              {ratings.black !== null && <span className="rp-elo">{ratings.black}</span>}
              <span className="rp-est">~{summary.estRating.black}</span>
            </div>
          </div>
        </div>

        <div className={`reveal-sec badges${showBadges ? ' in' : ''}`}>
          {badgeRows.map((label, i) => {
            const meta = CLASS_META[label];
            const c = summary.counts[label];
            return (
              <div
                className="reveal-badge-row"
                key={label}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className={`badge ${meta.cls}`}>{meta.sym}</span>
                <span className="rb-label">{meta.label}</span>
                <span className="rb-w">{c.white}</span>
                <span className="rb-b">{c.black}</span>
              </div>
            );
          })}
        </div>

        <div className={`reveal-sec cta${done ? ' in' : ''}`}>
          <button
            className="primary reveal-start"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            Start review
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Append CSS**

Append to `src/index.css`:

```css
/* ── review reveal ── */
.reveal-overlay {
  position: fixed; inset: 0; z-index: 60;
  background: rgba(0, 0, 0, 0.72);
  display: flex; align-items: center; justify-content: center;
  animation: reveal-fade 0.4s ease;
  cursor: pointer;
}
.reveal-card {
  background: var(--surface);
  border-radius: calc(var(--radius) + 4px);
  box-shadow: var(--shadow);
  width: min(440px, 92vw);
  max-height: 88vh; overflow-y: auto;
  padding: 26px 28px;
  text-align: center;
  cursor: default;
}
.reveal-head .reveal-knight { font-size: 40px; color: var(--green); display: block; }
.reveal-head h2 { margin: 4px 0 2px; font-size: 24px; }
.reveal-opening { color: var(--text-mute); font-size: 13px; margin-bottom: 6px; }

.reveal-sec { opacity: 0; transform: translateY(12px); transition: opacity 0.45s ease, transform 0.45s ease; }
.reveal-sec.in { opacity: 1; transform: none; }

.reveal-sec.acc { display: flex; align-items: flex-start; justify-content: center; gap: 18px; margin: 18px 0 6px; }
.reveal-vs { color: var(--text-mute); margin-top: 26px; }
.reveal-player { flex: 1; max-width: 150px; }
.rp-name { font-size: 13px; color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rp-acc { font-size: 38px; font-weight: 800; line-height: 1.15; }
.reveal-player:first-child .rp-acc { color: #f1f1f1; }
.reveal-player:last-child .rp-acc { color: var(--green); }
.rp-rating { display: flex; gap: 6px; justify-content: center; align-items: baseline; opacity: 0; }
.rp-rating.flip-in { animation: reveal-flip 0.5s ease forwards; }
.rp-elo { font-size: 12px; color: var(--text-mute); }
.rp-est {
  font-size: 12px; font-weight: 700; color: var(--green);
  background: rgba(129, 182, 76, 0.12); padding: 1px 7px; border-radius: 999px;
}

.reveal-sec.badges { margin: 14px auto 0; max-width: 300px; }
.reveal-badge-row {
  display: grid; grid-template-columns: 26px 1fr 34px 34px;
  align-items: center; gap: 8px; padding: 3px 0; font-size: 13px;
}
.reveal-sec.badges.in .reveal-badge-row { animation: reveal-cascade 0.35s ease backwards; }
.reveal-badge-row .rb-label { text-align: left; color: var(--text-dim); }
.reveal-badge-row .rb-w { color: #f1f1f1; font-weight: 700; }
.reveal-badge-row .rb-b { color: var(--green); font-weight: 700; }

.reveal-sec.cta { margin-top: 20px; }
.reveal-start { font-size: 15px; padding: 10px 26px; }

@keyframes reveal-fade { from { opacity: 0; } }
@keyframes reveal-flip {
  from { opacity: 0; transform: rotateX(90deg); }
  to { opacity: 1; transform: none; }
}
@keyframes reveal-cascade {
  from { opacity: 0; transform: translateX(-14px); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .reveal-overlay, .reveal-sec, .rp-rating.flip-in, .reveal-sec.badges.in .reveal-badge-row { animation: none; transition: none; }
  .reveal-sec { opacity: 1; transform: none; }
  .rp-rating { opacity: 1; }
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- src/components/RevealOverlay.test.tsx` — expected: PASS (3).
Run: `npm test` — expected: 84/84.
Run: `npm run build` — expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/revealStages.ts src/components/RevealOverlay.tsx src/components/RevealOverlay.test.tsx src/index.css
git commit -m "feat: cinematic review reveal overlay with staged animation"
```

---

### Task 4: App wiring — show reveal once, volume slider, move stingers, persisted settings

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css` (volume slider styles)

No new unit tests (wiring over tested modules); verification = full suite + build + browser check by the controller.

- [ ] **Step 1: Wire the overlay into App.tsx**

a) Imports:

```ts
import { playSound, sanToSound, classToStinger, setVolume, getVolume } from './sound';
import { RevealOverlay } from './components/RevealOverlay';
```

(replacing the existing `import { playSound, sanToSound } from './sound';`)

b) State (next to the other useState calls) — persisted lazy initializers:

```ts
const [showReveal, setShowReveal] = useState(false);
const [soundOn, setSoundOn] = useState(() => localStorage.getItem('chessreviewer.soundOn') !== '0');
const [voiceOn, setVoiceOn] = useState(() => localStorage.getItem('chessreviewer.voiceOn') !== '0');
const [volume, setVolumeState] = useState(getVolume);
```

(Replace the existing `soundOn`/`voiceOn` useState lines.)

c) Persistence effects (after the sync effects):

```ts
useEffect(() => { localStorage.setItem('chessreviewer.soundOn', soundOn ? '1' : '0'); }, [soundOn]);
useEffect(() => { localStorage.setItem('chessreviewer.voiceOn', voiceOn ? '1' : '0'); }, [voiceOn]);
```

d) Show the reveal when a fresh analysis lands: in `run()`, right after `setReview(assembleReview(parsed, analyses, OPENINGS));` add:

```ts
setShowReveal(true);
```

(There is a `if (seq !== runSeq.current) return;` guard just before setReview — the new line goes after setReview, inside the same guarded block.)

e) Move stingers: extend the existing step-sound effect:

```ts
useEffect(() => {
  if (review && soundOn && ply > 0 && ply !== prevPly.current) {
    const p = review.plies[ply - 1];
    if (p) {
      playSound(sanToSound(p.san));
      const st = classToStinger(p.classification);
      if (st) playSound(st);
    }
  }
  prevPly.current = ply;
}, [ply, review, soundOn]);
```

f) Volume slider handler:

```ts
const handleVolume = (v: number) => {
  setVolume(v);        // module: master gain + persistence
  setVolumeState(v);   // UI
};
```

g) Render the overlay (top level of the returned JSX, right before the closing `</div>` of `.app`):

```tsx
{showReveal && game && review && (
  <RevealOverlay
    summary={review.summary}
    white={game.white}
    black={game.black}
    ratings={ratings}
    soundOn={soundOn}
    onClose={() => setShowReveal(false)}
  />
)}
```

h) Volume slider in the playback bar — insert between the sound-mute button and the voice button:

```tsx
<input
  type="range"
  className="vol-slider"
  min={0}
  max={1}
  step={0.05}
  value={volume}
  onChange={(e) => handleVolume(Number(e.target.value))}
  title="Volume"
  aria-label="Sound volume"
/>
```

- [ ] **Step 2: Slider CSS**

Append to `src/index.css`:

```css
/* ── volume slider ── */
.vol-slider { width: 64px; accent-color: var(--green); cursor: pointer; }
@media (max-width: 600px) { .vol-slider { width: 48px; } }
```

- [ ] **Step 3: Verify**

Run: `npm test` — expected: 84/84.
Run: `npm run build` — expected: clean.
Run: `npm run lint` — expected: no NEW warnings (the two accepted App.tsx exhaustive-deps warnings remain).

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/index.css
git commit -m "feat: reveal on analysis complete, volume slider, move stingers, persisted sound settings"
```

- [ ] **Step 5: Browser verification checklist (controller)**

1. Analyze a PGN → overlay appears with fanfare → accuracies count up with ticks → rating pills flip in with whoosh → badges cascade → "Start review" appears.
2. Click during the animation → skips instantly to the final state; click Start review → overlay closes, normal review visible.
3. Step onto a blunder → low ominous stinger layered on the move sound; brilliant → sparkle.
4. Drag volume slider → all sounds scale; reload → volume, sound-on, voice-on all remembered.
5. Guest + logged-in modes both unaffected functionally (overlay is purely presentational).
6. OS reduced-motion enabled → overlay renders final state instantly, no animations.
