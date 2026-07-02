# Phase 4: Board Feel + UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the whole app's look and feel: display + mono typography, layered dark surfaces, board effects (check pulse, mate flash, capture shake, brilliant sparkle, arrow draw-in, badge pop), staggered panel entrances, analysis skeleton, and swipe-to-step on mobile.

**Architecture:** Pure CSS does the heavy lifting (design tokens + keyframes in index.css). Fonts are self-hosted @fontsource packages imported in main.tsx. Board effects ride on chessground's own hooks: `check` config for the pulse, `highlight.custom` classes for the brilliant glow, container classes (set from App state derived from the current ply's SAN) for shake/flash, CSS animations on `.cg-shapes` for arrow draw-in. One new pure helper (`kingSquare`) is TDD'd; everything else is presentational and verified in-browser.

**Tech Stack:** existing stack + `@fontsource/outfit`, `@fontsource/ibm-plex-mono` (static font assets, no runtime deps).

**Design tokens (the contract for every task):**
- Palette adds: `--bg0: #1b1917` (page), `--gold: #e8b64f` (reveal flourish ONLY). Existing `--bg #262421` becomes card surface, `--surface #312e2b` stays elevated.
- Type: `--font-display: 'Outfit', var(--sans)` (weights 600/800 — headings, big numbers); `--font-mono: 'IBM Plex Mono', ui-monospace, monospace` (weights 500/600 — SAN moves, evals, accuracies, ratings, clocks).
- Motion durations: micro 120ms, standard 240ms, dramatic 600ms; everything animated must be disabled under `prefers-reduced-motion: reduce`.

**Context notes for the implementer:**
- `npm test` = vitest run (87 tests / 17 files at branch start). Build `npm run build`, lint `npm run lint` (2 accepted App.tsx exhaustive-deps warnings are pre-existing).
- index.css is organized in commented sections (`/* ── name ── */`). Append new sections; edit existing rules surgically — do NOT reformat the file.
- ReviewBoard (src/components/ReviewBoard.tsx) wraps chessground with `viewOnly: true`; it already sets `highlight.custom` classes (ov-blunder etc.) and autoShapes (best-move arrow brush 'green', badge customSvg).
- App.tsx: `playedPly` (AnalyzedPly | null) holds the current move's `san`, `classification`, `fenAfter`; `ply` is the current index. The board renders `fen` (fenAfter of previous ply).
- chessground CSS classes: `.cg-wrap`, `square.check` gets a red radial gradient from base CSS when `check` is set in config; `.cg-shapes` (SVG layer) holds arrow `<line>` elements; `.cg-custom-svgs` holds badge svgs.

---

### Task 1: Typography + surface foundation (fonts, tokens, identity pass)

**Files:**
- Modify: `package.json` (npm install)
- Modify: `src/main.tsx` (font imports)
- Modify: `src/index.css` (tokens + application)

No unit tests (presentational).

- [ ] **Step 1: Install fonts**

Run: `npm install @fontsource/outfit @fontsource/ibm-plex-mono`

- [ ] **Step 2: Import font weights in src/main.tsx** (before `./index.css`):

```ts
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/800.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
```

- [ ] **Step 3: Tokens in index.css `:root`**

Add to the existing `:root` block (keep all current vars):

```css
  --bg0: #1b1917;
  --gold: #e8b64f;
  --font-display: 'Outfit', 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, 'Cascadia Mono', monospace;
  --dur-micro: 120ms;
  --dur-std: 240ms;
  --dur-drama: 600ms;
```

- [ ] **Step 4: Apply the identity (surgical edits to existing rules)**

a) Page depth — update the `body` rule's background to:
```css
  background: radial-gradient(1200px 800px at 50% -10%, #24211d 0%, var(--bg0) 60%) fixed, var(--bg0);
```

b) Display face: add `font-family: var(--font-display);` to `.brand`, `.coach-title h3`, `.reveal-head h2`, `.acc .val`, `.rp-acc`, `.gamebar-title`.

c) Mono data voice: add `font-family: var(--font-mono);` (and `font-weight: 500` where unset) to: `.moves .san` (check the actual MoveList class names in src/components/MoveList.tsx and src/index.css — target the SAN text class), `.eval-pill`, `.played-san`, `.best-san`, `.acc .perf .elo`, `.acc .perf .est`, `.rp-elo`, `.rp-est`, `.gamebar-title .elo`, `.player .player-elo`, `.ply` (the "N / M" counter).

d) Gold flourish (reveal only): in the reveal CSS, `.rp-acc` gets `color` unchanged, but add:
```css
.reveal-player .rp-acc { font-family: var(--font-display); }
.reveal-card .reveal-knight { color: var(--gold); text-shadow: 0 0 24px rgba(232, 182, 79, 0.35); }
```
(The knight mark goes gold — the single gold accent. Do NOT use gold anywhere else.)

e) Micro-interactions — append a new section:
```css
/* ── micro-interactions ── */
button { transition: transform var(--dur-micro) ease, background var(--dur-micro) ease, box-shadow var(--dur-micro) ease; }
button:hover:not(:disabled) { transform: translateY(-1px); }
button:active:not(:disabled) { transform: translateY(0); }
:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; border-radius: 4px; }
.card { transition: box-shadow var(--dur-std) ease; }
@media (prefers-reduced-motion: reduce) {
  button, .card { transition: none; }
}
```

- [ ] **Step 5: Verify**

`npm test` (87/87), `npm run build` (clean; confirm the font files are emitted into dist/assets), `npm run lint`. Then `npm run dev` + a quick manual look: headings render in Outfit, SAN/evals in Plex Mono, page has subtle vignette depth, buttons lift on hover.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/main.tsx src/index.css
git commit -m "feat: display+mono typography, layered surfaces, micro-interactions"
```

---

### Task 2: Board effects (check pulse, mate flash, capture shake, brilliant sparkle, arrow draw-in, badge pop)

**Files:**
- Create: `src/chess/kingSquare.ts`
- Test: `src/chess/kingSquare.test.ts`
- Modify: `src/components/ReviewBoard.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: TDD the kingSquare helper**

Create `src/chess/kingSquare.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { kingSquare } from './kingSquare';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('kingSquare', () => {
  it('finds both kings in the start position', () => {
    expect(kingSquare(START, 'white')).toBe('e1');
    expect(kingSquare(START, 'black')).toBe('e8');
  });
  it('finds a displaced king', () => {
    expect(kingSquare('8/8/3k4/8/8/4K3/8/8 w - - 0 1', 'white')).toBe('e3');
    expect(kingSquare('8/8/3k4/8/8/4K3/8/8 w - - 0 1', 'black')).toBe('d6');
  });
  it('returns null when the king is absent', () => {
    expect(kingSquare('8/8/8/8/8/8/8/8 w - - 0 1', 'white')).toBeNull();
  });
});
```

Run → FAIL (unresolved). Then create `src/chess/kingSquare.ts`:

```ts
import type { Color } from './types';

/** Square ("e1") of the given side's king in a FEN, or null if absent. */
export function kingSquare(fen: string, color: Color): string | null {
  const board = fen.split(' ')[0];
  const target = color === 'white' ? 'K' : 'k';
  const ranks = board.split('/');
  for (let r = 0; r < ranks.length; r++) {
    let file = 0;
    for (const ch of ranks[r]) {
      if (ch >= '1' && ch <= '8') { file += Number(ch); continue; }
      if (ch === target) return `${'abcdefgh'[file]}${8 - r}`;
      file++;
    }
  }
  return null;
}
```

Run → PASS (3). Full suite → 90/90.

- [ ] **Step 2: Extend ReviewBoard props + config**

In `src/components/ReviewBoard.tsx`:

```ts
interface Props {
  fen: string;
  lastMove?: [string, string] | null;
  badge?: { square: string; cls: Classification } | null;
  arrow?: [string, string] | null;
  checkSquare?: string | null;  // king square currently in check (pulse)
}
```

In the `api.current?.set({...})` call add:

```ts
      check: (checkSquare as Key) ?? undefined,
```

and add `checkSquare` to that effect's dependency array. Also: when `badge?.cls === 'brilliant'`, add the square to the custom highlight map so CSS can bloom it:

```ts
      if (badge.cls === 'brilliant') custom.set(badge.square as Key, 'ov-brilliant');
```

(next to the existing BAD_CLASS branch).

- [ ] **Step 3: App wiring — derive effect state from the current ply**

In `src/App.tsx` add after the `badge` memo:

```ts
import { kingSquare } from './chess/kingSquare';

const checkSq = useMemo(() => {
  if (!playedPly || !(playedPly.san.includes('+') || playedPly.san.includes('#'))) return null;
  // After the move, the side to move is the one in check.
  const sideToMove = playedPly.fenAfter.split(' ')[1] === 'w' ? 'white' : 'black';
  return kingSquare(playedPly.fenAfter, sideToMove);
}, [playedPly]);

const boardFx = useMemo(() => {
  if (!playedPly) return '';
  const fx: string[] = [];
  if (playedPly.san.includes('#')) fx.push('fx-mate');
  else if (playedPly.san.includes('x')) fx.push('fx-capture');
  if (playedPly.classification === 'brilliant') fx.push('fx-brilliant');
  return fx.join(' ');
}, [playedPly]);
```

Pass to the board — the `.board` wrapper div gets a key so the animation restarts on every ply, and the class:

```tsx
<div className={`board ${boardFx}`} key={ply}>
  <ReviewBoard fen={fen} lastMove={lastMove} badge={badge} arrow={arrow} checkSquare={checkSq} />
</div>
```

(NOTE: keying by `ply` remounts the wrapper div but NOT ReviewBoard's chessground instance — verify piece-glide animation still runs when stepping; chessground animates via api.set inside the same component instance, and React reuses the child when only the parent key changes... it does NOT — a keyed parent remounts children. Instead, do NOT key the wrapper. Restart animations via a one-frame class toggle: keep `<div className={\`board ${boardFx}\`}>` unkeyed, and derive boardFx to include the ply, e.g. animation restart via `style={{ '--fx-seed': ply } as React.CSSProperties}` is unreliable — the robust pattern: in a `useEffect` on [ply], remove the fx classes via a ref and re-add them on the next frame:

```tsx
const boardRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  const el = boardRef.current;
  if (!el || !boardFx) return;
  el.classList.remove('fx-mate', 'fx-capture', 'fx-brilliant');
  void el.offsetWidth; // reflow to restart animation
  for (const c of boardFx.split(' ')) el.classList.add(c);
  return () => { el.classList.remove('fx-mate', 'fx-capture', 'fx-brilliant'); };
}, [ply, boardFx]);
```

and render `<div className="board" ref={boardRef}>` — classes managed only by the effect.)

- [ ] **Step 4: Effect CSS — append a new section**

```css
/* ── board effects ── */
/* piece glide is chessground's own animation (default 200ms) — no override needed */

/* check pulse: chessground sets background on square.check; add a breathing ring */
.cg-wrap square.check {
  animation: fx-check-pulse 1.1s ease-in-out infinite;
}
@keyframes fx-check-pulse {
  0%, 100% { box-shadow: inset 0 0 0 0 rgba(250, 65, 45, 0); }
  50% { box-shadow: inset 0 0 18px 4px rgba(250, 65, 45, 0.55); }
}

/* capture shake: tiny 2-axis jolt on the board container */
.board.fx-capture { animation: fx-shake 180ms ease-out; }
@keyframes fx-shake {
  20% { transform: translate(2px, -1px); }
  45% { transform: translate(-2px, 1px); }
  70% { transform: translate(1px, 0); }
}

/* mate flash: one-shot red vignette sweep over the whole board */
.board.fx-mate::after {
  content: '';
  position: absolute; inset: 0; z-index: 5; pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 0 0 60px 12px rgba(250, 65, 45, 0.5);
  animation: fx-mate-flash var(--dur-drama) ease-out forwards;
}
@keyframes fx-mate-flash { from { opacity: 1; } to { opacity: 0; } }

/* brilliant moment (signature): square bloom + board lean-in */
.cg-wrap square.ov-brilliant {
  background: radial-gradient(circle, rgba(38, 194, 163, 0.55) 0%, rgba(38, 194, 163, 0.18) 65%, transparent 100%);
  animation: fx-brilliant-bloom 1.4s ease-out;
}
@keyframes fx-brilliant-bloom {
  0% { box-shadow: 0 0 0 0 rgba(38, 194, 163, 0.9); }
  60% { box-shadow: 0 0 34px 10px rgba(38, 194, 163, 0.45); }
  100% { box-shadow: 0 0 22px 6px rgba(38, 194, 163, 0.25); }
}
.board.fx-brilliant::after {
  content: '';
  position: absolute; inset: 0; z-index: 4; pointer-events: none;
  background: radial-gradient(circle at center, transparent 55%, rgba(0, 0, 0, 0.35) 100%);
  animation: fx-mate-flash 1.4s ease-out forwards; /* reuse fade-out */
}

/* badge pop */
.cg-custom-svgs g { transform-origin: center; animation: fx-badge-pop var(--dur-std) cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes fx-badge-pop { from { transform: scale(0); } to { transform: scale(1); } }

/* best-move arrow draw-in */
.cg-shapes line { stroke-dasharray: 12; animation: fx-arrow-draw var(--dur-std) ease-out; }
@keyframes fx-arrow-draw { from { stroke-dashoffset: 60; opacity: 0.3; } to { stroke-dashoffset: 0; opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  .cg-wrap square.check, .board.fx-capture, .board.fx-mate::after,
  .cg-wrap square.ov-brilliant, .board.fx-brilliant::after,
  .cg-custom-svgs g, .cg-shapes line { animation: none; }
  .board.fx-mate::after, .board.fx-brilliant::after { opacity: 0; }
}
```

IMPORTANT check: `.board` must have `position: relative` (verify in existing CSS; add if missing) for the `::after` overlays. `stroke-dasharray: 12` on arrows stays after animation — verify the arrow doesn't render dashed at rest: if it does, set `stroke-dasharray` only inside the keyframes via `animation` on a class... simplest robust approach: animate opacity+transform instead:
```css
.cg-shapes line, .cg-shapes polygon { animation: fx-arrow-in var(--dur-std) ease-out; }
@keyframes fx-arrow-in { from { opacity: 0; } to { opacity: 1; } }
```
Use THIS simpler version if dasharray leaves visual artifacts (implementer: test visually with npm run dev, pick the one that looks clean, note the choice).

- [ ] **Step 5: Verify + commit**

`npm test` (90/90), `npm run build`, `npm run lint`. Manual dev check: step onto a check → king square pulses; capture → shake; brilliant (rare — craft a test PGN or temporarily lower thresholds LOCALLY ONLY, do not commit threshold changes) → bloom; arrows animate in; badges pop.

```bash
git add src/chess/kingSquare.ts src/chess/kingSquare.test.ts src/components/ReviewBoard.tsx src/App.tsx src/index.css
git commit -m "feat: board effects - check pulse, mate flash, capture shake, brilliant bloom"
```

---

### Task 3: Panel entrances + analysis skeleton

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css`

No unit tests (presentational).

- [ ] **Step 1: Staggered card entrance when a review lands**

The `<aside className="panel">` children (CoachCard wrapper, SummaryPanel, graph card) get an entrance class. In App.tsx, on the `review &&` aside:

```tsx
<aside className="panel panel-enter" key={game?.plies[0]?.fenBefore ?? 'panel'}>
```

(keying on the game identity restarts the entrance per new game — the aside subtree remounting is fine, unlike the board). CSS:

```css
/* ── panel entrance ── */
.panel-enter > * { animation: panel-in var(--dur-std) ease-out backwards; }
.panel-enter > *:nth-child(1) { animation-delay: 0ms; }
.panel-enter > *:nth-child(2) { animation-delay: 80ms; }
.panel-enter > *:nth-child(3) { animation-delay: 160ms; }
@keyframes panel-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .panel-enter > * { animation: none; } }
```

- [ ] **Step 2: Analysis skeleton**

While `progress` is set and no review yet, show shimmer placeholders in place of the panel. In App.tsx, inside the review-grid (which renders whenever `game && fen`), where `{review && (<aside ...>)}` is — add a skeleton branch:

```tsx
{!review && progress && (
  <aside className="panel">
    <div className="card skel" style={{ height: 120 }} />
    <div className="card skel" style={{ height: 260 }} />
    <div className="card skel" style={{ height: 140 }} />
  </aside>
)}
```

CSS:

```css
/* ── skeleton ── */
.skel {
  position: relative; overflow: hidden;
  background: var(--bg);
}
.skel::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.045) 50%, transparent 70%);
  animation: skel-sweep 1.4s ease-in-out infinite;
}
@keyframes skel-sweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
@media (prefers-reduced-motion: reduce) { .skel::after { animation: none; } }
```

- [ ] **Step 3: Verify + commit**

`npm test` (90/90), build, lint. Dev check: import → board + shimmering panel skeletons while analyzing → cards stagger in when done (behind the reveal overlay; close it to see).

```bash
git add src/App.tsx src/index.css
git commit -m "feat: staggered panel entrance and analysis skeleton"
```

---

### Task 4: Mobile swipe-to-step + reduced-motion audit

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/index.css` (only if audit finds gaps)

No unit tests (touch UI); verified in browser with touch emulation.

- [ ] **Step 1: Swipe handlers on the board area**

In App.tsx:

```ts
const touchStart = useRef<{ x: number; y: number } | null>(null);
const onTouchStart = useCallback((e: React.TouchEvent) => {
  const t = e.touches[0];
  touchStart.current = { x: t.clientX, y: t.clientY };
}, []);
const onTouchEnd = useCallback((e: React.TouchEvent) => {
  const start = touchStart.current;
  touchStart.current = null;
  if (!start) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - start.x;
  const dy = t.clientY - start.y;
  if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return; // not a horizontal swipe
  if (dx < 0) setPly((p) => Math.min(total, p + 1));  // swipe left → next
  else setPly((p) => Math.max(0, p - 1));             // swipe right → previous
}, [total]);
```

Attach to the board column:

```tsx
<section className="board-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
```

- [ ] **Step 2: Reduced-motion audit**

Grep index.css for every `animation:` and `transition:` added in Phase 3 + 4; confirm each has a `prefers-reduced-motion: reduce` override. Add any missing ones to the relevant media query blocks. List what you checked in your report.

- [ ] **Step 3: Verify + commit**

`npm test` (90/90), build, lint.

```bash
git add src/App.tsx src/index.css
git commit -m "feat: swipe-to-step on mobile + reduced-motion audit"
```

- [ ] **Step 4: Browser verification checklist (controller)**

1. Typography: Outfit headings, Plex Mono SAN/evals/ratings everywhere listed in Task 1.
2. Step through a game with checks/captures: pulse + shake fire per move, restart on every ply.
3. Mate PGN → red vignette flash once at the mate ply.
4. Best-move arrows fade/draw in on each step; badges pop.
5. Import → skeleton shimmer → close reveal → cards stagger in.
6. DevTools device mode: swipe left/right steps moves; vertical scrolls still work.
7. Emulate prefers-reduced-motion → no animations anywhere, all content visible.
