export interface LichessGame {
  id: string;
  pgn: string;
  createdAt: number;
  players: {
    white: { user?: { name: string }; name?: string };
    black: { user?: { name: string }; name?: string };
  };
}

export interface GameSummary {
  id: string;
  url: string;
  white: string;
  black: string;
  date: string;
  pgn: string;
}

function toSummary(g: LichessGame): GameSummary {
  const white = g.players.white.user?.name ?? g.players.white.name ?? 'White';
  const black = g.players.black.user?.name ?? g.players.black.name ?? 'Black';
  return {
    id: g.id,
    url: `https://lichess.org/${g.id}`,
    white,
    black,
    date: new Date(g.createdAt).toISOString().slice(0, 10),
    pgn: g.pgn,
  };
}

export async function fetchRecentGames(username: string): Promise<GameSummary[]> {
  const r = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(username.trim().toLowerCase())}?max=12&pgnInJson=true`, {
    headers: { Accept: 'application/x-ndjson' },
  });
  if (!r.ok) throw new Error(`lichess.org: user "${username}" not found (${r.status})`);

  const games: GameSummary[] = [];
  const reader = r.body?.getReader();
  if (!reader) throw new Error('lichess.org: could not read response body');

  const decoder = new TextDecoder();
  let buf = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const g = JSON.parse(line) as LichessGame;
        games.push(toSummary(g));
      } catch { /* skip malformed line */ }
    }
  }

  return games.reverse(); // oldest first
}
