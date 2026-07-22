# Nocturne Structural Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's front-end structure with the Nocturne prototype's UI (`nocturne-chess-reviewer/`), wired to all real services, then delete the prototype folder.

**Architecture:** Tailwind v4 utility components (ported from the prototype) become the UI layer over the untouched logic layer (engine, importers, Supabase, coach, sound). Plain-CSS survivors (chessground board, EvalBar, EvalGraph, RevealOverlay, ReportsView/TrendsView internals) keep `index.css`; everything replaced gets its selectors pruned. `App.tsx` re-renders into a tabbed shell (`import | review | library`) with new flip + keyboard-shortcut capabilities.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), lucide-react, chessground, vitest + testing-library, Playwright (verification only).

**Read the spec first:** `docs/superpowers/specs/2026-07-22-nocturne-structural-adoption-design.md`

**Critical context for every task:**
- The prototype folder `nocturne-chess-reviewer/` **exists on disk during all tasks** — read its components directly as the visual source of truth. It is deleted only in the final task. NEVER import from it; only copy markup/classes out of it.
- Prototype `services/*` and `types.ts` are mocks. Real equivalents: `src/analysis/assemble.ts` (`Review`, `ReviewSummary`), `src/chess/types.ts` (`AnalyzedPly`, `Classification`, `ParsedGame`), `src/components/classMeta.ts` (`CLASS_META`, `CLASS_ORDER` — the real `CLASSIFICATION_MAP`), `src/sound.ts`, `src/speech.ts`, `src/supabase/*`, `src/importers/*`.
- Real `AnalyzedPly` differs from the prototype's: it has `index`? — NO. Check `src/chess/types.ts` before writing component code; real plies use `san`, `uci`, `classification`, `color`, `evalAfterCp` (mover perspective), `bestMoveUci`, `fenBefore`, `fenAfter`. White-perspective eval per ply is computed in App (`whiteEvals`). App's `ply` state is 0..total **inclusive** (0 = initial position, N = after N half-moves); prototype used 0..len-1. Keep the App convention everywhere.
- Working branch: `nocturne-structural`. Commit after each task. Windows/PowerShell environment; npm (not bun).

---

### Task 1: Toolchain — Tailwind v4 + lucide-react

**Files:**
- Modify: `package.json`, `vite.config.ts`, `src/main.tsx`
- Create: `src/tw.css`

- [ ] **Step 1: Install deps**

```bash
npm install tailwindcss @tailwindcss/vite lucide-react
npm uninstall @fontsource/outfit
```

- [ ] **Step 2: Wire vite plugin**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/ChessReviewer/',
  plugins: [react(), tailwindcss()],
})
```

- [ ] **Step 3: Create `src/tw.css`**

Full Tailwind including preflight, plus theme mapping so prototype classes like `font-display`/`font-mono` resolve:

```css
@import "tailwindcss";

@theme {
  --font-sans: 'Space Grotesk', system-ui, sans-serif;
  --font-display: 'Space Grotesk', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
}
```

- [ ] **Step 4: Import order in `src/main.tsx`** — `import './tw.css'` **before** `import './index.css'` so legacy selectors win ties against preflight.

- [ ] **Step 5: Verify existing app unbroken**

Run: `npm run build && npm test`
Expected: build succeeds, all tests pass. Then `npm run dev` + quick Playwright screenshot of the landing page; compare against pre-change look. If preflight visibly breaks legacy components (buttons/headings losing style), switch `tw.css` to preflight-less form (`@layer theme, base, components, utilities; @import "tailwindcss/theme.css" layer(theme); @import "tailwindcss/utilities.css" layer(utilities);` plus the `@theme` block) and re-verify.

- [ ] **Step 6: Commit** — `chore: add Tailwind v4 + lucide-react toolchain`

---

### Task 2: Sample games — `src/data/samplePgns.ts`

**Files:**
- Create: `src/data/samplePgns.ts`, `src/data/samplePgns.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest';
import { SAMPLE_PGNS } from './samplePgns';
import { parsePgn } from '../chess/pgnParser';

describe('SAMPLE_PGNS', () => {
  it('contains the three demo games', () => {
    expect(Object.keys(SAMPLE_PGNS)).toEqual(['immortal', 'opera', 'blunderfest']);
  });

  it.each(Object.entries(SAMPLE_PGNS))('%s parses to a full game', (_key, s) => {
    const parsed = parsePgn(s.pgn);
    expect(parsed.plies.length).toBeGreaterThan(20);
    expect(parsed.white).toBeTruthy();
    expect(parsed.black).toBeTruthy();
  });
});
```

(Adjust `parsed.white` to the real `ParsedGame` field — check `src/chess/types.ts`; it may be `parsed.headers.White`.)

- [ ] **Step 2: Run** `npm test -- samplePgns` — expect FAIL (module missing).

- [ ] **Step 3: Implement** — export `SAMPLE_PGNS: Record<'immortal' | 'opera' | 'blunderfest', { label: string; sub: string; pgn: string }>` with real full PGNs:
  - `immortal`: Anderssen–Kieseritzky, London 1851 ("The Immortal Game", 1-0, 23 moves) with proper headers.
  - `opera`: Morphy vs Duke Karl / Count Isouard, Paris 1858 (1-0, 17 moves).
  - `blunderfest`: any real short game with several blunders — e.g. Gibaud–Lazard style miniature or a scholar's-mate-adjacent amateur game with headers `[White "Tactics Demo"]`; must parse and contain at least one losing blunder.
  Labels: `Immortal Game (1851)` / `Opera Game (Morphy)` / `Tactics & Blunders`.

- [ ] **Step 4: Run** `npm test -- samplePgns` — expect PASS.

- [ ] **Step 5: Commit** — `feat: add classic sample PGNs for quick demos`

---

### Task 3: AuthModal (replaces AuthBar)

**Files:**
- Create: `src/components/AuthModal.tsx`
- Visual source: `nocturne-chess-reviewer/src/components/AuthModal.tsx`
- Logic source: `src/components/AuthBar.tsx` (real flows, do not lose any)

- [ ] **Step 1: Implement `AuthModal.tsx`**

Interface:
```ts
import type { Auth } from '../supabase/useAuth';
interface Props { auth: Auth; onClose: () => void; }
export function AuthModal({ auth, onClose }: Props)
```

Port the prototype's glass modal chrome (fixed overlay `bg-[#05040c]/80 backdrop-blur-md`, `glass-panel rounded-3xl border border-cyan-400/30`, lucide `UserCheck`/`X` icons, cyan CTA button). Replace its fake localStorage form with AuthBar's real behavior, restyled:
- signed-in state: email display + rose "Sign Out" button calling `auth.signOut()` then `onClose()`.
- signed-out: mode toggle signin/signup, email+password inputs (prototype input styling: `bg-[#0b0918] border border-indigo-500/30 rounded-xl px-3 py-2.5`), submit calls `auth.signIn`/`auth.signUp`; on signup success show notice "Check your email to confirm your account."; on signin success `onClose()`. Google button (`auth.signInWithGoogle`) styled as secondary glass button. Error text in rose, notice in cyan. Escape key + overlay click close (stopPropagation on card). Keep `role="dialog" aria-modal="true"`.

- [ ] **Step 2: Verify** — `npm run build` passes (component not yet mounted; App wiring comes in Task 8).

- [ ] **Step 3: Commit** — `feat: glass AuthModal wrapping real Supabase auth flows`

---

### Task 4: Header shell

**Files:**
- Create: `src/components/Header.tsx`, `src/components/Header.test.tsx`
- Visual source: `nocturne-chess-reviewer/src/components/Header.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
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
```

- [ ] **Step 2: Run** `npm test -- Header` — expect FAIL.

- [ ] **Step 3: Implement** — port prototype Header markup verbatim (sticky glass header, brand tile ♞ with cyan-indigo gradient, "Stockfish v14" chip → change copy to `Stockfish · depth 14`, tab pills, auth button with `UserCheck` icon). Props per test above (`userEmail` instead of prototype's `currentUser`; `authEnabled` gates the auth button since `useAuth().enabled` can be false).

- [ ] **Step 4: Run** `npm test -- Header` — expect PASS.

- [ ] **Step 5: Commit** — `feat: Nocturne tabbed header shell`

---

### Task 5: ImportSection + AnalysisProgress

**Files:**
- Create: `src/components/ImportSection.tsx`, `src/components/AnalysisProgress.tsx`
- Delete (in Task 8 when unmounted): `src/components/ImportPanel.tsx`
- Visual sources: `nocturne-chess-reviewer/src/components/ImportSection.tsx`, `.../AnalysisProgress.tsx`

- [ ] **Step 1: Implement `ImportSection.tsx`**

```ts
import type { GameSource } from '../supabase/mapReview';
interface Props { onPgn: (pgn: string, source: GameSource) => void; }
```

Port the prototype hero (badge chip, gradient headline "See your game the way the engine sees it.", copy paragraph, three quick-demo chips) and the 3-column glass card grid. Wiring deltas vs prototype:
- Quick demos: `import { SAMPLE_PGNS } from '../data/samplePgns'` — chip click calls `onPgn(SAMPLE_PGNS[key].pgn, 'paste')`. Labels from the data module.
- chess.com card: real `fetchRecentGames` from `../importers/chesscom`; rows show `#id`, `white vs black`, `date`; click → `onPgn(g.pgn, 'chesscom')`. Enter key in input triggers load (parity with old ImportPanel).
- lichess card: same with `../importers/lichess` and `'lichess'` source.
- Paste card: textarea + "Review This PGN" cyan CTA → `onPgn(pgn, 'paste')`, disabled when empty.
- One shared error banner (rose, `AlertCircle`) fed by fetch failures; PGN parse errors stay App-level (App owns `error`).
- Loading states per card with `Loader2` spinner, single `loading` lock like old ImportPanel so both fetches can't race.

- [ ] **Step 2: Implement `AnalysisProgress.tsx`** — port prototype verbatim; props `{ label: string; pct: number }` (real progress is a message string + percent, not d/t counts — render `label` where the prototype rendered "Position X of Y" and `pct`% in the bar and readout). Keep pulsing `Cpu` tile and spinner footer line "Computing move classifications and coach insights...".

- [ ] **Step 3: Verify** — `npm run build` green.

- [ ] **Step 4: Commit** — `feat: Nocturne import hero + analysis progress panel`

---

### Task 6: Board deck — flip support, player cards, playback bar, keyboard

**Files:**
- Modify: `src/components/ReviewBoard.tsx`, `src/components/EvalBar.tsx`
- Create: `src/components/PlayerCard.tsx`, `src/components/PlaybackControls.tsx`, `src/hooks/useReviewShortcuts.ts`, `src/hooks/useReviewShortcuts.test.ts`
- Visual source: `nocturne-chess-reviewer/src/components/PlaybackControls.tsx`, review-tab player cards in `nocturne-chess-reviewer/src/App.tsx:170-260`

- [ ] **Step 1: Failing test for the shortcut hook**

```ts
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useReviewShortcuts } from './useReviewShortcuts';

function press(key: string, target?: Partial<EventTarget>) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true });
  if (target) Object.defineProperty(ev, 'target', { value: target });
  window.dispatchEvent(ev);
}

describe('useReviewShortcuts', () => {
  const make = () => {
    const h = { onPrev: vi.fn(), onNext: vi.fn(), onStart: vi.fn(), onEnd: vi.fn(), onToggleAutoplay: vi.fn(), onFlip: vi.fn() };
    renderHook(() => useReviewShortcuts(true, h));
    return h;
  };

  it('maps keys to actions', () => {
    const h = make();
    press('ArrowLeft'); expect(h.onPrev).toHaveBeenCalled();
    press('ArrowRight'); expect(h.onNext).toHaveBeenCalled();
    press('Home'); expect(h.onStart).toHaveBeenCalled();
    press('End'); expect(h.onEnd).toHaveBeenCalled();
    press(' '); expect(h.onToggleAutoplay).toHaveBeenCalled();
    press('f'); expect(h.onFlip).toHaveBeenCalled();
  });

  it('ignores keys while typing in inputs', () => {
    const h = make();
    press('ArrowLeft', { tagName: 'TEXTAREA' } as any);
    expect(h.onPrev).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const h = { onPrev: vi.fn(), onNext: vi.fn(), onStart: vi.fn(), onEnd: vi.fn(), onToggleAutoplay: vi.fn(), onFlip: vi.fn() };
    renderHook(() => useReviewShortcuts(false, h));
    press('ArrowLeft');
    expect(h.onPrev).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** `npm test -- useReviewShortcuts` — FAIL.

- [ ] **Step 3: Implement `useReviewShortcuts.ts`**

```ts
import { useEffect } from 'react';

export interface ShortcutHandlers {
  onPrev: () => void; onNext: () => void; onStart: () => void; onEnd: () => void;
  onToggleAutoplay: () => void; onFlip: () => void;
}

export function useReviewShortcuts(enabled: boolean, h: ShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); h.onPrev(); break;
        case 'ArrowRight': e.preventDefault(); h.onNext(); break;
        case 'Home': e.preventDefault(); h.onStart(); break;
        case 'End': e.preventDefault(); h.onEnd(); break;
        case ' ': e.preventDefault(); h.onToggleAutoplay(); break;
        case 'f': case 'F': e.preventDefault(); h.onFlip(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, h.onPrev, h.onNext, h.onStart, h.onEnd, h.onToggleAutoplay, h.onFlip]);
}
```

- [ ] **Step 4: Run** `npm test -- useReviewShortcuts` — PASS.

- [ ] **Step 5: Flip support** — `ReviewBoard`: add `orientation?: 'white' | 'black'` prop; pass at init (`Chessground(el, { fen, viewOnly: true, coordinates: true, orientation })`) and include `orientation` in the `api.current?.set({...})` effect (add to dep array). `EvalBar`: add `flipped?: boolean`; when flipped, render black fill from bottom instead (swap the two divs' order and heights: white on top `100-whitePct`, black bottom `whitePct` — simplest is `<div className={flipped ? 'evalbar flipped' : 'evalbar'}>` plus a small index.css rule `.evalbar.flipped { transform: scaleY(-1); } .evalbar.flipped .num { transform: scaleY(-1); }`).

- [ ] **Step 6: `PlayerCard.tsx`** — glass row card per prototype App.tsx (piece tile ♚/♔, name, Elo line, right-aligned cyan accuracy `NN.N% Acc`):

```ts
interface Props { name: string; elo: number | null; accuracy: number | null; color: 'white' | 'black'; }
```

Accuracy shown only when review exists (null hides the pill). Piece tile: black `bg-[#120f26] border-slate-600 text-white`, white `bg-[#edf0fc] border-white text-[#05040c]`.

- [ ] **Step 7: `PlaybackControls.tsx`** — port prototype bar chrome; controlled props (no internal timer — App owns autoplay):

```ts
type Speed = 'off' | 'slow' | 'medium' | 'fast';
interface Props {
  ply: number; total: number; onSelectPly: (ply: number) => void;
  speed: Speed; onCycleSpeed: () => void;
  flipped: boolean; onToggleFlip: () => void;
  soundOn: boolean; onToggleSound: () => void;
  voiceOn: boolean; onToggleVoice: () => void;
  volume: number; onVolume: (v: number) => void;
}
```

Buttons: SkipBack→`onSelectPly(0)` (disabled at 0), ChevronLeft→`ply-1`, autoplay pill (Play/Pause + label `Autoplay`/`×½`/`×1`/`×2` from speed)→`onCycleSpeed`, ChevronRight→`ply+1` (disabled at total), SkipForward→`onSelectPly(total)`. Right group: RotateCw flip (amber when flipped), Volume2/VolumeX sound toggle, volume range slider (`accent-cyan-400`), Mic/MicOff voice toggle, ply counter `ply / total`. All titles mention the shortcut keys.

- [ ] **Step 8: Run** `npm test && npm run build` — all green (new components unmounted yet).

- [ ] **Step 9: Commit** — `feat: board deck components — flip, player cards, playback bar, shortcuts`

---

### Task 7: Right-column cards — CoachCard, MoveList, Breakdown + EvalGraph cards

**Files:**
- Modify: `src/components/CoachCard.tsx`, `src/components/MoveList.tsx`, `src/components/SummaryPanel.tsx`
- Create: `src/components/EvalGraphCard.tsx`
- Visual sources: prototype `CoachCard.tsx`, `MoveListPanel.tsx`, `BreakdownTable.tsx`, `EvalGraphCard.tsx`

- [ ] **Step 1: CoachCard restyle** — keep the entire existing component contract (`opening, evalCp, move, voiceOn`, auto-speak effect, speak button) and re-skin markup to prototype: glass card with per-classification glow blob (`CLASS_META[move.cls].hex` at 20% opacity blur), header row (♞ tile, "Engine Coach" label, opening chip `eco · name`, eval pill emerald/rose/neutral via `formatEval`), classification chip row (`meta.sym meta.label` on `meta.hex` background, `#05040c` text), played-vs-best mono row (kept conditional: wantsBetter shows both, isGood shows "You found the best move", neutral shows played), explanation paragraph, speak button as prototype's rounded icon button. Empty state: prototype's "Select a move…" line but with existing copy "Step through the game to see each move reviewed."

- [ ] **Step 2: MoveList restyle** — keep pairing logic and `current`/`onSelect` contract (active = `current === ply.index + 1`); re-skin rows to prototype `MoveListPanel` (mono grid `[40px_1fr_1fr]`, per-move pill buttons with cyan active glow, classification chip per move using `CLASS_META`). Add the prototype's auto-scroll (`scrollIntoView({ behavior: 'smooth', block: 'nearest' })` on the active ref, keyed by `current`). Wrap in the prototype panel chrome: header "Game Move List" + `ply / total Plies` counter, `h-[280px]` scroll body. Counter comes from new props `ply: number; total: number` (pass from App).

- [ ] **Step 3: SummaryPanel → breakdown card** — re-skin to prototype `BreakdownTable`: header "Move Classification Breakdown", `[1fr_50px_50px]` grid rows with `CLASS_META` chips, truncated player names in the column heads. Keep the accuracy row (white/result/black with est ratings) as a glass sub-card above the table — the prototype dropped it, but it carries real info (est rating, result); style it with prototype tile classes (`bg-indigo-950/50 rounded-2xl` tiles like the reveal overlay's accuracy cards). Drop the `children` slot (MoveList moves out to the review grid) — update the interface: `{ summary, white, black, ratings, result }` only.

- [ ] **Step 4: `EvalGraphCard.tsx`** — new thin wrapper: prototype card chrome (header "Evaluation History", subtitle "White advantage (+10) / Black advantage (-10)") around the existing `<EvalGraph />` (unchanged custom SVG, keeps classification dots + click-to-seek):

```tsx
import { EvalGraph } from './EvalGraph';
interface Props {
  evalsCp: number[]; classifications: import('../chess/types').Classification[];
  current: number; onSelect: (i: number) => void;
}
export function EvalGraphCard(p: Props) { /* glass card chrome + <EvalGraph {...p} /> */ }
```

- [ ] **Step 5: Fix any broken component tests** — run `npm test`; update markup assertions in existing tests that referenced old classes/text (do not weaken behavioral assertions). Expected suspects: none for RevealOverlay/TrendsDashboard (untouched); MoveList/SummaryPanel have no dedicated test files today — verify.

- [ ] **Step 6: Run** `npm test && npm run build` — green.

- [ ] **Step 7: Commit** — `feat: Nocturne right-column cards — coach, move list, breakdown, eval graph`

---

### Task 8: App shell rewrite

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/ImportPanel.tsx`, `src/components/AuthBar.tsx`
- Visual source: `nocturne-chess-reviewer/src/App.tsx` (layout only)

- [ ] **Step 1: State mapping** — replace `showImport`/`view` with:

```ts
type Tab = 'import' | 'review' | 'library';
const [tab, setTab] = useState<Tab>('import');
const [flipped, setFlipped] = useState(false);
const [showAuth, setShowAuth] = useState(false);
```

Rules preserved from old behavior:
- analysis completes (`run` success) → `setTab('review')` + `setShowReveal(true)` (old `setShowImport(false)`).
- `openSaved` success → `setTab('review')`; failure → error + `setTab('import')`.
- sign-out while on library → `useEffect(() => { if (!auth.user) setTab((t) => (t === 'library' ? 'import' : t)); }, [auth.user])` — but keep library itself reachable signed-out (it renders a sign-in prompt; only force-leave if you prefer parity — choose: keep user on library with prompt, so drop the force-leave effect and delete the old one).
- "New Import" tab click while a review exists does NOT clear the review (review tab stays available) — old `↺ New game` behavior improves: analysis state persists across tab switches.
- `run()` should also `setFlipped(false)` on new game.

- [ ] **Step 2: Render tree**

```tsx
<div className="min-h-screen flex flex-col relative">
  <Header activeTab={tab} onSelectTab={setTab} hasActiveReview={!!review}
    authEnabled={auth.enabled} userEmail={auth.user?.email ?? null}
    onOpenAuth={() => setShowAuth(true)} />
  <main className="flex-1 w-full pb-16">
    {progress && !review ? <AnalysisProgress label={progress} pct={progressPct} /> : null}
    {error && tab !== 'library' && <ErrorBanner …/>}
    {autoScore && <slim glass auto-score strip (keep old .status markup or restyle with tailwind)/>}
    {tab === 'import' && !progress && <ImportSection onPgn={run} />}
    {tab === 'review' && game && fen && !progress && (
      <review deck, below>
    )}
    {tab === 'library' && (auth.user
      ? <LibraryView user={auth.user} onOpen={openSaved} onClose={() => setTab('import')} />
      : <signed-out glass prompt card with "Sign In & Enable Sync" button → setShowAuth(true)>)}
  </main>
  {showReveal && game && review && <RevealOverlay … (unchanged) />}
  {showAuth && auth.enabled && <AuthModal auth={auth} onClose={() => setShowAuth(false)} />}
</div>
```

Review deck (two columns, `max-w-7xl mx-auto px-4 sm:px-6 py-6`, `grid lg:grid-cols-12 gap-6 items-start`; left `lg:col-span-6`, right `lg:col-span-6`):
- Left: `PlayerCard` (top = flipped ? white : black), board row (`EvalBar cp={currentWhiteCp} flipped={flipped}` + framed `ReviewBoard fen lastMove badge arrow checkSquare orientation={flipped ? 'black' : 'white'}` inside the glass board frame, keeping `boardRef` fx classes + touch swipe handlers), `PlayerCard` (bottom), `PlaybackControls` wired to `ply/total/setPly/autoplaySpeed/handleAutoplay/flipped/setFlipped/soundOn/voiceOn/volume/handleVolume`.
- PlayerCard accuracy: white card `review.summary.whiteAccuracy`, black card `review.summary.blackAccuracy`, `null` while `!review`. Elo from `ratings`.
- Right: `CoachCard` (existing props), `MoveList plies current=ply onSelect=setPly ply={ply} total={total}`, then `grid sm:grid-cols-2 gap-4` with `SummaryPanel` + `EvalGraphCard evalsCp={whiteEvals} classifications={classifications} current={Math.max(0, ply-1)} onSelect={(i) => setPly(i+1)}`.
- While `!review && progress` on review tab: keep skeleton cards.

Shortcuts: `useReviewShortcuts(tab === 'review' && !!review, { onPrev: () => setPly(p => Math.max(0, p-1)), onNext: () => setPly(p => Math.min(total, p+1)), onStart: () => setPly(0), onEnd: () => setPly(total), onToggleAutoplay: handleAutoplay, onFlip: () => setFlipped(f => !f) })` — wrap handlers in `useCallback` to keep the hook's effect stable.

Keep untouched: all effects (auto-review, sync queue, flush-on-login, autoplay timer, sound-on-ply, persisted toggles), memos (`fen/playedPly/lastMove/badge/arrow/checkSq/boardFx/currentMove/whiteEvals/classifications/currentWhiteCp`).

- [ ] **Step 3: Delete** `src/components/ImportPanel.tsx` and `src/components/AuthBar.tsx`; remove their imports.

- [ ] **Step 4: Run** `npm test && npm run build && npm run lint` — green.

- [ ] **Step 5: Smoke in browser** — `npm run dev`, Playwright: load landing, click "Immortal Game (1851)" chip, wait for AnalysisProgress then reveal overlay, close it, review deck renders; arrows/space/f keys work; screenshots.

- [ ] **Step 6: Commit** — `feat: Nocturne app shell — tabbed layout, review deck, flip + shortcuts`

---

### Task 9: LibraryView → Nocturne dashboard

**Files:**
- Modify: `src/components/LibraryView.tsx` (+ light container restyles in `src/components/ReportsView.tsx`, `src/components/TrendsView.tsx` only if their wrappers clash visually)
- Visual source: `nocturne-chess-reviewer/src/components/DashboardView.tsx`

- [ ] **Step 1: Restyle LibraryView** — keep all logic (fetchLibrary/fetchProfile/saveProfile, tab state, `onOpen`). New chrome:
- Profile header card: prototype's glass banner (♞ gradient tile, `profile.display_name ?? user.email`, "N saved game reviews" count from `rows?.length ?? 0`) + sub-tab pill switcher (`Games (N)` with Library icon / `Weakness Reports` with amber AlertTriangle / `Trends` with emerald TrendingUp).
- Games tab: profile form as glass card (three inputs + Save, prototype input styling, "Profile saved." notice); rows list in prototype row style (players + ratings, opening chip, accuracy `W: x% | B: y%` cyan, result, date; hover cyan). Empty state copy preserved. Loading skeleton kept.
- Reports/Trends tabs: render existing `<ReportsView user={user} />` / `<TrendsView user={user} />` unchanged inside `max-w-6xl` containers.
- Remove the old `← Back` button (Header tabs handle navigation; keep `onClose` prop wired to nothing visible or drop prop — drop it and update App).

- [ ] **Step 2: Run** `npm test && npm run build` — green. Playwright screenshot of library signed-out prompt (Supabase paused → signed-out is the reachable state).

- [ ] **Step 3: Commit** — `feat: Nocturne library dashboard chrome`

---

### Task 10: CSS pruning + polish pass

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Prune dead selectors** — grep each of these old-UI selector families and delete the ones no longer referenced by any tsx: `.topbar .brand .tagline .lib-btn .authbar .auth-overlay .auth-modal .auth-google .auth-switch .hero .eyebrow .grad .gamebar .gamebar-title .card.import .col .games .game-item .li-col .li-logo .status .status-bar .status-text .dot .pct` (status stays if the auto-score strip still uses it), `.library-head .lib-tabs .seg .seg-btn .library-row .library-list .library-empty .profile-card .profile-fields .panel-card .acc-row .breakdown .bd-head .bd-row .movelist .move-row .move-cell .playback .auto-btn .speed-label .vol-slider .icon-btn .ply .review-grid .board-col .panel` — KEEP anything still used (check each with grep before deleting; `.card`, `.skel`, `.err`, `.evalbar*`, `.coach*` classes that survived restyles, chessground/board/fx/reveal/trends/reports selectors stay).
- [ ] **Step 2: Add the two new rules** — `.evalbar.flipped` pair from Task 6.
- [ ] **Step 3: Run** `npm test && npm run build`; Playwright screenshot sweep (landing, review, reveal, library, mobile 390×844) comparing for visual breakage.
- [ ] **Step 4: Commit** — `refactor: prune dead pre-Nocturne CSS`

---

### Task 11: Final gates + browser verification

- [ ] **Step 1:** `npm test` — all pass (150 + new).
- [ ] **Step 2:** `npm run build` — clean.
- [ ] **Step 3:** `npm run lint` — clean.
- [ ] **Step 4: Full Playwright E2E sweep** against `npm run dev`:
  1. Landing: hero + 3 cards + demo chips render; screenshot.
  2. Click demo chip → AnalysisProgress panel with moving % → reveal overlay (staged) → close → review deck: player cards, board with pieces, eval bar, playback bar, coach card, move list, breakdown, eval graph; screenshot.
  3. Keyboard: ArrowRight ×3 advances ply counter; F flips (player cards swap); Space starts autoplay (pause icon).
  4. Click a move in the move list → board updates; click eval graph → seeks.
  5. New Import tab → paste garbage PGN → rose diagnosable error.
  6. Library tab (signed out) → sign-in prompt card; auth button → AuthModal renders (submit not testable, Supabase paused).
  7. Mobile 390×844: landing + review deck stack correctly; screenshot.
- [ ] **Step 5:** Fix anything found; re-run gates. Commit fixes.

---

### Task 12: Remove prototype folder, docs, merge

- [ ] **Step 1:** Delete `nocturne-chess-reviewer/` entirely.
- [ ] **Step 2:** Update `README.md` if it references the old UI structure (screenshots/feature list) — mention tabbed Nocturne UI, keyboard shortcuts, board flip, sample demos.
- [ ] **Step 3:** `npm test && npm run build` one last time (proves no accidental imports from the deleted folder).
- [ ] **Step 4:** Commit — `feat: adopt Nocturne front-end structure; remove design prototype folder`
- [ ] **Step 5:** Merge `nocturne-structural` → `main` (`git checkout main && git merge --no-ff nocturne-structural -m "merge: Nocturne structural front-end adoption"`) and `git push`.

---

## Self-review notes

- Spec coverage: shell/tabs (T4,8), auth modal (T3), import hero+demos (T2,5), progress (T5), review deck+flip+shortcuts (T6,8), right column (T7), library dashboard (T9), CSS prune (T10), gates+browser (T11), folder removal+merge (T12). Tailwind decision (T1). RevealOverlay/EvalGraph/Trends/Reports intentionally untouched per spec.
- Types cross-checked against real sources read on 2026-07-22: `Auth` (useAuth.ts), `CLASS_META/CLASS_ORDER` (classMeta.ts), `EvalBar {cp}`, `ReviewBoard` props, App state (`ply` 0..total inclusive), `GameSource`, LibraryView props. Implementers MUST re-read `src/chess/types.ts` and `src/analysis/assemble.ts` before Task 7/8 for exact `AnalyzedPly`/`ReviewSummary` fields.
