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
