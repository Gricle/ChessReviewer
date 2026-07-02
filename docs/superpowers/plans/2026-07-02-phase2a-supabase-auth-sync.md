# Phase 2a: Supabase Foundation — Auth + Auto-Save Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can sign in (email/password or Google) and every completed review auto-saves to Supabase Postgres in the background with an offline retry queue; guests keep the full existing experience untouched.

**Architecture:** A nullable Supabase client (null when env vars are absent → the whole feature silently disables). Pure modules do the heavy lifting so they're unit-testable without any network: `gamePhase` (FEN → opening/middlegame/endgame), `mapReview` (ParsedGame + Review → DB row payloads), `syncQueue` (localStorage-backed pending-upload queue with injected uploader). Thin impure edges: `client.ts`, `uploadReview` (3 table writes), `useAuth` hook, `AuthBar` UI, and two `useEffect`s in App that enqueue+flush. Schema lives in a versioned SQL migration with RLS on every table.

**Tech Stack:** @supabase/supabase-js v2, existing Vite + React 19 + TypeScript + Vitest (jsdom, globals enabled).

**Context notes for the implementer:**
- Run tests with `npm test` (`vitest run`); filter with `npm test -- <path>`. Build: `npm run build`. Lint: `npm run lint`.
- Analysis logic lives in pure modules under `src/analysis/` with adjacent `*.test.ts`; chess utilities under `src/chess/`. Follow that pattern for the new `src/supabase/` directory.
- Key existing types (src/chess/types.ts): `ParsedGame { plies, headers, white, black }`, `AnalyzedPly extends Ply { bestMoveUci, evalBeforeCp, evalAfterCp, classification, accuracy }`, `ReviewSummary { opening, whiteAccuracy, blackAccuracy, counts, estRating }`. `Review { plies: AnalyzedPly[]; summary: ReviewSummary }` is exported from src/analysis/assemble.ts. `cpToWinPercent(cp)` is exported from src/analysis/winPercent.ts. `playerRatings(headers)` from src/chess/ratings.ts.
- `.gitignore` already covers `*.local`, so `.env.local` (where the user puts real keys) is never committed. `.env.example` IS committed.
- The user has NOT created the Supabase project yet. Nothing in this plan requires a live backend to build or test — all tests are pure/local. Manual end-to-end verification happens after the user provisions the project (final task notes).
- Scope split: this plan (2a) covers client, schema, auth, and auto-save sync. The game library page and the profile page (display name, linked chess.com/lichess usernames) are Phase 2b — a separate plan. The `profiles` table ships now (2a) so signup creates rows from day one.

---

### Task 1: Supabase dependency + nullable client + env plumbing

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/supabase/client.ts`
- Create: `.env.example`

No unit test (trivial env wiring; anything importing this in tests would need env stubs — pure modules in later tasks deliberately do NOT import it).

- [ ] **Step 1: Install the SDK**

Run: `npm install @supabase/supabase-js`
Expected: adds `"@supabase/supabase-js": "^2.x"` to dependencies, no errors.

- [ ] **Step 2: Create the nullable client**

Create `src/supabase/client.ts`:

```ts
// Single Supabase client for the whole app — or null when the env vars are
// missing, which turns every cloud feature into a silent no-op (guest-only
// build). Real keys go in .env.local (gitignored); see .env.example.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;
```

- [ ] **Step 3: Create .env.example**

Create `.env.example`:

```
# Copy to .env.local and fill in from your Supabase project settings
# (Project Settings → API). Without these the app runs in guest-only mode.
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

- [ ] **Step 4: Verify build + existing tests**

Run: `npm run build` — expected: clean (client.ts compiles; tree-shaken no-op without env).
Run: `npm test` — expected: 51/51 still passing.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/supabase/client.ts .env.example
git commit -m "feat: supabase client with guest-mode fallback when unconfigured"
```

---

### Task 2: Database schema migration + RLS + setup docs

**Files:**
- Create: `supabase/migrations/20260702000000_init.sql`
- Modify: `README.md` (append a "Cloud sync (optional)" section)

No unit test (SQL is applied to the hosted project; RLS is exercised in the final manual verification).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260702000000_init.sql`:

```sql
-- ChessReviewer cloud schema: profiles, games, reviews, move_facts.
-- Every table has RLS so users only ever see their own rows.

-- ── profiles ──────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  chesscom_username text,
  lichess_username text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: own rows" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row on signup.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── games ─────────────────────────────────────────────────────────────────
create table public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pgn text not null,
  white_name text not null,
  black_name text not null,
  white_rating int,
  black_rating int,
  result text,
  played_at date,
  source text not null default 'paste',
  opening_eco text,
  opening_name text,
  created_at timestamptz not null default now()
);

-- Same game re-analyzed by the same user overwrites instead of duplicating.
create unique index games_user_pgn_uniq on public.games (user_id, md5(pgn));
create index games_user_created_idx on public.games (user_id, created_at desc);

alter table public.games enable row level security;

create policy "games: own rows" on public.games
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── reviews ───────────────────────────────────────────────────────────────
create table public.reviews (
  game_id uuid primary key references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  white_accuracy real not null,
  black_accuracy real not null,
  white_est_rating int not null,
  black_est_rating int not null,
  counts jsonb not null,
  analysis jsonb not null,
  depth int not null,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

create policy "reviews: own rows" on public.reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── move_facts (one row per move; fuels Phase 6 weakness reports) ────────
create table public.move_facts (
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ply int not null,
  side text not null check (side in ('white', 'black')),
  classification text not null,
  win_drop real not null,
  phase text not null check (phase in ('opening', 'middlegame', 'endgame')),
  primary key (game_id, ply)
);

create index move_facts_user_idx on public.move_facts (user_id, classification);

alter table public.move_facts enable row level security;

create policy "move_facts: own rows" on public.move_facts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Append setup docs to README.md**

Append to `README.md` (after the "Build & deploy" section):

```markdown
## Cloud sync (optional)

Reviews auto-save to your account when Supabase is configured; without it the
app is fully functional in guest mode.

1. Create a free project at https://supabase.com.
2. In the SQL editor, run `supabase/migrations/20260702000000_init.sql`
   (or `supabase db push` with the CLI).
3. Auth → Providers: enable Email; optionally enable Google (add your OAuth
   client, and add the app origin to the redirect allow-list).
4. Copy `.env.example` to `.env.local` and fill in the Project URL and anon
   key from Project Settings → API.

Row-level security restricts every table to the signed-in user's own rows.
```

- [ ] **Step 3: Sanity-check the SQL statement order**

Read the migration top to bottom: every referenced object (`auth.users`, `public.games` before `reviews`/`move_facts` FKs) must be defined before use. Expected: profiles → trigger → games → reviews → move_facts. No command to run (no local Postgres); this is a read-through check.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260702000000_init.sql README.md
git commit -m "feat: supabase schema migration with RLS + setup docs"
```

---

### Task 3: Game-phase classifier (pure, TDD)

**Files:**
- Create: `src/analysis/gamePhase.ts`
- Test: `src/analysis/gamePhase.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/analysis/gamePhase.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { gamePhase } from './gamePhase';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// All 14 minor/major pieces still on board, deep into the game:
const MIDDLE = 'r1bq1rk1/pp2bppp/2n1pn2/3p4/3P4/2NBPN2/PP3PPP/R1BQ1RK1 w - - 0 10';
// King + pawns each plus one rook each (2 minor/major total):
const ROOK_END = '8/5pk1/8/8/8/8/5PK1/R6r w - - 0 40';

describe('gamePhase', () => {
  it('start position at ply 0 is opening', () => {
    expect(gamePhase(START, 0)).toBe('opening');
  });

  it('full material before ply 20 is opening', () => {
    expect(gamePhase(MIDDLE, 18)).toBe('opening');
  });

  it('full material from ply 20 on is middlegame', () => {
    expect(gamePhase(MIDDLE, 20)).toBe('middlegame');
  });

  it('six or fewer minor/major pieces is endgame regardless of ply', () => {
    expect(gamePhase(ROOK_END, 10)).toBe('endgame');
    expect(gamePhase(ROOK_END, 80)).toBe('endgame');
  });

  it('pawns and kings never count toward the endgame threshold', () => {
    // 16 pawns + kings only → 0 minor/major pieces → endgame
    expect(gamePhase('4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 30', 30)).toBe('endgame');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/analysis/gamePhase.test.ts`
Expected: FAIL — cannot resolve `./gamePhase`.

- [ ] **Step 3: Write the implementation**

Create `src/analysis/gamePhase.ts`:

```ts
// Coarse game-phase tag for a position, used to bucket move_facts so
// weakness reports can say "you collapse in the endgame". Heuristic:
// few minor/major pieces left → endgame; otherwise early plies → opening.

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

const OPENING_PLIES = 20;      // first 10 full moves
const ENDGAME_PIECE_LIMIT = 6; // total N/B/R/Q (both sides) at or below → endgame

export function gamePhase(fen: string, plyIndex: number): GamePhase {
  const board = fen.split(' ')[0];
  const minorMajor = (board.match(/[nbrq]/gi) ?? []).length;
  if (minorMajor <= ENDGAME_PIECE_LIMIT) return 'endgame';
  return plyIndex < OPENING_PLIES ? 'opening' : 'middlegame';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/analysis/gamePhase.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/analysis/gamePhase.ts src/analysis/gamePhase.test.ts
git commit -m "feat: game-phase classifier for move facts"
```

---

### Task 4: Review → DB-rows mapper (pure, TDD)

**Files:**
- Create: `src/supabase/mapReview.ts`
- Test: `src/supabase/mapReview.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/supabase/mapReview.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mapReview } from './mapReview';
import { parsePgn } from '../chess/pgnParser';
import { assembleReview } from '../analysis/assemble';
import { OPENINGS } from '../data/openings.sample';
import type { ParsedGame, PositionAnalysis } from '../chess/types';

const PGN = `[White "Hikaru"]
[Black "Magnus"]
[WhiteElo "2802"]
[BlackElo "2839"]
[Result "1/2-1/2"]
[Date "2024.03.15"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 1/2-1/2`;

function flatAnalyses(g: ParsedGame): Map<string, PositionAnalysis> {
  const m = new Map<string, PositionAnalysis>();
  const add = (fen: string, bestUci: string) =>
    m.set(fen, { fen, bestMoveUci: bestUci, bestEvalCp: 0, secondBestEvalCp: 0, mate: null });
  g.plies.forEach((p) => add(p.fenBefore, p.uci));
  add(g.plies[g.plies.length - 1].fenAfter, 'a2a3');
  return m;
}

function fixture() {
  const game = parsePgn(PGN);
  const review = assembleReview(game, flatAnalyses(game), OPENINGS);
  return mapReview(game, review, 'paste', 14);
}

describe('mapReview', () => {
  it('maps game metadata including ratings and opening', () => {
    const { game } = fixture();
    expect(game.pgn).toContain('1. e4 e5');
    expect(game.white_name).toBe('Hikaru');
    expect(game.black_name).toBe('Magnus');
    expect(game.white_rating).toBe(2802);
    expect(game.black_rating).toBe(2839);
    expect(game.result).toBe('1/2-1/2');
    expect(game.played_at).toBe('2024-03-15');
    expect(game.source).toBe('paste');
    expect(game.opening_name).toBe('Ruy Lopez');
  });

  it('maps review numbers and embeds full analysis', () => {
    const { review } = fixture();
    expect(review.white_accuracy).toBeGreaterThan(99);
    expect(review.black_accuracy).toBeGreaterThan(99);
    expect(review.white_est_rating).toBeGreaterThanOrEqual(2500);
    expect(review.depth).toBe(14);
    expect(review.counts.book).toEqual({ white: 3, black: 2 });
    expect(review.analysis.plies).toHaveLength(5);
    expect(review.analysis.summary.opening?.name).toBe('Ruy Lopez');
  });

  it('produces one move_fact per ply with phase and win_drop', () => {
    const { move_facts } = fixture();
    expect(move_facts).toHaveLength(5);
    expect(move_facts[0]).toMatchObject({ ply: 0, side: 'white', classification: 'book', phase: 'opening' });
    for (const f of move_facts) {
      expect(f.win_drop).toBeGreaterThanOrEqual(0);
      expect(['opening', 'middlegame', 'endgame']).toContain(f.phase);
    }
  });

  it('nulls ratings, result and date when headers are absent', () => {
    const game = parsePgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 *');
    const review = assembleReview(game, flatAnalyses(game), OPENINGS);
    const mapped = mapReview(game, review, 'lichess', 14);
    expect(mapped.game.white_rating).toBeNull();
    expect(mapped.game.black_rating).toBeNull();
    expect(mapped.game.played_at).toBeNull();
    expect(mapped.game.source).toBe('lichess');
    // chess.js emits Result "*" for unfinished games — must not be stored as a result
    expect(mapped.game.result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/supabase/mapReview.test.ts`
Expected: FAIL — cannot resolve `./mapReview`.

- [ ] **Step 3: Write the implementation**

Create `src/supabase/mapReview.ts`:

```ts
// Pure mapping from an in-memory review to the row payloads uploadReview
// writes to Postgres. No supabase import — unit-testable offline.
import type { ParsedGame } from '../chess/types';
import type { Review } from '../analysis/assemble';
import { playerRatings } from '../chess/ratings';
import { cpToWinPercent } from '../analysis/winPercent';
import { gamePhase } from '../analysis/gamePhase';

export type GameSource = 'paste' | 'chesscom' | 'lichess';

export interface ReviewUpload {
  game: {
    pgn: string;
    white_name: string;
    black_name: string;
    white_rating: number | null;
    black_rating: number | null;
    result: string | null;
    played_at: string | null; // ISO date
    source: GameSource;
    opening_eco: string | null;
    opening_name: string | null;
  };
  review: {
    white_accuracy: number;
    black_accuracy: number;
    white_est_rating: number;
    black_est_rating: number;
    counts: Review['summary']['counts'];
    analysis: { plies: Review['plies']; summary: Review['summary'] };
    depth: number;
  };
  move_facts: Array<{
    ply: number;
    side: 'white' | 'black';
    classification: string;
    win_drop: number;
    phase: 'opening' | 'middlegame' | 'endgame';
  }>;
}

// PGN dates are "YYYY.MM.DD", possibly with "??" parts for unknowns.
function pgnDateToIso(value: string | undefined): string | null {
  if (!value) return null;
  const iso = value.replaceAll('.', '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

export function mapReview(
  game: ParsedGame,
  review: Review,
  source: GameSource,
  depth: number,
  pgn?: string,
): ReviewUpload {
  const ratings = playerRatings(game.headers);
  const result = game.headers.Result && game.headers.Result !== '*' ? game.headers.Result : null;
  const opening = review.summary.opening;

  return {
    game: {
      pgn: pgn ?? reconstructPgn(game),
      white_name: game.white,
      black_name: game.black,
      white_rating: ratings.white,
      black_rating: ratings.black,
      result,
      played_at: pgnDateToIso(game.headers.UTCDate ?? game.headers.Date),
      source,
      opening_eco: opening?.eco ?? null,
      opening_name: opening?.name ?? null,
    },
    review: {
      white_accuracy: review.summary.whiteAccuracy,
      black_accuracy: review.summary.blackAccuracy,
      white_est_rating: review.summary.estRating.white,
      black_est_rating: review.summary.estRating.black,
      counts: review.summary.counts,
      analysis: { plies: review.plies, summary: review.summary },
      depth,
    },
    move_facts: review.plies.map((p) => ({
      ply: p.index,
      side: p.color,
      classification: p.classification,
      win_drop: Math.max(
        0,
        cpToWinPercent(p.evalBeforeCp) - cpToWinPercent(p.evalAfterCp),
      ),
      phase: gamePhase(p.fenBefore, p.index),
    })),
  };
}

// Minimal PGN reconstruction from parsed plies + headers (used when the
// original text isn't passed in). Good enough for storage/dedup purposes.
function reconstructPgn(game: ParsedGame): string {
  const headerLines = Object.entries(game.headers)
    .map(([k, v]) => `[${k} "${v}"]`)
    .join('\n');
  const moves = game.plies
    .map((p, i) => (i % 2 === 0 ? `${p.moveNumber}. ${p.san}` : p.san))
    .join(' ');
  const result = game.headers.Result ?? '*';
  return `${headerLines}\n\n${moves} ${result}`.trim();
}
```

Note: App wiring (Task 7) always passes the original `pgn` text; `reconstructPgn` is only a fallback for callers that don't have it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/supabase/mapReview.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: 60/60 passing (51 + 5 gamePhase + 4 mapReview).

- [ ] **Step 6: Commit**

```bash
git add src/supabase/mapReview.ts src/supabase/mapReview.test.ts
git commit -m "feat: pure review-to-rows mapper for cloud sync"
```

---

### Task 5: Offline retry queue (pure, TDD)

**Files:**
- Create: `src/supabase/syncQueue.ts`
- Test: `src/supabase/syncQueue.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/supabase/syncQueue.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadQueue, enqueue, flushQueue, hashString, QUEUE_KEY } from './syncQueue';
import type { ReviewUpload } from './mapReview';

// Minimal fake payload — the queue never inspects its contents.
const payload = { game: { pgn: 'x' } } as unknown as ReviewUpload;

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() { return map.size; },
  } as Storage;
}

let storage: Storage;
beforeEach(() => { storage = makeStorage(); });

describe('syncQueue', () => {
  it('starts empty', () => {
    expect(loadQueue(storage)).toEqual([]);
  });

  it('enqueue persists and loadQueue round-trips', () => {
    enqueue(storage, payload, 'id-1');
    enqueue(storage, payload, 'id-2');
    expect(loadQueue(storage).map((q) => q.id)).toEqual(['id-1', 'id-2']);
  });

  it('enqueue with a duplicate id replaces instead of duplicating', () => {
    enqueue(storage, payload, 'id-1');
    enqueue(storage, payload, 'id-1');
    expect(loadQueue(storage)).toHaveLength(1);
  });

  it('recovers from corrupt storage', () => {
    storage.setItem(QUEUE_KEY, '{not json');
    expect(loadQueue(storage)).toEqual([]);
  });

  it('flushQueue removes succeeded items and returns 0 remaining', async () => {
    enqueue(storage, payload, 'id-1');
    enqueue(storage, payload, 'id-2');
    const uploaded: string[] = [];
    const remaining = await flushQueue(storage, async (p, id) => { uploaded.push(id); });
    expect(remaining).toBe(0);
    expect(uploaded).toEqual(['id-1', 'id-2']);
    expect(loadQueue(storage)).toEqual([]);
  });

  it('flushQueue keeps failed items for the next retry', async () => {
    enqueue(storage, payload, 'ok');
    enqueue(storage, payload, 'bad');
    const remaining = await flushQueue(storage, async (_p, id) => {
      if (id === 'bad') throw new Error('network down');
    });
    expect(remaining).toBe(1);
    expect(loadQueue(storage).map((q) => q.id)).toEqual(['bad']);
  });

  it('hashString is deterministic and separates different strings', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
    expect(hashString('')).toBe(hashString(''));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/supabase/syncQueue.test.ts`
Expected: FAIL — cannot resolve `./syncQueue`.

- [ ] **Step 3: Write the implementation**

Create `src/supabase/syncQueue.ts`:

```ts
// localStorage-backed queue of pending review uploads. Write-behind sync:
// the review UI never waits on the network; failed uploads stay queued and
// are retried on the next flush (login, next review, or app start).
import type { ReviewUpload } from './mapReview';

export const QUEUE_KEY = 'chessreviewer.pendingUploads';

export interface QueuedUpload {
  id: string;
  payload: ReviewUpload;
}

export function loadQueue(storage: Storage): QueuedUpload[] {
  try {
    const raw = storage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(storage: Storage, queue: QueuedUpload[]): void {
  storage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(storage: Storage, payload: ReviewUpload, id: string): void {
  const queue = loadQueue(storage).filter((q) => q.id !== id);
  queue.push({ id, payload });
  saveQueue(storage, queue);
}

// djb2 — stable, dependency-free string hash for building queue ids.
// Deterministic ids let React StrictMode's double effect invocation replace
// instead of duplicate, while still keying distinct games separately.
export function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

// Attempts every queued upload once; keeps failures. Returns how many remain.
export async function flushQueue(
  storage: Storage,
  upload: (payload: ReviewUpload, id: string) => Promise<void>,
): Promise<number> {
  const queue = loadQueue(storage);
  const failed: QueuedUpload[] = [];
  for (const item of queue) {
    try {
      await upload(item.payload, item.id);
    } catch {
      failed.push(item);
    }
  }
  saveQueue(storage, failed);
  return failed.length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/supabase/syncQueue.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/supabase/syncQueue.ts src/supabase/syncQueue.test.ts
git commit -m "feat: offline retry queue for review uploads"
```

---

### Task 6: uploadReview + useAuth hook + AuthBar UI

**Files:**
- Create: `src/supabase/uploadReview.ts`
- Create: `src/supabase/useAuth.ts`
- Create: `src/components/AuthBar.tsx`
- Modify: `src/index.css` (append auth styles)

No unit tests (all three are thin impure edges over the SDK; the pure logic they carry was tested in Tasks 4-5; end-to-end behavior is verified manually after project provisioning).

- [ ] **Step 1: Create uploadReview**

Create `src/supabase/uploadReview.ts`:

```ts
// Writes one ReviewUpload to Postgres: games (insert-or-find by unique
// (user_id, md5(pgn))), reviews (upsert), move_facts (replace).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReviewUpload } from './mapReview';

const UNIQUE_VIOLATION = '23505';

export async function uploadReview(
  client: SupabaseClient,
  userId: string,
  u: ReviewUpload,
): Promise<void> {
  let gameId: string;
  const inserted = await client
    .from('games')
    .insert({ ...u.game, user_id: userId })
    .select('id')
    .single();

  if (inserted.error) {
    if (inserted.error.code !== UNIQUE_VIOLATION) throw new Error(inserted.error.message);
    // Same user re-analyzed the same PGN — find the existing row.
    const found = await client
      .from('games')
      .select('id')
      .eq('user_id', userId)
      .eq('pgn', u.game.pgn)
      .single();
    if (found.error) throw new Error(found.error.message);
    gameId = found.data.id;
  } else {
    gameId = inserted.data.id;
  }

  const review = await client
    .from('reviews')
    .upsert({ ...u.review, game_id: gameId, user_id: userId });
  if (review.error) throw new Error(review.error.message);

  const cleared = await client.from('move_facts').delete().eq('game_id', gameId);
  if (cleared.error) throw new Error(cleared.error.message);

  const facts = await client
    .from('move_facts')
    .insert(u.move_facts.map((m) => ({ ...m, game_id: gameId, user_id: userId })));
  if (facts.error) throw new Error(facts.error.message);
}
```

- [ ] **Step 2: Create useAuth**

Create `src/supabase/useAuth.ts`:

```ts
// Session state + auth actions. When supabase is null (no env config) the
// hook reports { enabled: false } and the UI renders nothing auth-related.
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './client';

export interface Auth {
  enabled: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

export function useAuth(): Auth {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return {
    enabled: supabase !== null,
    user,
    signIn: async (email, password) => {
      if (!supabase) return 'Cloud sync is not configured.';
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? error.message : null;
    },
    signUp: async (email, password) => {
      if (!supabase) return 'Cloud sync is not configured.';
      const { error } = await supabase.auth.signUp({ email, password });
      return error ? error.message : null;
    },
    signInWithGoogle: async () => {
      if (!supabase) return 'Cloud sync is not configured.';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
      });
      return error ? error.message : null;
    },
    signOut: async () => {
      if (supabase) await supabase.auth.signOut();
    },
  };
}
```

- [ ] **Step 3: Create AuthBar**

Create `src/components/AuthBar.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import type { Auth } from '../supabase/useAuth';

interface Props {
  auth: Auth;
}

export function AuthBar({ auth }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!auth.enabled) return null;

  if (auth.user) {
    return (
      <div className="authbar">
        <span className="auth-email" title={auth.user.email}>{auth.user.email}</span>
        <button onClick={() => void auth.signOut()}>Sign out</button>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const err = mode === 'signin'
      ? await auth.signIn(email, password)
      : await auth.signUp(email, password);
    setBusy(false);
    if (err) {
      setError(err);
    } else if (mode === 'signup') {
      setError('Check your email to confirm your account.');
    } else {
      setOpen(false);
    }
  }

  return (
    <div className="authbar">
      <button className="primary" onClick={() => { setOpen(true); setError(null); }}>
        Sign in
      </button>

      {open && (
        <div className="auth-overlay" onClick={() => setOpen(false)}>
          <div className="card auth-modal" onClick={(e) => e.stopPropagation()}>
            <h4>{mode === 'signin' ? 'Sign in' : 'Create account'}</h4>
            <form onSubmit={submit}>
              <input
                type="email"
                placeholder="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              <input
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button className="primary" type="submit" disabled={busy}>
                {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>
            <button className="auth-google" onClick={() => void auth.signInWithGoogle()}>
              Continue with Google
            </button>
            <button
              className="auth-switch"
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
            >
              {mode === 'signin' ? 'No account? Create one' : 'Have an account? Sign in'}
            </button>
            {error && <div className="err">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Append auth CSS**

Append to `src/index.css`:

```css
/* ── auth ── */
.authbar { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.auth-email { color: var(--text-dim); font-size: 13px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.auth-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(0, 0, 0, 0.55);
  display: flex; align-items: center; justify-content: center;
}
.auth-modal { width: min(340px, 90vw); padding: 20px; display: flex; flex-direction: column; gap: 10px; }
.auth-modal h4 { margin: 0 0 4px; }
.auth-modal form { display: flex; flex-direction: column; gap: 10px; }
.auth-modal input {
  background: var(--bg); color: var(--text);
  border: 1px solid var(--line-strong); border-radius: 6px;
  padding: 9px 10px; font-size: 14px;
}
.auth-google { border: 1px solid var(--line-strong); }
.auth-switch { background: none; border: none; color: var(--text-mute); font-size: 12px; cursor: pointer; }
.auth-switch:hover { color: var(--text); }
```

- [ ] **Step 5: Verify build + tests**

Run: `npm test` — expected: 60/60 (nothing new imports test-side).
Run: `npm run build` — expected: clean.
Run: `npm run lint` — expected: no new issues.

- [ ] **Step 6: Commit**

```bash
git add src/supabase/uploadReview.ts src/supabase/useAuth.ts src/components/AuthBar.tsx src/index.css
git commit -m "feat: auth hook, sign-in UI, and review upload writer"
```

---

### Task 7: Wire sync into App (source threading + auto-save effects)

**Files:**
- Modify: `src/components/ImportPanel.tsx` (thread the source of each PGN)
- Modify: `src/App.tsx`

No new unit tests (App-level wiring over already-tested modules); verified via full suite + build + the manual checklist in Step 6.

- [ ] **Step 1: Thread source through ImportPanel**

In `src/components/ImportPanel.tsx`, change the Props interface:

```ts
import type { GameSource } from '../supabase/mapReview';

interface Props {
  onPgn: (pgn: string, source: GameSource) => void;
}
```

and update the three call sites:
- Paste button: `onClick={() => onPgn(pgn, 'paste')}`
- chess.com game buttons: `onClick={() => onPgn(g.pgn, 'chesscom')}`
- lichess game buttons: `onClick={() => onPgn(g.pgn, 'lichess')}`

- [ ] **Step 2: Wire App.tsx**

In `src/App.tsx`:

a) Add imports:

```ts
import { supabase } from './supabase/client';
import { useAuth } from './supabase/useAuth';
import { AuthBar } from './components/AuthBar';
import { mapReview, type GameSource } from './supabase/mapReview';
import { uploadReview } from './supabase/uploadReview';
import { enqueue, flushQueue, hashString } from './supabase/syncQueue';
```

b) Inside `App()`, add state/hooks (next to the other useState calls):

```ts
const auth = useAuth();
const [lastImport, setLastImport] = useState<{ pgn: string; source: GameSource } | null>(null);
```

c) Change `run` to record the import (signature + first line):

```ts
async function run(pgnText: string, source: GameSource = 'paste') {
  setLastImport({ pgn: pgnText, source });
  // ...existing body unchanged...
```

d) Add the two sync effects after the autoplay effect:

```ts
// ── cloud sync: enqueue each finished review, then flush ──
useEffect(() => {
  if (!review || !game || !lastImport || !supabase || !auth.user) return;
  const userId = auth.user.id;
  const payload = mapReview(game, review, lastImport.source, DEPTH, lastImport.pgn);
  enqueue(localStorage, payload, `${userId}:${hashString(lastImport.pgn)}`);
  void flushQueue(localStorage, (p) => uploadReview(supabase, userId, p));
}, [review]);

// Retry anything pending whenever a user (re)appears.
useEffect(() => {
  if (!supabase || !auth.user) return;
  const userId = auth.user.id;
  void flushQueue(localStorage, (p) => uploadReview(supabase, userId, p));
}, [auth.user?.id]);
```

Note on the queue id: it is deliberately deterministic (`userId:hash(pgn)`) rather than random, so React StrictMode's double effect invocation in dev replaces instead of duplicating the queue entry, while distinct games still get distinct ids. The server additionally dedupes by (user_id, md5(pgn)).

Note on effect deps: both effects intentionally omit dependencies (`game`, `lastImport`, `auth.user` in the first; `flushQueue` args in the second) — only a fresh `review` / a changed user id may trigger them. If `npm run lint` flags exhaustive-deps here, that matches the pre-existing accepted pattern in CoachCard.tsx/ReviewBoard.tsx — do NOT "fix" it by adding deps (that would re-upload on every login toggle); leave the warning.

e) Render AuthBar in the topbar (tagline stays):

```tsx
<header className="topbar">
  <div className="brand"><span className="pc">♞</span> Chess Reviewer</div>
  <div className="tagline">Paste a PGN or import from chess.com / lichess.org — Stockfish analyzes every move in-browser</div>
  <AuthBar auth={auth} />
</header>
```

f) ImportPanel usage is unchanged (`<ImportPanel onPgn={run} />` — `run` now matches the new two-arg signature).

- [ ] **Step 3: Full verification**

Run: `npm test` — expected: 60/60.
Run: `npm run build` — expected: clean.
Run: `npm run lint` — expected: no NEW warnings (the two eslint-disable comments above are intentional: `lastImport`/`game`/`auth.user` must not retrigger the enqueue effect — only a fresh `review` may).

- [ ] **Step 4: Guest-mode smoke test (no Supabase project needed)**

Run: `npm run dev`, open http://localhost:5173/ChessReviewer/
Expected: with no `.env.local`, the app looks and behaves EXACTLY as before — no Sign in button (AuthBar renders null), paste + analyze works, nothing written to localStorage under `chessreviewer.pendingUploads`.

- [ ] **Step 5: Commit**

```bash
git add src/components/ImportPanel.tsx src/App.tsx
git commit -m "feat: auto-save reviews to supabase with offline retry queue"
```

- [ ] **Step 6: Manual end-to-end checklist (requires the user's Supabase project)**

Document for the controller/user — run once `.env.local` exists:

1. `npm run dev` → Sign in button appears in the topbar.
2. Create account (email confirm if enabled) → sign in → email shows in topbar.
3. Analyze a PGN → after analysis, Supabase Table Editor shows one row in `games`, one in `reviews`, N in `move_facts`.
4. Re-analyze the same PGN → still exactly one `games` row (dedup by md5), review overwritten.
5. Sign out → analyze → no new rows (guest).
6. DevTools offline → sign in → analyze → row appears in localStorage queue; go online, analyze another game → queue flushes (localStorage entry empties, both games in DB).
7. Second browser/incognito with a second account → each account sees only its own rows (RLS).

---

## Status & deferred follow-ups (written 2026-07-02, post-merge)

Phase 2a merged to main at commit 8b2be2d. All 7 tasks implemented, reviewed, and verified (73/73 tests, guest-mode browser check green).

**User setup still pending (required before cloud sync works anywhere):**
1. Create the Supabase project; run `supabase/migrations/20260702000000_init.sql` in the SQL editor (full steps: README "Cloud sync (optional)").
2. Copy `.env.example` → `.env.local` with the project URL + anon key (enables sync on localhost).
3. For the deployed github.io site: add `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as GitHub Actions variables and pass them into the Pages workflow build step (2-line workflow edit).

**Code fast-follows (fold into Phase 2b):**
- uploadReview's 23505 dedup fallback `.eq('pgn', ...)` puts the full PGN in a GET URL → risk of 414 on long chess.com PGNs. Fix: add a `pgn_hash` column (client-side djb2 via syncQueue.hashString) + index, select by that. Failure today is safe (item stays queued) but retries forever.
- No poison-item eviction/attempt cap in syncQueue (deterministically failing payload retries on every flush).
- Sign-in-AFTER-analysis doesn't save the on-screen review (spec-compliant guest behavior, but flag for 2b UX — maybe a "Save this review" button when logging in with a review open).
- reviews table: add user_id index when Phase 6 lands.
- gamePhase tests: pin the 6/7-piece threshold edge and ply 19/20 boundary.

**Roadmap order agreed with user:** next is Phase 3 (cinematic reveal + audio) then Phase 4 (full UI redesign), THEN Phase 2b (game library + profile page), then Phases 5-6. See the design spec for scope of each.
