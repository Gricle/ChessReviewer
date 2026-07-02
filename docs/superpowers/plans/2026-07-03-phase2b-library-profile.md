# Phase 2b: Game Library + Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in users get a Library view listing their saved games (newest first) that reopens any past review instantly (no re-analysis), plus a profile card (display name, linked chess.com/lichess usernames). Also lands the Phase 2a fast-follow: `pgn_hash` column so the re-analyze dedup lookup stops putting whole PGNs in GET URLs.

**Architecture:** Still no router — App gains a `view: 'game' | 'library'` state and a topbar Library button (visible only when signed in). Pure module `rowToReview` reconstructs `{ ParsedGame, Review }` from a stored row (parsePgn + analysis jsonb) and is TDD'd. Thin supabase wrappers (`fetchLibrary`, `fetchSavedGame`, profile get/save) live in `src/supabase/library.ts`. `mapReview` adds `pgn_hash` (djb2 via the existing `hashString`); `uploadReview`'s 23505 fallback selects by hash instead of the pgn blob.

**Tech Stack:** existing stack, no new deps.

**Context notes:**
- `npm test` = vitest run (90 tests / 18 files at branch start). Suite conventions as before.
- Existing modules: `hashString` (src/supabase/syncQueue.ts), `mapReview`/`ReviewUpload` (src/supabase/mapReview.ts), `uploadReview` (src/supabase/uploadReview.ts), `supabase` nullable client, `useAuth`, `parsePgn`, `Review` type (src/analysis/assemble.ts).
- Library list MUST select explicit columns — `reviews.analysis` is 100-300KB/row; never select it in the list query.
- The reveal overlay must NOT show when opening a saved review (only fresh analyses call `setShowReveal(true)` inside `run()` — opening saved games uses a separate path; verify).

---

### Task 1: pgn_hash migration + upload path (TDD where pure)

**Files:**
- Create: `supabase/migrations/20260703000000_pgn_hash.sql`
- Modify: `src/supabase/mapReview.ts` (+ test), `src/supabase/uploadReview.ts`

- [ ] **Step 1: Migration**

```sql
-- Client-computed djb2 hash of the pgn, so the duplicate-game lookup can be
-- an indexed equality instead of shipping the whole PGN in a query string.
alter table public.games add column pgn_hash text;
create index games_user_pgnhash_idx on public.games (user_id, pgn_hash);
-- (games_user_pgn_uniq on md5(pgn) remains the server-side dedup authority.)
```

- [ ] **Step 2: Failing test** — add to `src/supabase/mapReview.test.ts`:

```ts
import { hashString } from './syncQueue';
// inside describe('mapReview'):
  it('stamps a djb2 pgn_hash matching the stored pgn', () => {
    const { game } = fixture();
    expect(game.pgn_hash).toBe(hashString(game.pgn));
  });
```

Run → FAIL (property missing).

- [ ] **Step 3: Implement** — in `src/supabase/mapReview.ts`: import `hashString` from './syncQueue'; add `pgn_hash: string;` to `ReviewUpload['game']`; in the returned object compute the final pgn first:

```ts
  const pgnText = pgn ?? reconstructPgn(game);
  ...
    game: {
      pgn: pgnText,
      pgn_hash: hashString(pgnText),
      ...
```

Run → PASS. Full suite 91/91.

- [ ] **Step 4: uploadReview fallback** — in `src/supabase/uploadReview.ts`, replace `.eq('pgn', u.game.pgn)` with `.eq('pgn_hash', u.game.pgn_hash)` and change `.single()` on that lookup to `.limit(1).single()` (hash collisions are theoretically possible; same-user djb2 collision on different games is ~10^-6 and the consequence is overwriting the collided game's review — acceptable, note in a comment).

- [ ] **Step 5: Gates + commit**

`npm test` (91/91), build, lint.
```bash
git add supabase/migrations/20260703000000_pgn_hash.sql src/supabase/mapReview.ts src/supabase/mapReview.test.ts src/supabase/uploadReview.ts
git commit -m "feat: pgn_hash column for indexed duplicate-game lookup"
```

---

### Task 2: rowToReview reconstruction + library data wrappers (TDD pure part)

**Files:**
- Create: `src/supabase/rowToReview.ts` + `src/supabase/rowToReview.test.ts`
- Create: `src/supabase/library.ts`

- [ ] **Step 1: Failing test** — `src/supabase/rowToReview.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rowToReview } from './rowToReview';
import { parsePgn } from '../chess/pgnParser';
import { assembleReview } from '../analysis/assemble';
import { OPENINGS } from '../data/openings.sample';
import type { ParsedGame, PositionAnalysis } from '../chess/types';

function flatAnalyses(g: ParsedGame): Map<string, PositionAnalysis> {
  const m = new Map<string, PositionAnalysis>();
  const add = (fen: string, bestUci: string) =>
    m.set(fen, { fen, bestMoveUci: bestUci, bestEvalCp: 0, secondBestEvalCp: 0, mate: null });
  g.plies.forEach((p) => add(p.fenBefore, p.uci));
  add(g.plies[g.plies.length - 1].fenAfter, 'a2a3');
  return m;
}

const PGN = '1. e4 e5 2. Nf3 Nc6 3. Bb5 *';

describe('rowToReview', () => {
  it('round-trips a stored review back to game + review', () => {
    const original = parsePgn(PGN);
    const review = assembleReview(original, flatAnalyses(original), OPENINGS);
    const analysis = JSON.parse(JSON.stringify({ plies: review.plies, summary: review.summary }));
    const out = rowToReview(PGN, analysis);
    expect(out).not.toBeNull();
    expect(out!.game.plies).toHaveLength(5);
    expect(out!.review.summary.opening?.name).toBe('Ruy Lopez');
    expect(out!.review.plies[0].classification).toBe('book');
  });

  it('returns null on unparseable pgn or malformed analysis', () => {
    expect(rowToReview('not a pgn $$$', { plies: [], summary: {} })).toBeNull();
    expect(rowToReview(PGN, null)).toBeNull();
    expect(rowToReview(PGN, { plies: 'nope' })).toBeNull();
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement** — `src/supabase/rowToReview.ts`:

```ts
// Rebuild the in-memory game + review from a stored games.pgn + reviews.analysis.
// Defensive: rows written by future/past versions must fail soft (null), never throw.
import { parsePgn } from '../chess/pgnParser';
import type { ParsedGame } from '../chess/types';
import type { Review } from '../analysis/assemble';

export function rowToReview(
  pgn: string,
  analysis: unknown,
): { game: ParsedGame; review: Review } | null {
  try {
    const game = parsePgn(pgn);
    const a = analysis as { plies?: unknown; summary?: unknown } | null;
    if (!a || !Array.isArray(a.plies) || typeof a.summary !== 'object' || a.summary === null) return null;
    const review = { plies: a.plies, summary: a.summary } as Review;
    if (review.plies.length !== game.plies.length) return null;
    if (!review.summary.counts || !review.summary.estRating) return null;
    return { game, review };
  } catch {
    return null;
  }
}
```

Run → PASS (2). Suite 93/93.

- [ ] **Step 3: Wrappers** — `src/supabase/library.ts` (thin, no tests):

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface LibraryRow {
  id: string;
  white_name: string; black_name: string;
  white_rating: number | null; black_rating: number | null;
  result: string | null; played_at: string | null;
  opening_name: string | null; source: string; created_at: string;
  reviews: { white_accuracy: number; black_accuracy: number } | null;
}

// Explicit columns only — reviews.analysis is huge and must not be listed here.
export async function fetchLibrary(client: SupabaseClient, limit = 50): Promise<LibraryRow[]> {
  const { data, error } = await client
    .from('games')
    .select('id, white_name, black_name, white_rating, black_rating, result, played_at, opening_name, source, created_at, reviews(white_accuracy, black_accuracy)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LibraryRow[];
}

export async function fetchSavedGame(client: SupabaseClient, gameId: string): Promise<{ pgn: string; analysis: unknown } | null> {
  const { data, error } = await client
    .from('games')
    .select('pgn, reviews(analysis)')
    .eq('id', gameId)
    .single();
  if (error) return null;
  const reviews = (data as { reviews?: { analysis?: unknown } | { analysis?: unknown }[] }).reviews;
  const analysis = Array.isArray(reviews) ? reviews[0]?.analysis : reviews?.analysis;
  return analysis === undefined ? null : { pgn: (data as { pgn: string }).pgn, analysis };
}

export interface Profile { display_name: string | null; chesscom_username: string | null; lichess_username: string | null; }

export async function fetchProfile(client: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await client.from('profiles')
    .select('display_name, chesscom_username, lichess_username').eq('id', userId).single();
  return error ? null : (data as Profile);
}

export async function saveProfile(client: SupabaseClient, userId: string, p: Profile): Promise<string | null> {
  const { error } = await client.from('profiles').upsert({ id: userId, ...p });
  return error ? error.message : null;
}
```

- [ ] **Step 4: Gates + commit**

```bash
git add src/supabase/rowToReview.ts src/supabase/rowToReview.test.ts src/supabase/library.ts
git commit -m "feat: saved-review reconstruction and library data wrappers"
```

---

### Task 3: Library view UI + App wiring

**Files:**
- Create: `src/components/LibraryView.tsx`
- Modify: `src/App.tsx`, `src/index.css`

- [ ] **Step 1: LibraryView component**

```tsx
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { fetchLibrary, fetchProfile, saveProfile, type LibraryRow, type Profile } from '../supabase/library';

interface Props {
  user: User;
  onOpen: (gameId: string) => void;
  onClose: () => void;
}

export function LibraryView({ user, onOpen, onClose }: Props) {
  const [rows, setRows] = useState<LibraryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>({ display_name: null, chesscom_username: null, lichess_username: null });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    fetchLibrary(supabase).then(setRows).catch((e: Error) => setError(e.message));
    void fetchProfile(supabase, user.id).then((p) => { if (p) setProfile(p); });
  }, [user.id]);

  async function submitProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSaved(false);
    const err = await saveProfile(supabase, user.id, profile);
    if (err) setError(err); else setSaved(true);
  }

  return (
    <div className="library">
      <div className="library-head">
        <h2>Your games</h2>
        <button onClick={onClose}>← Back</button>
      </div>

      <form className="card profile-card" onSubmit={submitProfile}>
        <h4>Profile</h4>
        <div className="profile-fields">
          <input placeholder="display name" value={profile.display_name ?? ''}
            onChange={(e) => setProfile({ ...profile, display_name: e.target.value || null })} />
          <input placeholder="chess.com username" value={profile.chesscom_username ?? ''}
            onChange={(e) => setProfile({ ...profile, chesscom_username: e.target.value || null })} />
          <input placeholder="lichess username" value={profile.lichess_username ?? ''}
            onChange={(e) => setProfile({ ...profile, lichess_username: e.target.value || null })} />
          <button className="primary" type="submit">Save</button>
        </div>
        {saved && <div className="auth-notice">Profile saved.</div>}
      </form>

      {error && <div className="err">{error}</div>}
      {!rows && !error && <div className="card skel" style={{ height: 200 }} />}
      {rows && rows.length === 0 && (
        <div className="card library-empty">No saved games yet — analyze a game and it lands here automatically.</div>
      )}
      {rows && rows.length > 0 && (
        <div className="card library-list">
          {rows.map((r) => (
            <button className="library-row" key={r.id} onClick={() => onOpen(r.id)}>
              <span className="lr-players">
                {r.white_name}{r.white_rating != null && <em> ({r.white_rating})</em>} vs {r.black_name}{r.black_rating != null && <em> ({r.black_rating})</em>}
              </span>
              <span className="lr-opening">{r.opening_name ?? '—'}</span>
              <span className="lr-acc">{r.reviews ? `${r.reviews.white_accuracy.toFixed(0)}·${r.reviews.black_accuracy.toFixed(0)}` : '…'}</span>
              <span className="lr-result">{r.result ?? '*'}</span>
              <span className="lr-date">{r.played_at ?? r.created_at.slice(0, 10)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: App wiring** — in `src/App.tsx`:
- Imports: `LibraryView`, `fetchSavedGame` (from ./supabase/library), `rowToReview`.
- State: `const [view, setView] = useState<'game' | 'library'>('game');`
- Topbar (between tagline and AuthBar): `{auth.user && <button className="lib-btn" onClick={() => setView('library')}>Library</button>}`
- Open handler:

```ts
async function openSaved(gameId: string) {
  if (!supabase) return;
  const row = await fetchSavedGame(supabase, gameId);
  const rebuilt = row ? rowToReview(row.pgn, row.analysis) : null;
  if (!rebuilt) { setError('That saved review could not be loaded.'); setView('game'); return; }
  setError(null);
  setAutoplaySpeed('off');
  setGame(rebuilt.game);
  setReview(rebuilt.review);
  setPly(0);
  setShowImport(false);
  setLastImport(null);   // prevents the sync effect from re-uploading (guard requires lastImport)
  setView('game');
}
```

CRITICAL check: the cloud-sync enqueue effect fires on `[review]` — its guard requires `lastImport` non-null, so `setLastImport(null)` BEFORE `setReview` keeps saved-review opens from re-uploading. Also `setShowReveal` is NOT called here → no reveal overlay. Verify both by reading the effects.

- Render: wrap the existing main content: `{view === 'library' && auth.user ? <LibraryView user={auth.user} onOpen={openSaved} onClose={() => setView('game')} /> : (<> ...existing import/gamebar/review-grid JSX... </>)}` — the topbar and RevealOverlay stay outside the ternary.
- Sign-out while in library: add effect `useEffect(() => { if (!auth.user) setView('game'); }, [auth.user]);`

- [ ] **Step 3: CSS** — append:

```css
/* ── library ── */
.library { display: flex; flex-direction: column; gap: 14px; }
.library-head { display: flex; align-items: center; justify-content: space-between; }
.library-head h2 { font-family: var(--font-display); margin: 0; }
.lib-btn { margin-left: auto; }
.authbar { margin-left: 0; }  /* lib-btn takes over the auto-push when present */
.topbar { gap: 10px; }
.profile-card { padding: 14px 16px; }
.profile-fields { display: flex; gap: 8px; flex-wrap: wrap; }
.profile-fields input { flex: 1 1 160px; background: var(--bg); color: var(--text); border: 1px solid var(--line-strong); border-radius: 6px; padding: 8px 10px; font-size: 13px; }
.library-list { display: flex; flex-direction: column; padding: 6px; }
.library-row {
  display: grid; grid-template-columns: 1fr 150px 70px 60px 90px;
  gap: 10px; align-items: center; text-align: left;
  background: none; border: none; border-bottom: 1px solid var(--line);
  padding: 10px 10px; font-size: 13px; color: var(--text);
}
.library-row:last-child { border-bottom: none; }
.library-row:hover { background: rgba(255, 255, 255, 0.03); }
.library-row em { color: var(--text-mute); font-style: normal; font-family: var(--font-mono); font-size: 12px; }
.lr-opening { color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lr-acc { font-family: var(--font-mono); color: var(--green); }
.lr-result { font-family: var(--font-mono); color: var(--text-dim); }
.lr-date { color: var(--text-mute); font-size: 12px; text-align: right; }
.library-empty { padding: 24px; text-align: center; color: var(--text-dim); }
@media (max-width: 600px) {
  .library-row { grid-template-columns: 1fr 70px; }
  .lr-opening, .lr-result, .lr-date { display: none; }
}
```

CAUTION: the `.authbar { margin-left: 0; }` + `.lib-btn { margin-left: auto; }` combo changes topbar layout for signed-out users too (no lib-btn → authbar loses its auto-push). Fix properly: keep `.authbar { margin-left: auto; }` as is, and give `.lib-btn` NO margin (it sits just left of authbar). Use THIS simpler approach instead of the two overrides above — place the Library button INSIDE the flow right before AuthBar and drop both margin overrides from the CSS block.

- [ ] **Step 4: Gates + commit**

`npm test` (93/93), build, lint (no new beyond accepted).
```bash
git add src/components/LibraryView.tsx src/App.tsx src/index.css
git commit -m "feat: game library view with instant saved-review reopen + profile card"
```

---

### Task 4: Verification (controller)

Browser (guest): app identical, no Library button. With Supabase configured + signed in: Library button → list renders (or empty state), profile saves, clicking a game reopens the review instantly with no engine run and NO reveal overlay, and no new row appears in the DB afterward (no re-upload). Mobile layout: rows collapse to 2 columns.

---

## Status & follow-ups (2026-07-03, post-merge at 4549073)

Shipped: pgn_hash dedup, rowToReview, library view, profile card, openSaved race guard.
Tracked follow-ups (not silently dropped):
- Library search/filter (spec Phase 2 item) — deliberately deferred; add when the list grows past a screen.
- Legacy queue payloads without pgn_hash would stick on 23505 conflict — moot pre-provisioning; heal via .maybeSingle() + pgn eq fallback if ever needed.
- LibraryView: separate error states for list vs profile save; stay in-library on single bad row.
- fetchProfile: .maybeSingle() to distinguish "no profile" from transient errors.
