# ChessReviewer — Design Spec

**Date:** 2026-06-24
**Status:** Approved (design phase)

## Summary

A hosted, browser-only web app that reviews a chess game move-by-move, in the
style of chess.com's "Game Review." Analysis runs entirely client-side using
Stockfish compiled to WebAssembly. There is no backend, no API key, and no
per-use cost. The app itself uses zero LLM tokens at runtime — all analysis is
engine-based.

## Scope

**In scope (v1):**
- Game Review only (no playing, no puzzles, no accounts).
- Import a game three ways:
  1. chess.com **username** → fetch recent games → user picks one.
  2. Paste **PGN** text.
  3. Paste a chess.com **game URL** and resolve it to a PGN.
- Engine-only analysis (Stockfish WASM). No AI/natural-language commentary.
- Move classification using the "core set" of chess.com-style labels.
- Per-player accuracy %, evaluation graph, best-move arrows, opening detection.

**Out of scope (v1):**
- Playing against the engine, bots, puzzles, openings trainer.
- User accounts, saved games, social features.
- AI coach commentary (natural-language explanations).
- Native mobile apps.
- Exact replication of chess.com's proprietary "Brilliant"/"Miss" detection.

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | TypeScript | One language across UI + logic; strong chess ecosystem |
| Framework | React + Vite | Fast dev, standard, easy static deploy |
| Engine | Stockfish (WASM) in a Web Worker | Same engine family chess.com uses; runs in-browser; never blocks UI |
| Chess logic | chess.js | PGN parsing, legal moves, FEN generation |
| Board UI | chessground | Drag/drop, arrows, highlights (Lichess board) |
| Tests | Vitest | Fast unit testing for pure functions |
| Hosting | Vercel/Netlify free tier | Static site, no backend, no running cost |

No backend is required. chess.com's public Published-Data API is CORS-enabled,
so the browser can fetch game archives directly.

## chess.com Import — Technical Note

chess.com's public API does **not** officially expose "fetch one game by ID."
It exposes a player's **monthly game archives**:

```
GET https://api.chess.com/pub/player/{username}/games/archives
GET https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}
```

Each archived game includes its full PGN and its game URL (which contains the
ID). Therefore:

- **Username flow:** fetch the most recent monthly archive(s), list games
  (opponents, date, result), let the user pick one. Use that game's PGN.
- **Game URL flow:** parse the username/month if derivable, or instruct the
  user to use the username flow. If a URL maps cleanly to an archive entry,
  match by URL/ID within the fetched archive.
- **PGN flow:** no network needed; parse directly.

The username and PGN flows are the reliable primary paths; the URL flow is a
convenience that resolves through the archive when possible.

## Core Flow

```
Import → Parse PGN → Analyze each position (Stockfish) → Classify moves
       → Compute accuracy → Detect opening → Render review
```

1. Obtain a PGN string (from any import path).
2. Parse PGN into an ordered list of plies: each with the FEN before the move,
   the move played (SAN/UCI), and side to move.
3. For each position, run Stockfish to a fixed depth and record:
   - the engine's best move and its evaluation,
   - the second-best move's evaluation (needed for "Great"),
   - the evaluation of the position after the move actually played.
4. Classifier assigns a label to each move from the eval data.
5. AccuracyCalculator converts evaluations to win% and produces per-move
   accuracy, then per-player game accuracy.
6. OpeningDetector tags the opening and "Book" moves.
7. UI renders: board with arrows, move list with icons, eval graph, summary.

## Components

Each component has one clear job and a well-defined interface. Pure-logic
components take data in and return data out (no side effects), making them
independently testable.

| Component | Responsibility | Notes |
|-----------|----------------|-------|
| **ImportPanel** | Provide the three import paths and hand a PGN to the app | UI + chess.com fetch |
| **PgnParser** | PGN string → ordered list of positions (FEN) + moves | Pure; wraps chess.js |
| **EnginePool** | Manage the Stockfish worker; analyze a position to fixed depth; return best move, eval, 2nd-best eval, and played-move eval | Async; worker lifecycle |
| **Classifier** | positions + eval data → a label per move | **Pure function** |
| **AccuracyCalculator** | win%-based per-move accuracy → per-player game accuracy | **Pure function** |
| **OpeningDetector** | Match move sequence against bundled ECO database → opening name + Book plies | Pure; bundled data |
| **ReviewBoard** | Play through moves; draw best-move arrows; highlight squares | chessground wrapper |
| **MoveList** | Show moves with classification icons; click to jump | UI |
| **EvalGraph** | Plot evaluation across the game; click a point to jump | UI |
| **SummaryPanel** | Per-player accuracy + count of each move type + opening name | UI |

## Move Classification (Core Set)

For each move, compute centipawn loss relative to the engine's best move,
then convert evaluations to **win%** (chess.com and Lichess classify by win-%
drop, not raw centipawns):

- **Book** — move appears in the bundled opening database.
- **Best** — matches the engine's top move (≈ zero loss).
- **Excellent / Good** — small win-% drop (within tuned thresholds).
- **Inaccuracy `?!`** — moderate win-% drop.
- **Mistake `?`** — larger win-% drop.
- **Blunder `??`** — large win-% drop.
- **Brilliant `!!`** — a best/near-best move that sacrifices material while the
  position stays winning (heuristic).
- **Great `!`** — the position's only good move: the top move is far better
  than the second-best (heuristic based on the gap between best and 2nd-best).

Win% conversion and accuracy use the published reverse-engineered
Lichess/chess.com curve:

```
winPercent = 50 + 50 * (2 / (1 + exp(-0.00368208 * centipawns)) - 1)
moveAccuracy = clamp(0..100,
  103.1668 * exp(-0.04354 * (winPercentBefore - winPercentAfter)) - 3.1669)
```

Per-player game accuracy is derived from per-move accuracies (weighted by
position volatility, following the published approximation). Exact thresholds
for each label are tuned during implementation against sample games.

This reproduces chess.com's look-and-feel roughly 90% of the time. Their exact
"Brilliant"/"Miss" logic is proprietary and intentionally not chased.

## Engine Configuration

- Stockfish runs to a **fixed depth** per position (e.g. depth 18), tunable.
- A progress indicator shows analysis completion across the game.
- Analysis runs in a Web Worker so the UI stays responsive.

## Error Handling

- **Invalid PGN** → clear inline error, no crash.
- **chess.com fetch failure** (unknown user, rate limit, network) → friendly
  message with retry; never blocks the PGN-paste path.
- **Engine load failure** (WASM unsupported) → detect and show a clear message.
- **Empty/abandoned games** → handle gracefully (e.g. games with no moves).

## Testing

- **Unit tests (Vitest)** for the pure components:
  - PgnParser: known PGNs → expected position/move lists.
  - Classifier: crafted eval inputs → expected labels (including edge cases for
    Brilliant/Great).
  - AccuracyCalculator: known win% inputs → expected accuracy values.
  - OpeningDetector: known opening sequences → expected names + Book plies.
- **End-to-end test:** review a real sample PGN and assert the summary
  (accuracy present, move counts sane, opening detected).

## Deliverables

- A deployable static web app (Vercel/Netlify).
- README with setup, dev, and deploy instructions.
- Bundled Stockfish WASM and ECO opening database.

## Build Plan (high level)

| Phase | Scope |
|-------|-------|
| 1 | Scaffold (Vite + TS + React) + board + PGN import + play-through |
| 2 | Stockfish worker + analyze full game + eval graph |
| 3 | Classifier + accuracy + opening/Book detection + tests |
| 4 | chess.com import + summary panel + polish + deploy |

Detailed step-by-step implementation lives in the implementation plan (next).
