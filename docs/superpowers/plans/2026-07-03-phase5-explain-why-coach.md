# Phase 5: Explain-Why Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CoachCard's template sentences with derived, factual explanations: what you hung, what the threat is, what the best move achieves (mate, material, forks), why a brilliant works — all rule-based from chess.js position analysis. Also lands the deferred `motifs` column on move_facts so Phase 6 can aggregate missed-motif stats.

**Architecture:** New `src/coach/` with two pure TDD'd modules. `motifs.ts`: position detectors built on chess.js (`hangingPieces` using `attackers()`, `forkTargets`, `isMateScore`). `explain.ts`: `explainMove(ply, ctx)` composes a 1-2 sentence explanation by priority (missed mate > hung piece > threat > motif > generic), where ctx carries `bestSan`, `nextBestSan` (= the NEXT ply's bestMoveUci converted to SAN — that IS the opponent's best reply at fenAfter), and detector results. CoachCard swaps its `description()` for an `explanation` prop computed in an App memo (only for the current ply — cheap). Finally `mapReview` tags per-ply `motifs: string[]` and a migration adds the column.

**Tech Stack:** existing (chess.js 1.4 — it HAS `attackers(square, color)`; verify signature in node_modules/chess.js if unsure). No new deps.

**Key facts for implementers:**
- Baseline: 93 tests / 19 files. Conventions as all prior phases (TDD red→green, surgical edits, gates: test/build/lint with the 2 accepted App.tsx exhaustive-deps warnings).
- `AnalyzedPly` = Ply + { bestMoveUci, evalBeforeCp (mover perspective), evalAfterCp (mover perspective), classification, accuracy }. Mate is encoded as ±32000 in cp. `uciToSan(fen, uci)` exists in src/chess/san.ts. Piece values: p1 n3 b3 r5 q9.
- Opponent's best reply to ply i = review.plies[i+1]?.bestMoveUci at fen = ply i's fenAfter (last ply has none → null).
- CoachCard currently builds text via `description(move)` (src/components/CoachCard.tsx) from `CurrentMove { san, cls, bestSan, isBest }`; the speech synthesis reads the same string — keep that wiring, just feed it the richer text.

---

### Task 1: motif detectors (pure, TDD)

**Files:** Create `src/coach/motifs.ts` + `src/coach/motifs.test.ts`.

API contract (implement exactly; craft FENs carefully and VERIFY each with chess.js before asserting):

```ts
export interface HangingPiece { square: string; type: 'p'|'n'|'b'|'r'|'q'; }
/** Pieces of `color` capturable for free or by a cheaper attacker. Excludes kings. */
export function hangingPieces(fen: string, color: 'w' | 'b'): HangingPiece[]
/** Squares of enemy pieces worth ≥ the mover (or the king) attacked by the piece that lands via uci; a fork = 2+ results. */
export function forkTargets(fenBefore: string, uci: string): string[]
/** True when a mover-perspective cp encodes a forced mate for the mover. */
export function isMateScore(cp: number): boolean  // cp >= 31000
/** True when it encodes being mated. */
export function isMatedScore(cp: number): boolean // cp <= -31000
```

Tests (~8): hanging undefended piece detected; defended piece attacked by cheaper piece detected; defended piece attacked only by equal/greater value NOT hanging; kings never listed; empty board-side → []; knight fork of king+queen → 2 targets; no fork for a move attacking one target; mate-score helpers at ±31000/±32000/0. Suite target: 101/101.

Commit: `feat: coach motif detectors - hanging pieces, forks, mate scores`

---

### Task 2: explanation composer (pure, TDD)

**Files:** Create `src/coach/explain.ts` + `src/coach/explain.test.ts`.

```ts
import type { AnalyzedPly } from '../chess/types';
export interface ExplainCtx {
  bestSan: string;             // SAN of ply.bestMoveUci at fenBefore
  nextBestSan: string | null;  // opponent's best reply (SAN at fenAfter), null on last ply
}
export function explainMove(ply: AnalyzedPly, ctx: ExplainCtx): string
```

Priority rules (first match wins for the "why" clause; compose with the classification frame):
1. book → `${san} is a book move — theory continues.`
2. Bad moves (inaccuracy/mistake/blunder), lead `Better was ${bestSan}.` then:
   a. `isMatedScore(ply.evalAfterCp)` and not `isMatedScore(ply.evalBeforeCp)` → `This walks into a forced mate.`
   b. `isMateScore(ply.evalBeforeCp)` and not `isMateScore(ply.evalAfterCp)` → `You had a forced mate and let it slip.`
   c. `hangingPieces(ply.fenAfter, moverColorLetter)` non-empty (piece hung that wasn't hanging in fenBefore — compare squares) → `This leaves your ${pieceName} on ${square} hanging.`
   d. `ctx.nextBestSan` → `The threat is now ${ctx.nextBestSan}.`
   e. fallback per class: blunder `This loses significant ground.` / mistake `This could have been punished.` / inaccuracy `` (lead sentence alone).
3. brilliant → `A stunning sacrifice! ${san} gives up material` + (forkTargets on the PLAYED move ≥2 → ` and sets up a fork` ) + `.`
4. great → `${san} is the only good move here.`
5. best/excellent/good, in order:
   a. played == best and `isMateScore(evalBeforeCp)` → `${san} keeps the forced mate on track.`
   b. `forkTargets(ply.fenBefore, ply.uci).length >= 2` → `${san} forks ${n} pieces.`
   c. best: `${san} is the strongest move.` / excellent: `${san} is strong — only ${bestSan} was better.` / good: `${san} keeps the balance, but ${bestSan} was more accurate.`

Piece names: p pawn, n knight, b bishop, r rook, q queen. Tests (~7) build plies via parsePgn + hand-set fields (construct minimal AnalyzedPly literals — no engine needed); cover 2a, 2b, 2c, 2d, 3, 5a, 5c. Suite target: 108/108.

Commit: `feat: rule-based move explanations`

---

### Task 3: wire into CoachCard + App

**Files:** Modify `src/components/CoachCard.tsx`, `src/App.tsx`.

- App: extend the `currentMove` memo — compute `explanation` there:

```ts
import { explainMove } from './coach/explain';
import { uciToSan } from './chess/san';   // already imported
// inside the currentMove memo, after computing bestSan:
const next = review?.plies[ply] ?? null;  // ply is 1-based over plies[ply-1]
const nextBestSan = next?.bestMoveUci ? uciToSan(next.fenBefore, next.bestMoveUci) : null;
const explanation = explainMove(playedPly, { bestSan, nextBestSan });
return { san, cls, bestSan, isBest, explanation };
```
(Adjust to the memo's actual shape; add `explanation: string` to `CurrentMove` in CoachCard.)
- CoachCard: delete the `description()` function; use `move.explanation` everywhere `comment` was derived (`const comment = move ? move.explanation : '';`). Speech wiring unchanged.
- Gates: tests unchanged count (108/108), build, lint. Manual dev check: step through a game with a blunder — coach shows threat/hanging language.

Commit: `feat: coach card speaks derived explanations`

---

### Task 4: motif tags for Phase 6

**Files:** Create `supabase/migrations/20260703100000_motifs.sql`; modify `src/supabase/mapReview.ts` (+ test).

Migration: `alter table public.move_facts add column motifs text[] not null default '{}';`
mapReview: per ply compute `motifs: string[]` — tags among: `'missed_mate'` (rule 2b condition), `'walked_into_mate'` (2a), `'hung_piece'` (2c condition), `'missed_fork'` (classification is bad AND forkTargets(fenBefore, bestMoveUci) ≥ 2), `'fork'` (forkTargets on played uci ≥ 2). Add to `ReviewUpload['move_facts']` element type: `motifs: string[]`.
Test (+1, suite 109/109): craft a fixture where the analysis map gives one ply a big drop and a best move that forks (or simplest reliable: assert hung-piece tag using a PGN where a piece is left en prise — e.g. '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6' leaves Nf6 attacking Qh5? — implementer: craft and VERIFY the position with chess.js first; a simple assertion that motifs arrays exist on every fact + at least one expected tag on the known-bad ply is sufficient).

Commit: `feat: motif tags on move facts for weakness reports`

---

### Task 5: verification (controller)
Browser: step through games; blunder shows "Better was X. The threat is now Y." style text; voice reads it; brilliant/fork phrasing appears where applicable; guest + saved-review reopen unaffected.

---

## Status (2026-07-03, post-merge)

Shipped: motif detectors (hanging/fork/mate), rule-based explainMove, CoachCard wiring, motif tags + migration.
DEFERRED detectors from the spec's Phase 5 list (tracked, not dropped): pins, skewers, discovered attacks, back-rank weakness — add to src/coach/motifs.ts when wanted; backfill motif tags from reviews.analysis per the init-migration NOTE.
Phase 6 note: missed_mate/walked_into_mate tags are ungated by classification (unlike hung_piece/missed_fork) — filter by classification in aggregations if consistency matters.
