import { useState } from 'react';
import { fetchRecentGames as fetchComGames, type GameSummary as ComSummary } from '../importers/chesscom';
import { fetchRecentGames as fetchLiGames, type GameSummary as LiSummary } from '../importers/lichess';

type GameSummary = ComSummary | LiSummary;

interface Props {
  onPgn: (pgn: string) => void;
}

export function ImportPanel({ onPgn }: Props) {
  const [pgn, setPgn] = useState('');
  const [comUser, setComUser] = useState('');
  const [liUser, setLiUser] = useState('');
  const [comGames, setComGames] = useState<GameSummary[]>([]);
  const [liGames, setLiGames] = useState<GameSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function loadChessCom() {
    setError(null);
    setComGames([]);
    setLoading('chess.com');
    try {
      setComGames(await fetchComGames(comUser.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load games');
    } finally {
      setLoading(null);
    }
  }

  async function loadLichess() {
    setError(null);
    setLiGames([]);
    setLoading('lichess');
    try {
      setLiGames(await fetchLiGames(liUser.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load games');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="card import">
      <div className="col">
        <h4>Paste PGN</h4>
        <textarea
          value={pgn}
          onChange={(e) => setPgn(e.target.value)}
          placeholder={'[Event ...]\n\n1. e4 e5 2. Nf3 ...'}
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
            value={comUser}
            onChange={(e) => setComUser(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && comUser.trim()) loadChessCom(); }}
          />
          <button onClick={loadChessCom} disabled={!comUser.trim() || loading !== null}>
            {loading === 'chess.com' ? 'Loading…' : 'Load'}
          </button>
        </div>
        {comGames.length > 0 && (
          <div className="games">
            {comGames.map((g) => (
              <button key={'c' + g.id} className="game-item" onClick={() => onPgn(g.pgn)} title={g.url}>
                <span className="gid">#{g.id}</span> &nbsp;{g.white} vs {g.black} &nbsp;
                <span className="gid">{g.date}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="col li-col">
        <h4><span className="li-logo" aria-hidden="true">♛</span> From lichess.org</h4>
        <div className="row">
          <input
            placeholder="lichess username"
            value={liUser}
            onChange={(e) => setLiUser(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && liUser.trim()) loadLichess(); }}
          />
          <button onClick={loadLichess} disabled={!liUser.trim() || loading !== null}>
            {loading === 'lichess' ? 'Loading…' : 'Load'}
          </button>
        </div>
        {liGames.length > 0 && (
          <div className="games">
            {liGames.map((g) => (
              <button key={'l' + g.id} className="game-item" onClick={() => onPgn(g.pgn)} title={g.url}>
                <span className="gid">#{g.id}</span> &nbsp;{g.white} vs {g.black} &nbsp;
                <span className="gid">{g.date}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="err" style={{ gridColumn: '1 / -1', padding: '0 16px' }}>{error}</div>}
    </div>
  );
}
