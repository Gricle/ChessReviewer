# Nocturne structural adoption — design

**Date:** 2026-07-22
**Source of truth for visuals:** `nocturne-chess-reviewer/` (AI Studio prototype, deleted after adoption)

## Background

The Jul 20 "Nocturne" redesign (e6970bd) ported the prototype's *skin* — design tokens,
aurora backdrop, glass surfaces, type — onto the existing markup, preserving every
selector. The prototype's actual UI structure was never adopted: tabbed header shell,
hero import screen with import cards, full-screen analysis progress, two-column review
deck with player cards, playback control bar, breakdown/eval-graph card pair, library
dashboard with sub-tabs, and a glass auth modal.

This project adopts that structure as the app's front-end while keeping **all** real
logic. The prototype's `services/` directory is mock throwaway code and is not ported.

## Goals

- The app's rendered UI matches the prototype's layout and component design.
- Zero functional regression: engine analysis, importers, auto-review on login,
  Supabase sync/library/profile, reports, trends, coach voice, sounds, reveal overlay.
- New capabilities the prototype introduces are ported for real:
  keyboard shortcuts (← → Home End Space F), board flip, sample-game quick demos,
  full-screen analysis progress panel.
- All tests pass; build and lint green; browser-verified with Playwright.
- `nocturne-chess-reviewer/` removed at the end.

## Non-goals

- No engine/analysis/classification changes.
- No new backend or schema work. Supabase project is currently **paused** — cloud
  flows are verified at unit/build level only, not live.
- No recharts, no motion (framer) — see decisions.

## Architecture decisions

1. **Tailwind CSS v4 + lucide-react are added.** Prototype components are written in
   Tailwind utility classes; porting them as-is is cheaper and higher-fidelity than
   transliterating to the plain-CSS system. Vite gains `@tailwindcss/vite`.
   `src/index.css` keeps the token block, aurora/body layers, chessground/board
   styles, fx animations, and styles for components that remain plain-CSS
   (RevealOverlay, EvalGraph, TrendsDashboard, ReportsView internals). Dead selectors
   for replaced components are pruned. Import order: Tailwind first, `index.css`
   second; every view is screenshot-verified to catch preflight clashes. If preflight
   breaks legacy components, fall back to importing Tailwind theme+utilities without
   preflight.
2. **No recharts / no motion.** Existing custom `EvalGraph` and `TrendsDashboard` are
   tested, themed, and show real data (the prototype's trends/reports hardcode fake
   copy). They are re-housed inside the prototype's glass-card containers. The
   existing `RevealOverlay` keeps its tested staged reveal + audio; CSS animations
   already cover the pop-in that the prototype used motion for.
3. **chessground stays.** The prototype's text-glyph board is inferior (no proper
   pieces, arrows, or drag). `ReviewBoard` gains an `orientation` prop for flip; the
   board is framed per the prototype (rounded glass frame) with player cards above and
   below showing name, Elo, and accuracy pill; cards swap with flip.
4. **Component mapping** (new/replaced in `src/components/`):
   - `Header.tsx` (new) — brand + Stockfish chip + tabs (`Active Review` when a review
     exists, `New Import`, `Library & Trends`) + auth button. Replaces `.topbar` and
     inline AuthBar placement.
   - `AuthModal.tsx` (new, replaces `AuthBar.tsx`) — prototype's glass modal wrapping
     the **real** auth flows: email/password signin/signup, Google OAuth, signed-in
     state with email + sign-out. Keeps `useAuth`.
   - `ImportSection.tsx` (replaces `ImportPanel.tsx`) — hero (badge, gradient
     headline, copy, quick-demo chips) + 3 glass import cards (Paste PGN /
     chess.com / lichess) wired to real importers with `GameSource` and real error
     surfacing. Quick demos come from a new `src/data/samplePgns.ts` (Immortal Game
     1851, Opera Game 1858, a blunder-rich game) — real PGNs that must parse.
   - `AnalysisProgress.tsx` (new) — full-screen glass progress panel driven by the
     real `analyzeGame` progress callback (position d/t, %). Replaces the thin status
     strip during a foreground analysis. The background auto-score strip stays as a
     slim glass banner.
   - `PlaybackControls.tsx` (new) — prototype bar: start/prev/autoplay/next/end,
     flip, sound mute, volume slider, voice mute, ply counter. Wired to existing
     `sound.ts` and App autoplay state (`off/slow/medium/fast` cycle retained).
     Adds global keyboard shortcuts (← → Home End Space F; ignored while typing).
   - `CoachCard.tsx` — restyled to prototype layout (glow accent, eval pill,
     classification chip, played-vs-best row, comment); keeps existing props/logic,
     voice controls move to PlaybackControls but per-move "speak" button stays.
   - `MoveList.tsx` — restyled to the prototype's paired-move panel with
     classification chips and auto-scroll (logic kept).
   - `SummaryPanel.tsx` → breakdown content becomes `BreakdownTable`-styled card;
     the summary/breakdown + `EvalGraphCard` (existing EvalGraph in the prototype's
     card chrome) render side-by-side under CoachCard/MoveList in the right column.
   - `LibraryView.tsx` — restyled to prototype `DashboardView`: profile header card
     (avatar tile, name, count) + sub-tab pill switcher (Games / Weakness Reports /
     Trends); games list rows in prototype style with real `LibraryRow` data; profile
     form as a glass card; Reports/Trends tabs render the real `ReportsView` /
     `TrendsView` in restyled containers. Library tab is always visible; when signed
     out it shows a sign-in prompt card (button opens AuthModal).
5. **App.tsx** re-renders to the new shell: `activeTab: 'import' | 'review' |
   'library'` derived from/replacing `showImport`/`view`. All effects and handlers
   (auto-review on login, sync queue, autoplay, sounds, touch swipe) are preserved.
   Board flip state is new. Review tab auto-activates when analysis completes.
6. **Cleanup:** remove `@fontsource/outfit` (unused since the reskin), delete
   `ImportPanel.tsx`, `AuthBar.tsx`, dead CSS selectors, and finally the
   `nocturne-chess-reviewer/` folder.

## Error handling

- PGN/import/engine errors keep their current diagnosable messages, rendered in the
  prototype's rose error banner.
- Auth errors render inside AuthModal exactly as AuthBar did (error / notice lines).
- localStorage access stays guarded (`safeStorageGet/Set`).

## Testing

- All existing tests must pass; component tests whose markup assertions break
  (RevealOverlay untouched; MoveList/SummaryPanel/TrendsDashboard if asserted) are
  updated to the new markup, not weakened.
- New tests: samplePgns parse via `parsePgn`; keyboard-shortcut handler unit test
  (maps keys → actions, ignores inputs); flip orientation mapping; Header tab
  visibility rules (review tab only with review, library prompt when signed out).
- Gates: `npm test`, `npm run build`, `npm run lint` all green.
- Browser verify (Playwright): landing/import, quick-demo analysis end-to-end
  (progress panel → reveal → review deck), playback + flip + keyboard, library
  signed-out prompt, mobile viewport. Screenshot pass for visual regressions in
  legacy-styled components (reveal overlay, trends, reports).

## Rollout

Work happens on a branch; merge to `main` and push once every gate is green;
`nocturne-chess-reviewer/` is deleted in the final commit.
