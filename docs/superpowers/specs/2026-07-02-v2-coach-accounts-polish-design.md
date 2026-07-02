# ChessReviewer v2 — Coach, Accounts & Cinematic Polish

**Date:** 2026-07-02
**Status:** Approved design

## Goal

Evolve ChessReviewer from a one-shot game-review tool into a daily
learning-coach app with accounts, game history, cross-game insight, and a
dramatically better look, feel, and sound — while keeping analysis 100%
client-side (Stockfish WASM) and keeping the guest experience free and
instant.

## Architecture

- **Frontend:** existing static Vite + React app. All engine analysis stays
  in the browser (Web Worker, single-threaded Stockfish build). No change to
  hosting (static host / Vercel / GitHub Pages).
- **Backend:** Supabase — Auth (email + Google), Postgres, row-level
  security. No custom server.
- **Guest mode:** full review works without an account; nothing persisted
  beyond the session. Login unlocks saved history, cross-device sync, and
  weakness reports.
- **Sync model:** write-behind. The review renders immediately from local
  analysis; the upload to Supabase happens in the background with a retry
  queue (localStorage). The app never blocks on the network.

## Data model (Postgres, RLS: users only see their own rows)

| Table | Contents |
|---|---|
| `profiles` | user id, display name, linked chess.com / lichess usernames |
| `games` | pgn, white/black names and ratings, result, date, source (paste / chess.com / lichess), opening eco + name |
| `reviews` | per game: accuracy per side, estimated performance rating per side, classification counts, full analysis JSON |
| `move_facts` | one row per move: ply, side, classification, win%-drop, game phase (opening/middlegame/endgame), motif tags |

`move_facts` exists so weakness reports are plain SQL aggregations instead
of client-side crunching over JSON blobs.

Schema and RLS policies live in versioned SQL migration files in the repo.

## Features (phased, each independently shippable)

### Phase 1 — Player ratings + performance rating
- Show both players' ratings (from PGN headers / chess.com / lichess import)
  in the review header and summary panel.
- Estimate a per-side performance rating ("you played like ~1850 in this
  game") from accuracy and the mistake distribution using a calibrated
  curve. Pure math module, unit-tested.

### Phase 2 — Supabase foundation
- Login / signup UI (email + Google), profile page.
- Auto-save every completed review (games, reviews, move_facts) when logged
  in; silent skip when guest/offline.
- Game library page: list past games with result, opening, accuracy;
  search/filter; reopen any past review instantly (no re-analysis).

### Phase 3 — Cinematic review reveal + audio design
- Animated results sequence when analysis completes: accuracy counters tick
  up, classification badges cascade in, performance-rating card flip, sound
  stingers.
- Proper sound set: distinct stingers per classification (brilliant chime,
  blunder thud, …), UI ticks, review-complete fanfare, volume control and
  mute persistence.

### Phase 4 — Board feel + UI redesign
- Board effects: smooth piece glides, capture shake, brilliant-move
  sparkle/glow, check pulse, mate flash, arrow draw-in animations.
- Visual identity pass: refined dark theme, typography, micro-interactions,
  panel transitions, skeleton loaders, mobile gestures.

### Phase 5 — Explain-why coach (rule-based)
- Natural-language explanation per move derived from engine lines and chess
  logic — no LLM, no API key, works offline.
- Detectors: hanging pieces, missed/allowed forks, pins, skewers,
  discovered attacks, missed mates, back-rank weakness, threat
  identification ("the threat was …", "the best move wins material by …").

### Phase 6 — Weakness reports
- Dashboard over accumulated history (SQL over `move_facts` + `reviews`):
  - worst openings by average accuracy,
  - motif types most often missed,
  - phase-of-game where accuracy collapses,
  - accuracy / performance-rating trend over time.

## Error handling

- Guest or offline: app fully functional; sync silently skipped.
- Failed uploads: queued in localStorage, retried with backoff.
- Auth session expiry: re-login prompt without losing the in-progress
  review.
- Engine failures: existing ErrorBoundary + retry behavior unchanged.

## Testing

- Vitest for all pure logic: performance-rating estimator, motif detectors,
  explanation generator, report aggregation shaping — same style as the
  existing `*.test.ts` suites.
- Supabase schema + RLS in versioned migrations; RLS verified with the
  Supabase local dev stack.

## Out of scope (explicitly)

- LLM-based coaching (may be revisited later as an optional BYO-key mode).
- Mistake-drill / spaced-repetition puzzles (future candidate, after the
  library accumulates data).
- Multiplayer / playing chess in-app; this remains a review & training tool.
