# ChessReviewer

A browser-only chess Game Review tool (chess.com-style). Paste a PGN or import
a game from a chess.com username, and Stockfish (running in your browser)
analyzes every move: classification (Brilliant / Great / Best / … / Blunder),
accuracy %, evaluation graph, best-move arrows, and opening detection. No
backend, no accounts, no token cost.

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

## How it works

```
Import → parse PGN → analyze each position (Stockfish/WASM) → classify moves
       → compute accuracy → detect opening → render review
```

Every distinct position is evaluated once by Stockfish (MultiPV 2). A pure
assembly step then turns those evaluations into per-move classifications and
accuracies. The engine runs in a Web Worker, so the UI stays responsive.

## Notes

- Move classification uses win%-drop thresholds tuned in
  `src/analysis/thresholds.ts`. It reproduces chess.com's look-and-feel closely
  but not their exact proprietary "Brilliant"/"Miss" logic.
- The bundled opening set in `src/data/openings.sample.ts` is small; drop in the
  full [Lichess ECO set](https://github.com/lichess-org/chess-openings)
  (mapped to the same `{ eco, name, uciMoves }` shape) for complete coverage.
- Analysis depth is set in `src/App.tsx` (`DEPTH`).
- The engine is the **single-threaded** Stockfish build, so it runs on any
  static host without cross-origin-isolation (COOP/COEP) headers.

## License

The bundled Stockfish.js engine is **GPLv3** (© Chess.com, LLC). Distributing
this app distributes Stockfish.js, so the combined work is subject to GPLv3.
