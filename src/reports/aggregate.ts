// Pure client-side aggregations for Phase 6 weakness reports. No supabase or
// chess.js imports — operates only on the row shapes fetched by
// src/supabase/reports.ts, so it stays trivially unit-testable.
import type { ReportGameRow, ReportFactRow } from '../supabase/reports';
import type { Profile } from '../supabase/library';
import { BAD_CLASSES } from '../coach/explain';

const WEAKNESS_MOTIFS = new Set(['missed_mate', 'walked_into_mate', 'hung_piece', 'missed_fork']);
const PHASE_ORDER: Array<'opening' | 'middlegame' | 'endgame'> = ['opening', 'middlegame', 'endgame'];

/** Which side the user played, or null when undeterminable. */
export function userSide(game: ReportGameRow, profile: Profile | null): 'white' | 'black' | null {
  if (!profile) return null;
  const white = game.white_name.toLowerCase();
  const black = game.black_name.toLowerCase();
  for (const raw of [profile.chesscom_username, profile.lichess_username, profile.display_name]) {
    if (!raw) continue;
    const name = raw.toLowerCase();
    if (name === white) return 'white';
    if (name === black) return 'black';
  }
  return null;
}

// Mean of both sides' accuracy/rating when the user's side can't be determined.
function sidedValue(side: 'white' | 'black' | null, white: number, black: number): number {
  if (side === 'white') return white;
  if (side === 'black') return black;
  return (white + black) / 2;
}

export interface OpeningStat { opening: string; games: number; avgAccuracy: number; }

/** Openings sorted by avgAccuracy ascending (worst first); openings with < minGames excluded; accuracy = user's side when known, else mean of both. */
export function worstOpenings(games: ReportGameRow[], profile: Profile | null, minGames = 2): OpeningStat[] {
  const byOpening = new Map<string, number[]>();
  for (const g of games) {
    if (!g.opening_name || !g.reviews) continue;
    const side = userSide(g, profile);
    const acc = sidedValue(side, g.reviews.white_accuracy, g.reviews.black_accuracy);
    const list = byOpening.get(g.opening_name);
    if (list) list.push(acc);
    else byOpening.set(g.opening_name, [acc]);
  }

  const stats: OpeningStat[] = [];
  for (const [opening, accs] of byOpening) {
    if (accs.length < minGames) continue;
    const avgAccuracy = accs.reduce((sum, a) => sum + a, 0) / accs.length;
    stats.push({ opening, games: accs.length, avgAccuracy });
  }
  return stats.sort((a, b) => a.avgAccuracy - b.avgAccuracy);
}

export interface MotifStat { motif: string; count: number; }

// Builds a game_id -> userSide lookup once; games absent from this map
// (unknown to the caller) are treated as side-unknown, i.e. included unfiltered.
function sideByGameId(games: ReportGameRow[], profile: Profile | null): Map<string, 'white' | 'black' | null> {
  const map = new Map<string, 'white' | 'black' | null>();
  for (const g of games) map.set(g.id, userSide(g, profile));
  return map;
}

/** Counts of weakness motifs (missed_mate, walked_into_mate, hung_piece, missed_fork) over the user's facts (side-filtered when known via the games list), sorted desc. Ignores the ungated 'fork' tag. */
export function missedMotifs(facts: ReportFactRow[], games: ReportGameRow[], profile: Profile | null): MotifStat[] {
  const sides = sideByGameId(games, profile);
  const counts = new Map<string, number>();

  for (const f of facts) {
    const side = sides.get(f.game_id);
    if (side && side !== f.side) continue;
    for (const motif of f.motifs) {
      if (!WEAKNESS_MOTIFS.has(motif)) continue;
      counts.set(motif, (counts.get(motif) ?? 0) + 1);
    }
  }

  return Array.from(counts, ([motif, count]) => ({ motif, count })).sort((a, b) => b.count - a.count);
}

export interface PhaseStat { phase: 'opening' | 'middlegame' | 'endgame'; moves: number; avgWinDrop: number; badMovePct: number; }

/** Per-phase aggregation over the user's facts (side-filtered when known). badMove = inaccuracy|mistake|blunder. */
export function phaseCollapse(facts: ReportFactRow[], games: ReportGameRow[], profile: Profile | null): PhaseStat[] {
  const sides = sideByGameId(games, profile);
  const buckets = new Map<string, { winDropSum: number; moves: number; bad: number }>();

  for (const f of facts) {
    const side = sides.get(f.game_id);
    if (side && side !== f.side) continue;
    const bucket = buckets.get(f.phase) ?? { winDropSum: 0, moves: 0, bad: 0 };
    bucket.winDropSum += f.win_drop;
    bucket.moves += 1;
    if (BAD_CLASSES.has(f.classification)) bucket.bad += 1;
    buckets.set(f.phase, bucket);
  }

  const result: PhaseStat[] = [];
  for (const phase of PHASE_ORDER) {
    const bucket = buckets.get(phase);
    if (!bucket) continue;
    result.push({
      phase,
      moves: bucket.moves,
      avgWinDrop: bucket.winDropSum / bucket.moves,
      badMovePct: (bucket.bad / bucket.moves) * 100,
    });
  }
  return result;
}

export type ColorFilter = 'all' | 'white' | 'black';
export type RangeFilter = 'all' | '30d' | '3mo';
export interface TrendFilter { color: ColorFilter; range: RangeFilter; }
export type GameOutcome = 'win' | 'loss' | 'draw' | null;

const DAY_MS = 86_400_000;

function gameDate(g: ReportGameRow): string { return g.played_at ?? g.created_at; }
function toMs(date: string): number { return new Date(date).getTime(); }

function inColor(side: 'white' | 'black' | null, color: ColorFilter): boolean {
  return color === 'all' ? true : side === color;
}

// Range is measured from the newest date in `points` (not wall-clock now),
// so results are deterministic and testable.
function applyRange<T extends { ms: number }>(points: T[], range: RangeFilter): T[] {
  if (range === 'all' || points.length === 0) return points;
  const days = range === '30d' ? 30 : 90;
  const newest = Math.max(...points.map((p) => p.ms));
  const cutoff = newest - days * DAY_MS;
  return points.filter((p) => p.ms >= cutoff);
}

/** win/loss/draw from a game's result string relative to the user's side, or null. */
export function gameResult(game: ReportGameRow, side: 'white' | 'black' | null): GameOutcome {
  if (!side || !game.result) return null;
  const r = game.result.trim();
  if (r === '1/2-1/2' || r === '½-½' || r === '0.5-0.5') return 'draw';
  if (r === '1-0') return side === 'white' ? 'win' : 'loss';
  if (r === '0-1') return side === 'black' ? 'win' : 'loss';
  return null;
}

export interface TrendSeriesPoint { date: string; accuracy: number; estRating: number; result: GameOutcome; }

/** One point per reviewed game passing the filter, user side when known else mean, sorted by date asc. */
export function trendSeries(games: ReportGameRow[], profile: Profile | null, filter: TrendFilter): TrendSeriesPoint[] {
  const points = games
    .filter((g) => g.reviews)
    .map((g) => {
      const side = userSide(g, profile);
      return { g, side };
    })
    .filter(({ side }) => inColor(side, filter.color))
    .map(({ g, side }) => ({
      date: gameDate(g),
      ms: toMs(gameDate(g)),
      accuracy: sidedValue(side, g.reviews!.white_accuracy, g.reviews!.black_accuracy),
      estRating: sidedValue(side, g.reviews!.white_est_rating, g.reviews!.black_est_rating),
      result: gameResult(g, side),
    }));
  return applyRange(points, filter.range)
    .sort((a, b) => a.ms - b.ms)
    .map(({ ms: _ms, ...p }) => p);
}

/** Trailing moving average; positions with < window prior points average what exists. */
export function rollingAverage(values: number[], window = 5): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  });
}

export interface BlunderPoint { date: string; blunders: number; }

/** Blunders per game over time; side-filtered like missedMotifs, color/range-filtered, zero-filled, sorted asc. */
export function blundersPerGame(
  facts: ReportFactRow[], games: ReportGameRow[], profile: Profile | null, filter: TrendFilter,
): BlunderPoint[] {
  const sides = new Map(games.map((g) => [g.id, userSide(g, profile)]));
  const eligible = games.filter((g) => g.reviews && inColor(sides.get(g.id) ?? null, filter.color));
  const counts = new Map<string, number>();
  for (const g of eligible) counts.set(g.id, 0);
  for (const f of facts) {
    if (!counts.has(f.game_id)) continue;
    const side = sides.get(f.game_id);
    if (side && side !== f.side) continue;
    if (f.classification === 'blunder') counts.set(f.game_id, (counts.get(f.game_id) ?? 0) + 1);
  }
  const points = eligible.map((g) => ({ date: gameDate(g), ms: toMs(gameDate(g)), blunders: counts.get(g.id) ?? 0 }));
  return applyRange(points, filter.range)
    .sort((a, b) => a.ms - b.ms)
    .map(({ ms: _ms, ...p }) => p);
}

export interface TrendPoint { date: string; accuracy: number; estRating: number; }

/** One point per game with a review, user side when known else mean, sorted by played_at ?? created_at ascending. */
export function accuracyTrend(games: ReportGameRow[], profile: Profile | null): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (const g of games) {
    if (!g.reviews) continue;
    const side = userSide(g, profile);
    points.push({
      date: g.played_at ?? g.created_at,
      accuracy: sidedValue(side, g.reviews.white_accuracy, g.reviews.black_accuracy),
      estRating: sidedValue(side, g.reviews.white_est_rating, g.reviews.black_est_rating),
    });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}
