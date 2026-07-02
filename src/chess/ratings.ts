// Extract player ratings from PGN headers. PGN uses "?" (or omits the tag)
// when a rating is unknown; chess.com and lichess exports both emit numeric
// WhiteElo/BlackElo.

export interface PlayerRatings {
  white: number | null;
  black: number | null;
}

function parseElo(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function playerRatings(headers: Record<string, string>): PlayerRatings {
  return {
    white: parseElo(headers.WhiteElo),
    black: parseElo(headers.BlackElo),
  };
}
