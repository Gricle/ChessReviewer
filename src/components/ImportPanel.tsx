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
    <div className="card import">
      <div className="col">
        <h4>Paste PGN</h4>
        <textarea
          value={pgn}
          onChange={(e) => setPgn(e.target.value)}
          placeholder="[Event ...]&#10;&#10;1. e4 e5 2. Nf3 ..."
        />
        <div className="row">
          <button className="primary" onClick={() => onPgn(pgn)} disabled={!pgn.trim()}>
            Review this PGN
          </button>
        </div>
      </div>

      <div className="col">
        <h4>From chess.com</h4>
        <div className="row">
          <input
            placeholder="chess.com username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && username.trim()) loadUser(); }}
          />
          <button onClick={loadUser} disabled={!username.trim() || loading}>
            {loading ? 'Loading…' : 'Load games'}
          </button>
        </div>
        {error && <div className="err">{error}</div>}
        {games.length > 0 && (
          <div className="games">
            {games.map((g) => (
              <button key={g.id} className="game-item" onClick={() => onPgn(g.pgn)} title={g.url}>
                <span className="gid">#{g.id}</span> &nbsp;{g.white} vs {g.black} &nbsp;
                <span className="gid">{g.date}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
