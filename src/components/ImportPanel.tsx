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
