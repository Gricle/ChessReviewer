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
  playedAt: number; // epoch ms, for ordering games played on the same day
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
    playedAt: g.end_time * 1000,
  }));
}

const BASE = 'https://api.chess.com/pub';

export async function fetchArchives(username: string): Promise<string[]> {
  const r = await fetch(`${BASE}/player/${username.toLowerCase()}/games/archives`);
  if (!r.ok) throw new Error(`chess.com: user "${username}" not found (${r.status})`);
  const data = (await r.json()) as { archives: string[] };
  return data.archives;
}

// chess.com sometimes lists a trailing archive month with zero finished games
// (e.g. only in-progress daily games), so look back a few months for the most
// recent one that actually has games.
const MAX_ARCHIVE_LOOKBACK = 6;

// Fetch the most recent month's games for a user, newest first.
export async function fetchRecentGames(username: string): Promise<GameSummary[]> {
  const archives = await fetchArchives(username);
  for (const url of archives.slice(-MAX_ARCHIVE_LOOKBACK).reverse()) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`chess.com: could not load games (${r.status})`);
    const data = (await r.json()) as { games: ChessComGame[] };
    if (data.games.length > 0) return summarizeGames(data.games).reverse();
  }
  return [];
}
