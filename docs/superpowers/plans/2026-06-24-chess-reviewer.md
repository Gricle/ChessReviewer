# ChessReviewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hosted, browser-only chess Game Review web app (chess.com-style) that analyzes a game move-by-move with Stockfish (WASM), classifies moves, computes accuracy, detects the opening, and imports games from chess.com — all client-side, no backend.

**Architecture:** A Vite + React + TypeScript single-page app. Pure-logic modules (PGN parsing, win%/accuracy, classification, opening detection, material) are unit-tested with Vitest. Stockfish runs in a Web Worker via an `Engine` wrapper that returns a normalized evaluation per position. The app analyzes every position once, then a pure assembly step combines per-position evaluations into per-ply classifications and accuracies. UI components render the board, move list, eval graph, and summary.

**Tech Stack:** TypeScript, React, Vite, chess.js, chessground, Stockfish (WASM), Vitest.

---

## File Structure

```
ChessReviewer/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── engine/                 # Stockfish wasm/js (copied from node_modules)
├── src/
│   ├── main.tsx                # React entry
│   ├── App.tsx                 # top-level state + layout
│   ├── data/
│   │   └── openings.sample.ts  # bundled ECO openings (sample; full set droppable later)
│   ├── chess/
│   │   ├── types.ts            # shared types (Ply, ParsedGame, PositionAnalysis, ...)
│   │   ├── pgnParser.ts        # PGN string -> ParsedGame (plies + FENs)
│   │   └── material.ts         # materialBalance(fen) (side-to-move perspective)
│   ├── engine/
│   │   ├── uci.ts              # pure UCI line parsing helpers
│   │   └── engine.ts           # Stockfish Web Worker wrapper (analyze a FEN)
│   ├── analysis/
│   │   ├── thresholds.ts       # tunable constants
│   │   ├── winPercent.ts       # cp -> win%
│   │   ├── accuracy.ts         # per-move + per-game accuracy
│   │   ├── classifier.ts       # classify a single move
│   │   ├── openingDetector.ts  # match opening + book plies
│   │   └── assemble.ts         # positions + game -> AnalyzedPly[] + summary
│   ├── importers/
│   │   └── chesscom.ts         # fetch archives/games from chess.com public API
│   └── components/
│       ├── ImportPanel.tsx     # PGN paste + chess.com username flows
│       ├── ReviewBoard.tsx     # chessground board + best-move arrow
│       ├── MoveList.tsx        # moves with classification icons
│       ├── EvalGraph.tsx       # eval over the game
│       └── SummaryPanel.tsx    # accuracy per player + move-type counts
└── tests are colocated as *.test.ts next to the module
```

---

# Phase 1 — Scaffold, types, PGN parsing, board, play-through

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `vitest.config.ts`

- [ ] **Step 1: Initialize the project and install dependencies**

Run:
```bash
cd "E:/Codes/ChessReviewer"
npm create vite@latest . -- --template react-ts
npm install
npm install chess.js chessground
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/dom
npm install stockfish
```
Note: if `npm create vite` refuses because the directory isn't empty, scaffold into a temp dir and copy files in, keeping the existing `docs/` and `.git`.

- [ ] **Step 2: Add a vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

- [ ] **Step 3: Add test + dev scripts**

In `package.json` "scripts", ensure:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Verify the app boots**

Run: `npm run dev`
Expected: Vite serves on `http://localhost:5173` with the default React page. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS + Vitest"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/chess/types.ts`

- [ ] **Step 1: Write the types**

Create `src/chess/types.ts`:
```ts
export type Color = 'white' | 'black';

export interface Ply {
  index: number;       // 0-based ply index
  fenBefore: string;   // FEN before the move (side to move = mover)
  fenAfter: string;    // FEN after the move (side to move = opponent)
  san: string;         // move in SAN, e.g. "Nf3"
  uci: string;         // move in UCI, e.g. "g1f3"
  color: Color;        // side that moved
  moveNumber: number;  // full move number (1-based)
}

export interface ParsedGame {
  plies: Ply[];
  headers: Record<string, string>;
  white: string;
  black: string;
}

// Engine evaluation of ONE position, from the side-to-move perspective.
export interface PositionAnalysis {
  fen: string;
  bestMoveUci: string;
  bestEvalCp: number;            // centipawns; mate encoded as +/- 32000
  secondBestEvalCp: number | null;
  mate: number | null;           // signed moves-to-mate, or null
}

export type Classification =
  | 'book' | 'brilliant' | 'great' | 'best' | 'excellent'
  | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface AnalyzedPly extends Ply {
  bestMoveUci: string;
  evalBeforeCp: number;   // mover perspective (= best eval at fenBefore)
  evalAfterCp: number;    // mover perspective (= -best eval at fenAfter)
  classification: Classification;
  accuracy: number;       // 0..100
}

export interface ReviewSummary {
  opening: { eco: string; name: string } | null;
  whiteAccuracy: number;
  blackAccuracy: number;
  counts: Record<Classification, { white: number; black: number }>;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/chess/types.ts
git commit -m "feat: shared chess types"
```

---

## Task 3: PGN parser

**Files:**
- Create: `src/chess/pgnParser.ts`, `src/chess/pgnParser.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/chess/pgnParser.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parsePgn } from './pgnParser';

const PGN = `[White "Alice"]
[Black "Bob"]

1. e4 e5 2. Nf3 Nc6 *`;

describe('parsePgn', () => {
  it('parses headers and player names', () => {
    const g = parsePgn(PGN);
    expect(g.white).toBe('Alice');
    expect(g.black).toBe('Bob');
  });

  it('produces one ply per half-move with correct UCI and color', () => {
    const g = parsePgn(PGN);
    expect(g.plies).toHaveLength(4);
    expect(g.plies[0]).toMatchObject({ san: 'e4', uci: 'e2e4', color: 'white', moveNumber: 1 });
    expect(g.plies[1]).toMatchObject({ san: 'e5', uci: 'e7e5', color: 'black', moveNumber: 1 });
    expect(g.plies[2]).toMatchObject({ san: 'Nf3', uci: 'g1f3', color: 'white', moveNumber: 2 });
  });

  it('records fenBefore of the first ply as the start position', () => {
    const g = parsePgn(PGN);
    expect(g.plies[0].fenBefore.startsWith(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w'
    )).toBe(true);
    expect(g.plies[0].fenAfter).toBe(g.plies[1].fenBefore);
  });

  it('throws on invalid PGN', () => {
    expect(() => parsePgn('this is not pgn 1. Zz9')).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/chess/pgnParser.test.ts`
Expected: FAIL — `parsePgn` is not defined.

- [ ] **Step 3: Implement the parser**

Create `src/chess/pgnParser.ts`:
```ts
import { Chess } from 'chess.js';
import type { ParsedGame, Ply } from './types';

export function parsePgn(pgn: string): ParsedGame {
  const loader = new Chess();
  loader.loadPgn(pgn); // throws on invalid PGN
  const headers = loader.header() as Record<string, string>;
  const verbose = loader.history({ verbose: true });

  const replay = new Chess();
  const plies: Ply[] = verbose.map((m, i) => {
    const fenBefore = replay.fen();
    replay.move(m.san);
    const fenAfter = replay.fen();
    return {
      index: i,
      fenBefore,
      fenAfter,
      san: m.san,
      uci: m.from + m.to + (m.promotion ?? ''),
      color: m.color === 'w' ? 'white' : 'black',
      moveNumber: Math.floor(i / 2) + 1,
    };
  });

  return {
    plies,
    headers,
    white: headers.White ?? 'White',
    black: headers.Black ?? 'Black',
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/chess/pgnParser.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/chess/pgnParser.ts src/chess/pgnParser.test.ts
git commit -m "feat: PGN parser producing plies with FENs and UCI"
```

---

## Task 4: ReviewBoard component (chessground)

**Files:**
- Create: `src/components/ReviewBoard.tsx`

- [ ] **Step 1: Implement the board wrapper**

Create `src/components/ReviewBoard.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

interface Props {
  fen: string;
  // optional best-move arrow as [fromSquare, toSquare], e.g. ['g1','f3']
  arrow?: [string, string] | null;
}

export function ReviewBoard({ fen, arrow }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, { fen, viewOnly: true, coordinates: true });
    return () => api.current?.destroy();
  }, []);

  useEffect(() => {
    api.current?.set({
      fen,
      drawable: {
        autoShapes: arrow
          ? [{ orig: arrow[0] as never, dest: arrow[1] as never, brush: 'green' }]
          : [],
      },
    });
  }, [fen, arrow]);

  return <div ref={el} style={{ width: 480, height: 480 }} />;
}
```

- [ ] **Step 2: Wire a minimal play-through into App**

Replace `src/App.tsx` with:
```tsx
import { useMemo, useState } from 'react';
import { parsePgn } from './chess/pgnParser';
import { ReviewBoard } from './components/ReviewBoard';
import type { ParsedGame } from './chess/types';

const SAMPLE = `[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *`;

export default function App() {
  const [pgn, setPgn] = useState(SAMPLE);
  const [game, setGame] = useState<ParsedGame | null>(null);
  const [ply, setPly] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function load() {
    try {
      setGame(parsePgn(pgn));
      setPly(0);
      setError(null);
    } catch {
      setError('Invalid PGN');
    }
  }

  const fen = useMemo(() => {
    if (!game) return undefined;
    if (ply === 0) return game.plies[0]?.fenBefore;
    return game.plies[ply - 1]?.fenAfter;
  }, [game, ply]);

  return (
    <div style={{ display: 'flex', gap: 24, padding: 24 }}>
      <div>
        <textarea value={pgn} onChange={(e) => setPgn(e.target.value)} rows={8} cols={40} />
        <div>
          <button onClick={load}>Load PGN</button>
          {error && <span style={{ color: 'red' }}> {error}</span>}
        </div>
      </div>
      {game && fen && (
        <div>
          <ReviewBoard fen={fen} />
          <div>
            <button onClick={() => setPly((p) => Math.max(0, p - 1))}>◀</button>
            <button onClick={() => setPly((p) => Math.min(game.plies.length, p + 1))}>▶</button>
            <span> ply {ply}/{game.plies.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open the app, click "Load PGN", step forward/back with ◀ ▶.
Expected: board renders and updates per move. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/components/ReviewBoard.tsx src/App.tsx
git commit -m "feat: chessground board with PGN play-through"
```

---

# Phase 2 — Stockfish engine + full-game analysis + eval graph

## Task 5: UCI line parsing (pure)

**Files:**
- Create: `src/engine/uci.ts`, `src/engine/uci.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/engine/uci.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseScoreCp, parseInfoLine } from './uci';

describe('parseScoreCp', () => {
  it('reads centipawn scores', () => {
    expect(parseScoreCp('score cp 34')).toEqual({ cp: 34, mate: null });
    expect(parseScoreCp('score cp -150')).toEqual({ cp: -150, mate: null });
  });
  it('encodes mate as +/-32000 and keeps the mate distance', () => {
    expect(parseScoreCp('score mate 3')).toEqual({ cp: 32000, mate: 3 });
    expect(parseScoreCp('score mate -2')).toEqual({ cp: -32000, mate: -2 });
  });
});

describe('parseInfoLine', () => {
  it('extracts multipv index, score, and first pv move', () => {
    const line = 'info depth 18 seldepth 24 multipv 1 score cp 27 nodes 1 pv e2e4 e7e5 g1f3';
    expect(parseInfoLine(line)).toEqual({ multipv: 1, cp: 27, mate: null, firstMove: 'e2e4' });
  });
  it('returns null for lines without a score', () => {
    expect(parseInfoLine('info string NNUE evaluation using nn-xyz')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/engine/uci.test.ts`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement the parsers**

Create `src/engine/uci.ts`:
```ts
export const MATE_CP = 32000;

export function parseScoreCp(text: string): { cp: number; mate: number | null } {
  const mateMatch = text.match(/score mate (-?\d+)/);
  if (mateMatch) {
    const mate = parseInt(mateMatch[1], 10);
    return { cp: mate >= 0 ? MATE_CP : -MATE_CP, mate };
  }
  const cpMatch = text.match(/score cp (-?\d+)/);
  if (cpMatch) return { cp: parseInt(cpMatch[1], 10), mate: null };
  return { cp: NaN, mate: null };
}

export interface InfoLine {
  multipv: number;
  cp: number;
  mate: number | null;
  firstMove: string;
}

export function parseInfoLine(line: string): InfoLine | null {
  if (!/score (cp|mate) /.test(line)) return null;
  const { cp, mate } = parseScoreCp(line);
  const multipvMatch = line.match(/multipv (\d+)/);
  const multipv = multipvMatch ? parseInt(multipvMatch[1], 10) : 1;
  const pvMatch = line.match(/ pv (\S+)/);
  if (!pvMatch) return null;
  return { multipv, cp, mate, firstMove: pvMatch[1] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/engine/uci.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/uci.ts src/engine/uci.test.ts
git commit -m "feat: pure UCI info/score parsing"
```

---

## Task 6: Stockfish engine wrapper

**Files:**
- Create: `src/engine/engine.ts`
- Modify: `public/engine/` (copy Stockfish build), `vite.config.ts`

- [ ] **Step 1: Make the Stockfish worker available as a static asset**

Run:
```bash
mkdir -p public/engine
cp node_modules/stockfish/src/stockfish-*.js public/engine/ 2>/dev/null || cp node_modules/stockfish/src/*.js public/engine/
cp node_modules/stockfish/src/*.wasm public/engine/ 2>/dev/null || true
ls public/engine
```
Expected: a `stockfish*.js` (and possibly `.wasm`) file present in `public/engine/`. Note the exact main JS filename — use it as `ENGINE_URL` below (e.g. `/engine/stockfish.js` or `/engine/stockfish-nnue-16.js`).

- [ ] **Step 2: Implement the engine wrapper**

Create `src/engine/engine.ts`:
```ts
import type { PositionAnalysis } from '../chess/types';
import { parseInfoLine } from './uci';

const ENGINE_URL = '/engine/stockfish.js'; // adjust to the actual filename from Step 1

export class Engine {
  private worker: Worker;
  private ready: Promise<void>;

  constructor(url: string = ENGINE_URL) {
    this.worker = new Worker(url);
    this.ready = this.handshake();
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  private handshake(): Promise<void> {
    return new Promise((resolve) => {
      const onMsg = (e: MessageEvent) => {
        const line = String(e.data);
        if (line === 'uciok') this.send('isready');
        if (line === 'readyok') {
          this.worker.removeEventListener('message', onMsg);
          resolve();
        }
      };
      this.worker.addEventListener('message', onMsg);
      this.send('uci');
    });
  }

  async analyze(fen: string, depth: number): Promise<PositionAnalysis> {
    await this.ready;
    return new Promise((resolve) => {
      const best: Record<number, { cp: number; mate: number | null; move: string }> = {};
      const onMsg = (e: MessageEvent) => {
        const line = String(e.data);
        const info = parseInfoLine(line);
        if (info) {
          best[info.multipv] = { cp: info.cp, mate: info.mate, move: info.firstMove };
        }
        if (line.startsWith('bestmove')) {
          this.worker.removeEventListener('message', onMsg);
          const pv1 = best[1];
          const pv2 = best[2] ?? null;
          resolve({
            fen,
            bestMoveUci: pv1?.move ?? line.split(' ')[1] ?? '',
            bestEvalCp: pv1?.cp ?? 0,
            secondBestEvalCp: pv2 ? pv2.cp : null,
            mate: pv1?.mate ?? null,
          });
        }
      };
      this.worker.addEventListener('message', onMsg);
      this.send('setoption name MultiPV value 2');
      this.send('ucinewgame');
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  quit() {
    this.send('quit');
    this.worker.terminate();
  }
}
```

- [ ] **Step 3: Manually verify the engine responds**

Add a temporary button in `App.tsx` that does:
```tsx
// temporary smoke test
const e = new (await import('./engine/engine')).Engine();
console.log(await e.analyze('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 14));
e.quit();
```
Run `npm run dev`, click the button, check the console.
Expected: an object with `bestMoveUci` like `e2e4`/`d2d4`/`g1f3`, a small `bestEvalCp`, and a `secondBestEvalCp`. Remove the temporary button afterward.

- [ ] **Step 4: Commit**

```bash
git add src/engine/engine.ts public/engine vite.config.ts
git commit -m "feat: Stockfish Web Worker wrapper with MultiPV"
```

---

## Task 7: Material balance helper (pure)

**Files:**
- Create: `src/chess/material.ts`, `src/chess/material.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/chess/material.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { materialBalance } from './material';

describe('materialBalance', () => {
  it('is 0 at the start position', () => {
    expect(materialBalance('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(0);
  });
  it('reports from the side-to-move perspective (white up a queen, white to move)', () => {
    // White has an extra queen on d1; black has none.
    expect(materialBalance('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(9);
  });
  it('negates for black to move', () => {
    // Same material edge for white, but black to move -> negative.
    expect(materialBalance('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1')).toBe(-9);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/chess/material.test.ts`
Expected: FAIL — `materialBalance` not defined.

- [ ] **Step 3: Implement it**

Create `src/chess/material.ts`:
```ts
import { Chess } from 'chess.js';

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// Material balance in pawns, from the side-to-move perspective.
export function materialBalance(fen: string): number {
  const c = new Chess(fen);
  let white = 0;
  let black = 0;
  for (const row of c.board()) {
    for (const sq of row) {
      if (!sq) continue;
      const v = VALUES[sq.type];
      if (sq.color === 'w') white += v;
      else black += v;
    }
  }
  const fromWhite = white - black;
  return c.turn() === 'w' ? fromWhite : -fromWhite;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/chess/material.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/chess/material.ts src/chess/material.test.ts
git commit -m "feat: material balance helper"
```

---

## Task 8: Full-game analysis driver

**Files:**
- Create: `src/analysis/analyzeGame.ts`

- [ ] **Step 1: Implement the driver**

Create `src/analysis/analyzeGame.ts`:
```ts
import type { ParsedGame, PositionAnalysis } from '../chess/types';
import { Engine } from '../engine/engine';

// Analyze every distinct position needed: fenBefore of each ply, plus the final fenAfter.
// Returns a map keyed by FEN. Reports progress 0..1 via onProgress.
export async function analyzeGame(
  game: ParsedGame,
  depth: number,
  onProgress?: (done: number, total: number) => void,
  engine: Engine = new Engine(),
): Promise<Map<string, PositionAnalysis>> {
  const fens: string[] = [];
  for (const ply of game.plies) fens.push(ply.fenBefore);
  const last = game.plies[game.plies.length - 1];
  if (last) fens.push(last.fenAfter);

  const unique = Array.from(new Set(fens));
  const result = new Map<string, PositionAnalysis>();
  let done = 0;
  for (const fen of unique) {
    result.set(fen, await engine.analyze(fen, depth));
    done += 1;
    onProgress?.(done, unique.length);
  }
  return result;
}
```

- [ ] **Step 2: Verify against a short game in the browser**

Temporarily wire a "Analyze" button in `App.tsx` that calls `analyzeGame(game, 12, console.log)` and logs the resulting map size.
Run `npm run dev`, load the sample PGN, click Analyze.
Expected: progress logs counting up, final map has (plies + 1) minus duplicates entries. Remove the temporary button.

- [ ] **Step 3: Commit**

```bash
git add src/analysis/analyzeGame.ts
git commit -m "feat: full-game analysis driver with progress"
```

---

## Task 9: Eval graph component

**Files:**
- Create: `src/components/EvalGraph.tsx`

- [ ] **Step 1: Implement a dependency-free SVG eval graph**

Create `src/components/EvalGraph.tsx`:
```tsx
interface Props {
  // White-perspective evals in centipawns, one per ply (already converted).
  evalsCp: number[];
  current: number;            // current ply index (0-based) to highlight
  onSelect: (ply: number) => void;
}

const W = 480;
const H = 120;
const CLAMP = 1000; // clamp eval display to +/-10 pawns

export function EvalGraph({ evalsCp, current, onSelect }: Props) {
  if (evalsCp.length === 0) return null;
  const x = (i: number) => (i / Math.max(1, evalsCp.length - 1)) * W;
  const y = (cp: number) => {
    const c = Math.max(-CLAMP, Math.min(CLAMP, cp));
    return H / 2 - (c / CLAMP) * (H / 2);
  };
  const points = evalsCp.map((cp, i) => `${x(i)},${y(cp)}`).join(' ');

  return (
    <svg width={W} height={H} style={{ background: '#eee' }}
         onClick={(e) => {
           const rect = (e.target as SVGElement).ownerSVGElement!.getBoundingClientRect();
           const px = e.clientX - rect.left;
           onSelect(Math.round((px / W) * (evalsCp.length - 1)));
         }}>
      <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#999" />
      <polyline points={points} fill="none" stroke="#2a7" strokeWidth={2} />
      <line x1={x(current)} y1={0} x2={x(current)} y2={H} stroke="#c33" strokeWidth={1} />
    </svg>
  );
}
```

- [ ] **Step 2: Verify it renders**

Temporarily render `<EvalGraph evalsCp={[20,30,-50,10,200,-300]} current={2} onSelect={console.log} />` in App.
Run `npm run dev`.
Expected: a line graph with a red cursor at index 2; clicking logs a ply index. Remove the temporary render.

- [ ] **Step 3: Commit**

```bash
git add src/components/EvalGraph.tsx
git commit -m "feat: SVG evaluation graph"
```

---

# Phase 3 — Classification, accuracy, openings, assembly, summary

## Task 10: Tunable thresholds

**Files:**
- Create: `src/analysis/thresholds.ts`

- [ ] **Step 1: Write the constants**

Create `src/analysis/thresholds.ts`:
```ts
// All thresholds are in win% drop (0..100), tuned against sample games.
export const WIN_DROP = {
  best: 2,        // < 2  -> best (when not literally the engine move)
  excellent: 5,   // < 5  -> excellent
  good: 10,       // < 10 -> good
  inaccuracy: 15, // < 15 -> inaccuracy
  mistake: 25,    // < 25 -> mistake; >= 25 -> blunder
};

// "Great" = found the only good move.
export const GREAT_GAP_CP = 150;     // best must beat 2nd-best by this many cp
export const GREAT_MIN_WIN = 25;     // only meaningful in roughly balanced/better spots
export const GREAT_MAX_WIN = 90;

// "Brilliant" = best move that sacrifices material while staying winning.
export const BRILLIANT_MIN_SAC = 2;  // pawns of material net given up (after best reply)
export const BRILLIANT_MIN_WIN_AFTER = 50;
export const BRILLIANT_MAX_DROP = 2; // win% drop must stay tiny
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/analysis/thresholds.ts
git commit -m "feat: tunable classification thresholds"
```

---

## Task 11: Win-percent conversion (pure)

**Files:**
- Create: `src/analysis/winPercent.ts`, `src/analysis/winPercent.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/analysis/winPercent.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { cpToWinPercent } from './winPercent';

describe('cpToWinPercent', () => {
  it('is 50 at a dead-equal position', () => {
    expect(cpToWinPercent(0)).toBeCloseTo(50, 5);
  });
  it('rises above 50 when ahead and below 50 when behind', () => {
    expect(cpToWinPercent(300)).toBeGreaterThan(70);
    expect(cpToWinPercent(-300)).toBeLessThan(30);
  });
  it('saturates near 100 / 0 for mate-sized scores', () => {
    expect(cpToWinPercent(32000)).toBeGreaterThan(99.9);
    expect(cpToWinPercent(-32000)).toBeLessThan(0.1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/analysis/winPercent.test.ts`
Expected: FAIL — `cpToWinPercent` not defined.

- [ ] **Step 3: Implement it**

Create `src/analysis/winPercent.ts`:
```ts
// Convert a centipawn eval (side-to-move perspective) to a win percentage 0..100.
// Uses the published Lichess/chess.com logistic curve.
export function cpToWinPercent(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/analysis/winPercent.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/analysis/winPercent.ts src/analysis/winPercent.test.ts
git commit -m "feat: centipawn to win-percent conversion"
```

---

## Task 12: Accuracy (pure)

**Files:**
- Create: `src/analysis/accuracy.ts`, `src/analysis/accuracy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/analysis/accuracy.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { moveAccuracy, gameAccuracy } from './accuracy';

describe('moveAccuracy', () => {
  it('is ~100 when the win% does not drop', () => {
    expect(moveAccuracy(60, 60)).toBeGreaterThan(99);
  });
  it('decreases as the win% drop grows', () => {
    const small = moveAccuracy(60, 55);
    const big = moveAccuracy(60, 30);
    expect(small).toBeGreaterThan(big);
    expect(big).toBeGreaterThanOrEqual(0);
  });
  it('clamps to 0..100', () => {
    expect(moveAccuracy(100, 0)).toBeGreaterThanOrEqual(0);
    expect(moveAccuracy(50, 80)).toBeLessThanOrEqual(100);
  });
});

describe('gameAccuracy', () => {
  it('averages the per-move accuracies', () => {
    expect(gameAccuracy([100, 100, 100])).toBeCloseTo(100, 5);
    expect(gameAccuracy([100, 0])).toBeCloseTo(50, 5);
  });
  it('returns 100 for an empty list (no moves to fault)', () => {
    expect(gameAccuracy([])).toBe(100);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/analysis/accuracy.test.ts`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement it**

Create `src/analysis/accuracy.ts`:
```ts
// Per-move accuracy from the moving player's win% before vs after the move.
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * (winBefore - winAfter)) - 3.1669;
  return Math.max(0, Math.min(100, raw));
}

// Per-player game accuracy = mean of that player's per-move accuracies.
export function gameAccuracy(moveAccuracies: number[]): number {
  if (moveAccuracies.length === 0) return 100;
  const sum = moveAccuracies.reduce((a, b) => a + b, 0);
  return sum / moveAccuracies.length;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/analysis/accuracy.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/analysis/accuracy.ts src/analysis/accuracy.test.ts
git commit -m "feat: per-move and per-game accuracy"
```

---

## Task 13: Classifier (pure)

**Files:**
- Create: `src/analysis/classifier.ts`, `src/analysis/classifier.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/analysis/classifier.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { classify, type ClassifyInput } from './classifier';

const base: ClassifyInput = {
  isBook: false,
  playedUci: 'g1f3',
  bestUci: 'g1f3',
  evalBeforeCp: 30,
  evalAfterCp: 30,
  secondBestEvalCp: 20,
  materialSacrificed: 0,
};

describe('classify', () => {
  it('labels opening-book moves', () => {
    expect(classify({ ...base, isBook: true })).toBe('book');
  });

  it('labels the engine move as best when nothing special applies', () => {
    expect(classify(base)).toBe('best');
  });

  it('labels increasing win% drops as inaccuracy/mistake/blunder', () => {
    // Big eval swings against the mover (mover perspective).
    expect(classify({ ...base, playedUci: 'a2a3', evalBeforeCp: 100, evalAfterCp: 30 })).toBe('inaccuracy');
    expect(classify({ ...base, playedUci: 'a2a3', evalBeforeCp: 100, evalAfterCp: -50 })).toBe('mistake');
    expect(classify({ ...base, playedUci: 'a2a3', evalBeforeCp: 100, evalAfterCp: -400 })).toBe('blunder');
  });

  it('labels a far-and-away only move as great', () => {
    expect(classify({
      ...base, evalBeforeCp: 50, evalAfterCp: 50, secondBestEvalCp: -200,
    })).toBe('great');
  });

  it('labels a winning material sacrifice as brilliant', () => {
    expect(classify({
      ...base, evalBeforeCp: 200, evalAfterCp: 200, materialSacrificed: 3,
    })).toBe('brilliant');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/analysis/classifier.test.ts`
Expected: FAIL — `classify` not defined.

- [ ] **Step 3: Implement it**

Create `src/analysis/classifier.ts`:
```ts
import type { Classification } from '../chess/types';
import { cpToWinPercent } from './winPercent';
import {
  WIN_DROP, GREAT_GAP_CP, GREAT_MIN_WIN, GREAT_MAX_WIN,
  BRILLIANT_MIN_SAC, BRILLIANT_MIN_WIN_AFTER, BRILLIANT_MAX_DROP,
} from './thresholds';

export interface ClassifyInput {
  isBook: boolean;
  playedUci: string;
  bestUci: string;
  evalBeforeCp: number;             // mover perspective
  evalAfterCp: number;              // mover perspective
  secondBestEvalCp: number | null;  // mover perspective at fenBefore
  materialSacrificed: number;       // pawns net given up after best reply
}

export function classify(i: ClassifyInput): Classification {
  if (i.isBook) return 'book';

  const winBefore = cpToWinPercent(i.evalBeforeCp);
  const winAfter = cpToWinPercent(i.evalAfterCp);
  const drop = winBefore - winAfter;
  const playedBest = i.playedUci === i.bestUci;

  if (
    i.materialSacrificed >= BRILLIANT_MIN_SAC &&
    winAfter >= BRILLIANT_MIN_WIN_AFTER &&
    drop <= BRILLIANT_MAX_DROP
  ) {
    return 'brilliant';
  }

  if (playedBest && i.secondBestEvalCp !== null) {
    const gap = i.evalBeforeCp - i.secondBestEvalCp;
    if (gap >= GREAT_GAP_CP && winBefore >= GREAT_MIN_WIN && winBefore <= GREAT_MAX_WIN) {
      return 'great';
    }
  }

  if (playedBest || drop < WIN_DROP.best) return 'best';
  if (drop < WIN_DROP.excellent) return 'excellent';
  if (drop < WIN_DROP.good) return 'good';
  if (drop < WIN_DROP.inaccuracy) return 'inaccuracy';
  if (drop < WIN_DROP.mistake) return 'mistake';
  return 'blunder';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/analysis/classifier.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/analysis/classifier.ts src/analysis/classifier.test.ts
git commit -m "feat: move classifier (core chess.com-style labels)"
```

---

## Task 14: Opening detector (pure) + sample data

**Files:**
- Create: `src/data/openings.sample.ts`, `src/analysis/openingDetector.ts`, `src/analysis/openingDetector.test.ts`

- [ ] **Step 1: Add a small bundled openings dataset**

Create `src/data/openings.sample.ts`:
```ts
import type { Opening } from '../analysis/openingDetector';

// Minimal sample. The full Lichess ECO set (UCI move lists) can be dropped in later
// using the same shape.
export const OPENINGS: Opening[] = [
  { eco: 'C60', name: 'Ruy Lopez', uciMoves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'] },
  { eco: 'C50', name: 'Italian Game', uciMoves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'] },
  { eco: 'B20', name: 'Sicilian Defense', uciMoves: ['e2e4', 'c7c5'] },
  { eco: 'D02', name: "Queen's Pawn Game", uciMoves: ['d2d4', 'd7d5'] },
];
```

- [ ] **Step 2: Write the failing test**

Create `src/analysis/openingDetector.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectOpening, type Opening } from './openingDetector';

const BOOK: Opening[] = [
  { eco: 'C60', name: 'Ruy Lopez', uciMoves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'] },
  { eco: 'C50', name: 'Italian Game', uciMoves: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'] },
  { eco: 'B20', name: 'Sicilian Defense', uciMoves: ['e2e4', 'c7c5'] },
];

describe('detectOpening', () => {
  it('matches the longest opening prefix of the game', () => {
    const game = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6'];
    const r = detectOpening(game, BOOK);
    expect(r.opening?.name).toBe('Ruy Lopez');
    expect(r.bookPlies).toBe(5);
  });

  it('returns null when no opening matches', () => {
    const r = detectOpening(['g1f3', 'g8f6'], BOOK);
    expect(r.opening).toBeNull();
    expect(r.bookPlies).toBe(0);
  });

  it('does not match an opening longer than the game', () => {
    const r = detectOpening(['e2e4', 'e7e5', 'g1f3'], BOOK);
    expect(r.opening).toBeNull(); // no 2-or-3 ply opening in BOOK starting e4 e5
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/analysis/openingDetector.test.ts`
Expected: FAIL — `detectOpening` not defined.

- [ ] **Step 4: Implement it**

Create `src/analysis/openingDetector.ts`:
```ts
export interface Opening {
  eco: string;
  name: string;
  uciMoves: string[];
}

export interface OpeningMatch {
  opening: Opening | null;
  bookPlies: number;
}

export function detectOpening(gameUci: string[], book: Opening[]): OpeningMatch {
  let best: Opening | null = null;
  for (const o of book) {
    if (o.uciMoves.length > gameUci.length) continue;
    const matches = o.uciMoves.every((m, i) => m === gameUci[i]);
    if (matches && (!best || o.uciMoves.length > best.uciMoves.length)) {
      best = o;
    }
  }
  return { opening: best, bookPlies: best ? best.uciMoves.length : 0 };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/analysis/openingDetector.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/data/openings.sample.ts src/analysis/openingDetector.ts src/analysis/openingDetector.test.ts
git commit -m "feat: opening detector with sample ECO data"
```

---

## Task 15: Assembly — combine analyses into AnalyzedPly[] + summary (pure)

**Files:**
- Create: `src/analysis/assemble.ts`, `src/analysis/assemble.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/analysis/assemble.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { assembleReview } from './assemble';
import type { ParsedGame, PositionAnalysis } from '../chess/types';
import { parsePgn } from '../chess/pgnParser';
import { OPENINGS } from '../data/openings.sample';

// A 4-ply Ruy Lopez fragment so the opening detector tags book moves.
const game: ParsedGame = parsePgn('1. e4 e5 2. Nf3 Nc6 *');

// Build a trivial analysis map: pretend every position is dead equal and the
// engine's "best" move equals what was played, so all moves are book/best.
function flatAnalyses(g: ParsedGame): Map<string, PositionAnalysis> {
  const m = new Map<string, PositionAnalysis>();
  const add = (fen: string, bestUci: string) =>
    m.set(fen, { fen, bestMoveUci: bestUci, bestEvalCp: 0, secondBestEvalCp: 0, mate: null });
  g.plies.forEach((p) => add(p.fenBefore, p.uci));
  const last = g.plies[g.plies.length - 1];
  add(last.fenAfter, 'a2a3');
  return m;
}

describe('assembleReview', () => {
  it('produces one AnalyzedPly per ply', () => {
    const { plies } = assembleReview(game, flatAnalyses(game), OPENINGS);
    expect(plies).toHaveLength(4);
  });

  it('tags opening moves as book and reports the opening name', () => {
    const { plies, summary } = assembleReview(game, flatAnalyses(game), OPENINGS);
    expect(plies[0].classification).toBe('book');
    expect(summary.opening?.name).toBeDefined();
  });

  it('computes per-player accuracy near 100 when every move is best/book', () => {
    const { summary } = assembleReview(game, flatAnalyses(game), OPENINGS);
    expect(summary.whiteAccuracy).toBeGreaterThan(99);
    expect(summary.blackAccuracy).toBeGreaterThan(99);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/analysis/assemble.test.ts`
Expected: FAIL — `assembleReview` not defined.

- [ ] **Step 3: Implement it**

Create `src/analysis/assemble.ts`:
```ts
import { Chess } from 'chess.js';
import type {
  AnalyzedPly, Classification, ParsedGame, PositionAnalysis, ReviewSummary,
} from '../chess/types';
import { classify } from './classifier';
import { moveAccuracy, gameAccuracy } from './accuracy';
import { cpToWinPercent } from './winPercent';
import { materialBalance } from './material';
import { detectOpening, type Opening } from './openingDetector';

const ALL_LABELS: Classification[] = [
  'book', 'brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder',
];

export interface Review {
  plies: AnalyzedPly[];
  summary: ReviewSummary;
}

export function assembleReview(
  game: ParsedGame,
  analyses: Map<string, PositionAnalysis>,
  book: Opening[],
): Review {
  const gameUci = game.plies.map((p) => p.uci);
  const { opening, bookPlies } = detectOpening(gameUci, book);

  const plies: AnalyzedPly[] = game.plies.map((ply) => {
    const before = analyses.get(ply.fenBefore)!;
    const after = analyses.get(ply.fenAfter);

    const evalBeforeCp = before.bestEvalCp;                 // mover perspective
    const evalAfterCp = after ? -after.bestEvalCp : evalBeforeCp; // mover perspective

    // Material sacrificed: compare mover-perspective material at fenBefore vs the
    // position two plies later (after the opponent's best reply). Both have the
    // mover to move, so materialBalance is directly comparable.
    let materialSacrificed = 0;
    if (after) {
      try {
        const board = new Chess(ply.fenAfter);
        board.move({
          from: after.bestMoveUci.slice(0, 2),
          to: after.bestMoveUci.slice(2, 4),
          promotion: after.bestMoveUci.slice(4) || undefined,
        });
        materialSacrificed = materialBalance(ply.fenBefore) - materialBalance(board.fen());
      } catch {
        materialSacrificed = 0;
      }
    }

    const classification = classify({
      isBook: ply.index < bookPlies,
      playedUci: ply.uci,
      bestUci: before.bestMoveUci,
      evalBeforeCp,
      evalAfterCp,
      secondBestEvalCp: before.secondBestEvalCp,
      materialSacrificed,
    });

    const accuracy = moveAccuracy(cpToWinPercent(evalBeforeCp), cpToWinPercent(evalAfterCp));

    return { ...ply, bestMoveUci: before.bestMoveUci, evalBeforeCp, evalAfterCp, classification, accuracy };
  });

  const counts = Object.fromEntries(
    ALL_LABELS.map((l) => [l, { white: 0, black: 0 }]),
  ) as ReviewSummary['counts'];
  for (const p of plies) counts[p.classification][p.color] += 1;

  const whiteAcc = gameAccuracy(plies.filter((p) => p.color === 'white').map((p) => p.accuracy));
  const blackAcc = gameAccuracy(plies.filter((p) => p.color === 'black').map((p) => p.accuracy));

  return {
    plies,
    summary: {
      opening: opening ? { eco: opening.eco, name: opening.name } : null,
      whiteAccuracy: whiteAcc,
      blackAccuracy: blackAcc,
      counts,
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/analysis/assemble.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/analysis/assemble.ts src/analysis/assemble.test.ts
git commit -m "feat: assemble per-position analyses into a full review"
```

---

## Task 16: MoveList and SummaryPanel components

**Files:**
- Create: `src/components/MoveList.tsx`, `src/components/SummaryPanel.tsx`

- [ ] **Step 1: Implement MoveList**

Create `src/components/MoveList.tsx`:
```tsx
import type { AnalyzedPly, Classification } from '../chess/types';

const ICON: Record<Classification, string> = {
  brilliant: '!!', great: '!', best: '★', excellent: '✓', good: '·',
  book: '📖', inaccuracy: '?!', mistake: '?', blunder: '??',
};
const COLOR: Record<Classification, string> = {
  brilliant: '#1baca6', great: '#5c8bb0', best: '#3a3', excellent: '#4a4', good: '#777',
  book: '#a88', inaccuracy: '#e6a23c', mistake: '#e67e22', blunder: '#c0392b',
};

interface Props {
  plies: AnalyzedPly[];
  current: number;             // current ply (0 = start, n = after ply n-1)
  onSelect: (ply: number) => void;
}

export function MoveList({ plies, current, onSelect }: Props) {
  return (
    <div style={{ maxHeight: 480, overflowY: 'auto', width: 220 }}>
      {plies.map((p) => (
        <div
          key={p.index}
          onClick={() => onSelect(p.index + 1)}
          style={{
            cursor: 'pointer',
            padding: '2px 6px',
            background: current === p.index + 1 ? '#dde' : 'transparent',
          }}
        >
          {p.color === 'white' ? <b>{p.moveNumber}. </b> : <span>… </span>}
          {p.san}{' '}
          <span style={{ color: COLOR[p.classification] }}>{ICON[p.classification]}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement SummaryPanel**

Create `src/components/SummaryPanel.tsx`:
```tsx
import type { ReviewSummary, Classification } from '../chess/types';

const ORDER: Classification[] = [
  'brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder',
];

interface Props {
  summary: ReviewSummary;
  white: string;
  black: string;
}

export function SummaryPanel({ summary, white, black }: Props) {
  return (
    <div style={{ width: 260 }}>
      <h3>Game Review</h3>
      {summary.opening && <p>Opening: {summary.opening.eco} {summary.opening.name}</p>}
      <table>
        <thead>
          <tr><th></th><th>{white}</th><th>{black}</th></tr>
          <tr>
            <td>Accuracy</td>
            <td>{summary.whiteAccuracy.toFixed(1)}%</td>
            <td>{summary.blackAccuracy.toFixed(1)}%</td>
          </tr>
        </thead>
        <tbody>
          {ORDER.map((label) => (
            <tr key={label}>
              <td style={{ textTransform: 'capitalize' }}>{label}</td>
              <td align="center">{summary.counts[label].white}</td>
              <td align="center">{summary.counts[label].black}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Verify both compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/MoveList.tsx src/components/SummaryPanel.tsx
git commit -m "feat: move list and summary panel"
```

---

## Task 17: Wire the full review into App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace App with the full review flow**

Replace `src/App.tsx`:
```tsx
import { useMemo, useState } from 'react';
import { parsePgn } from './chess/pgnParser';
import { analyzeGame } from './analysis/analyzeGame';
import { assembleReview, type Review } from './analysis/assemble';
import { OPENINGS } from './data/openings.sample';
import { ReviewBoard } from './components/ReviewBoard';
import { MoveList } from './components/MoveList';
import { EvalGraph } from './components/EvalGraph';
import { SummaryPanel } from './components/SummaryPanel';
import type { ParsedGame } from './chess/types';

const SAMPLE = `[White "Alice"]\n[Black "Bob"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 *`;
const DEPTH = 14;

export default function App() {
  const [pgn, setPgn] = useState(SAMPLE);
  const [game, setGame] = useState<ParsedGame | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [ply, setPly] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setReview(null);
    let parsed: ParsedGame;
    try {
      parsed = parsePgn(pgn);
    } catch {
      setError('Invalid PGN');
      return;
    }
    setGame(parsed);
    setPly(0);
    setProgress('Analyzing…');
    try {
      const analyses = await analyzeGame(parsed, DEPTH, (d, t) => setProgress(`Analyzing ${d}/${t}`));
      setReview(assembleReview(parsed, analyses, OPENINGS));
      setProgress(null);
    } catch (e) {
      setError('Analysis failed (engine could not load).');
      setProgress(null);
    }
  }

  const fen = useMemo(() => {
    if (!game) return undefined;
    if (ply === 0) return game.plies[0]?.fenBefore;
    return game.plies[ply - 1]?.fenAfter;
  }, [game, ply]);

  const arrow = useMemo((): [string, string] | null => {
    if (!review || ply === 0) return null;
    const uci = review.plies[ply - 1]?.bestMoveUci;
    return uci ? [uci.slice(0, 2), uci.slice(2, 4)] : null;
  }, [review, ply]);

  const whiteEvals = useMemo(() => {
    if (!review) return [];
    // Convert each ply's mover-perspective eval to white perspective for the graph.
    return review.plies.map((p) =>
      p.color === 'white' ? p.evalAfterCp : -p.evalAfterCp,
    );
  }, [review]);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h2>Chess Reviewer</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <textarea value={pgn} onChange={(e) => setPgn(e.target.value)} rows={6} cols={48} />
        <div>
          <button onClick={run}>Review game</button>
          {progress && <div>{progress}</div>}
          {error && <div style={{ color: 'red' }}>{error}</div>}
        </div>
      </div>

      {game && fen && (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          <div>
            <ReviewBoard fen={fen} arrow={arrow} />
            <div>
              <button onClick={() => setPly((p) => Math.max(0, p - 1))}>◀</button>
              <button onClick={() => setPly((p) => Math.min(game.plies.length, p + 1))}>▶</button>
              <span> ply {ply}/{game.plies.length}</span>
            </div>
            {review && (
              <EvalGraph evalsCp={whiteEvals} current={Math.max(0, ply - 1)} onSelect={(i) => setPly(i + 1)} />
            )}
          </div>
          {review && <MoveList plies={review.plies} current={ply} onSelect={setPly} />}
          {review && <SummaryPanel summary={review.summary} white={game.white} black={game.black} />}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the full flow in the browser**

Run: `npm run dev`, click "Review game".
Expected: progress counts up; then board + best-move arrow, move list with icons, eval graph, and a summary table with accuracies and the detected opening (Ruy Lopez). Stepping moves updates everything.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire full game review into the app"
```

---

# Phase 4 — chess.com import, polish, deploy

## Task 18: chess.com importer

**Files:**
- Create: `src/importers/chesscom.ts`, `src/importers/chesscom.test.ts`

- [ ] **Step 1: Write the failing test (pure helpers only)**

Create `src/importers/chesscom.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { summarizeGames, type ChessComGame } from './chesscom';

const games: ChessComGame[] = [
  {
    url: 'https://www.chess.com/game/live/123',
    pgn: '[White "a"]\n[Black "b"]\n\n1. e4 *',
    white: { username: 'a' }, black: { username: 'b' },
    end_time: 1700000000,
  } as ChessComGame,
];

describe('summarizeGames', () => {
  it('extracts id, players, and date for the picker', () => {
    const [s] = summarizeGames(games);
    expect(s.id).toBe('123');
    expect(s.white).toBe('a');
    expect(s.black).toBe('b');
    expect(s.pgn).toContain('1. e4');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/importers/chesscom.test.ts`
Expected: FAIL — `summarizeGames` not defined.

- [ ] **Step 3: Implement the importer**

Create `src/importers/chesscom.ts`:
```ts
export interface ChessComGame {
  url: string;
  pgn: string;
  end_time: number;
  white: { username: string };
  black: { username: string };
}

export interface GameSummary {
  id: string;
  url: string;
  white: string;
  black: string;
  date: string;
  pgn: string;
}

function gameId(url: string): string {
  const m = url.match(/(\d+)\/?$/);
  return m ? m[1] : url;
}

export function summarizeGames(games: ChessComGame[]): GameSummary[] {
  return games.map((g) => ({
    id: gameId(g.url),
    url: g.url,
    white: g.white.username,
    black: g.black.username,
    date: new Date(g.end_time * 1000).toISOString().slice(0, 10),
    pgn: g.pgn,
  }));
}

const BASE = 'https://api.chess.com/pub';

export async function fetchArchives(username: string): Promise<string[]> {
  const r = await fetch(`${BASE}/player/${username.toLowerCase()}/games/archives`);
  if (!r.ok) throw new Error(`chess.com: user "${username}" not found (${r.status})`);
  const data = (await r.json()) as { archives: string[] };
  return data.archives;
}

// Fetch the most recent month's games for a user, newest first.
export async function fetchRecentGames(username: string): Promise<GameSummary[]> {
  const archives = await fetchArchives(username);
  if (archives.length === 0) return [];
  const r = await fetch(archives[archives.length - 1]);
  if (!r.ok) throw new Error(`chess.com: could not load games (${r.status})`);
  const data = (await r.json()) as { games: ChessComGame[] };
  return summarizeGames(data.games).reverse();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/importers/chesscom.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/importers/chesscom.ts src/importers/chesscom.test.ts
git commit -m "feat: chess.com importer (archives + game summaries)"
```

---

## Task 19: ImportPanel with PGN + chess.com username flows

**Files:**
- Create: `src/components/ImportPanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement ImportPanel**

Create `src/components/ImportPanel.tsx`:
```tsx
import { useState } from 'react';
import { fetchRecentGames, type GameSummary } from '../importers/chesscom';

interface Props {
  onPgn: (pgn: string) => void;   // hand a chosen game's PGN to the app
}

export function ImportPanel({ onPgn }: Props) {
  const [pgn, setPgn] = useState('');
  const [username, setUsername] = useState('');
  const [games, setGames] = useState<GameSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadUser() {
    setError(null);
    setGames([]);
    setLoading(true);
    try {
      setGames(await fetchRecentGames(username.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load games');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      <div>
        <h4>Paste PGN</h4>
        <textarea value={pgn} onChange={(e) => setPgn(e.target.value)} rows={6} cols={40} />
        <div><button onClick={() => onPgn(pgn)} disabled={!pgn.trim()}>Review this PGN</button></div>
      </div>
      <div>
        <h4>From chess.com</h4>
        <input
          placeholder="chess.com username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button onClick={loadUser} disabled={!username.trim() || loading}>
          {loading ? 'Loading…' : 'Load recent games'}
        </button>
        {error && <div style={{ color: 'red' }}>{error}</div>}
        <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
          {games.map((g) => (
            <div key={g.id} style={{ padding: '2px 0' }}>
              <button onClick={() => onPgn(g.pgn)} title={g.url}>
                #{g.id} — {g.white} vs {g.black} ({g.date})
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Use ImportPanel in App**

In `src/App.tsx`, replace the `<textarea>`/`<button onClick={run}>` import block with the panel, and make `run` accept a PGN argument:

Change the `run` signature and call sites:
```tsx
async function run(pgnText: string) {
  setError(null);
  setReview(null);
  let parsed: ParsedGame;
  try {
    parsed = parsePgn(pgnText);
  } catch {
    setError('Invalid PGN');
    return;
  }
  setGame(parsed);
  setPly(0);
  setProgress('Analyzing…');
  try {
    const analyses = await analyzeGame(parsed, DEPTH, (d, t) => setProgress(`Analyzing ${d}/${t}`));
    setReview(assembleReview(parsed, analyses, OPENINGS));
    setProgress(null);
  } catch {
    setError('Analysis failed (engine could not load).');
    setProgress(null);
  }
}
```
And replace the input block markup with:
```tsx
import { ImportPanel } from './components/ImportPanel';
// ...
<ImportPanel onPgn={run} />
{progress && <div>{progress}</div>}
{error && <div style={{ color: 'red' }}>{error}</div>}
```
Remove the now-unused `pgn`/`setPgn` state and `SAMPLE` if no longer referenced.

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`. Test both paths: (a) paste a PGN → Review; (b) type a real chess.com username (e.g. `hikaru`) → Load recent games → click one → it reviews.
Expected: both paths produce a full review. Unknown usernames show a friendly error.

- [ ] **Step 4: Commit**

```bash
git add src/components/ImportPanel.tsx src/App.tsx
git commit -m "feat: import panel with PGN paste and chess.com username flow"
```

---

## Task 20: Full test run, README, and deploy config

**Files:**
- Create: `README.md`, `vercel.json`
- Modify: `vite.config.ts` (base path if needed)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all unit tests pass (pgnParser, uci, material, winPercent, accuracy, classifier, openingDetector, assemble, chesscom).

- [ ] **Step 2: Production build check**

Run: `npm run build`
Expected: `tsc -b` passes and `vite build` outputs `dist/` with the engine assets under `dist/engine/`. If the engine 404s in preview, confirm the files are in `public/engine/` (Vite copies `public/` verbatim).

Run: `npm run preview` and click through one review to confirm the built app works.

- [ ] **Step 3: Write the README**

Create `README.md`:
```markdown
# ChessReviewer

A browser-only chess Game Review tool (chess.com-style). Paste a PGN or import
a game from a chess.com username, and Stockfish (running in your browser)
analyzes every move: classification (Brilliant/Great/Best/…/Blunder), accuracy
%, evaluation graph, best-move arrows, and opening detection. No backend, no
accounts, no token cost.

## Develop

    npm install
    npm run dev

## Test

    npm test

## Build & deploy

    npm run build      # outputs dist/
    npm run preview    # serve the production build locally

Deploy `dist/` to any static host (Vercel/Netlify). The Stockfish engine files
live in `public/engine/` and are copied into the build automatically.

## Notes

- Move classification uses win%-drop thresholds tuned in `src/analysis/thresholds.ts`.
- The bundled opening set in `data/openings.sample.ts` is small; drop in the full
  Lichess ECO set (same shape) for complete opening coverage.
- Analysis depth is set in `src/App.tsx` (`DEPTH`).
```

- [ ] **Step 4: Add a Vercel config**

Create `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

- [ ] **Step 5: Commit**

```bash
git add README.md vercel.json vite.config.ts
git commit -m "docs: README + deploy config; verify full build"
```

- [ ] **Step 6: Deploy (optional, when ready)**

Run: `npx vercel --prod` (or connect the repo in the Vercel dashboard / drag `dist/` to Netlify).
Expected: a public URL serving the app.

---

## Done criteria

- All unit tests pass (`npm test`).
- `npm run build` succeeds and the previewed build reviews a game end-to-end.
- A user can: paste a PGN OR import via chess.com username, see per-move
  classifications with chess.com-style icons, per-player accuracy, an eval
  graph, best-move arrows, and the detected opening.
```
