import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Zap, CheckCircle2, UserPlus } from 'lucide-react';
import { fetchRecentGames as fetchComGames, type GameSummary } from '../importers/chesscom';
import { fetchRecentGames as fetchLiGames } from '../importers/lichess';
import { latestGames } from '../importers/autoImport';
import { hashString } from '../supabase/syncQueue';

export type RecentSource = 'chesscom' | 'lichess';
export interface RecentGame extends GameSummary {
  source: RecentSource;
}

interface Props {
  chesscomUsername: string | null;
  lichessUsername: string | null;
  /** pgn_hash → saved game id, so already-analyzed games open instantly. */
  reviewedIdByHash: ReadonlyMap<string, string>;
  onAnalyze: (pgn: string, source: RecentSource) => void;
  onOpenSaved: (gameId: string) => void;
}

const MAX_RECENT = 15;

const SOURCE_BADGE: Record<RecentSource, { label: string; className: string }> = {
  chesscom: { label: 'chess.com', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
  lichess: { label: 'lichess', className: 'bg-violet-500/15 text-violet-300 border-violet-400/30' },
};

// Left-hand Library rail: auto-fetches the linked accounts' most recent games
// (both platforms when both usernames are set) and lets the user open an
// already-saved review or kick off a fresh analysis with one click.
export function RecentGamesSidebar({ chesscomUsername, lichessUsername, reviewedIdByHash, onAnalyze, onOpenSaved }: Props) {
  const [games, setGames] = useState<RecentGame[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const com = chesscomUsername?.trim() || null;
  const li = lichessUsername?.trim() || null;
  const hasAccount = !!(com || li);

  const refresh = useCallback(async () => {
    if (!com && !li) return;
    setLoading(true);
    setError(null);
    const tasks: Array<Promise<RecentGame[]>> = [];
    if (com) tasks.push(fetchComGames(com).then((gs) => gs.map((g) => ({ ...g, source: 'chesscom' as const }))));
    if (li) tasks.push(fetchLiGames(li).then((gs) => gs.map((g) => ({ ...g, source: 'lichess' as const }))));
    const settled = await Promise.allSettled(tasks);
    const ok = settled.filter((s): s is PromiseFulfilledResult<RecentGame[]> => s.status === 'fulfilled');
    const failed = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
    setGames(latestGames(ok.flatMap((s) => s.value), MAX_RECENT));
    // Partial failure (one platform down / bad username) still shows the rest.
    setError(failed.length > 0 ? failed.map((f) => (f.reason as Error).message ?? String(f.reason)).join(' · ') : null);
    setLoading(false);
  }, [com, li]);

  useEffect(() => {
    setGames(null);
    void refresh();
  }, [refresh]);

  return (
    <aside aria-label="Recent games" className="glass-panel rounded-3xl p-5 border border-indigo-400/20 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 font-mono">Recent Games</h3>
        {hasAccount && (
          <button
            onClick={() => void refresh()}
            disabled={loading}
            aria-label="Refresh recent games"
            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {!hasAccount && (
        <div className="py-6 text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-xl bg-indigo-500/10 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <UserPlus className="w-5 h-5" />
          </div>
          <p className="text-xs font-mono text-slate-400 leading-relaxed">
            Add your chess.com or lichess username in the Profile form to see your latest games here automatically.
          </p>
        </div>
      )}

      {hasAccount && error && (
        <p className="text-[11px] font-mono text-rose-300/90 leading-relaxed">{error}</p>
      )}

      {hasAccount && games === null && !error && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-indigo-950/40 border border-indigo-500/20 animate-pulse" />
          ))}
        </div>
      )}

      {games && games.length === 0 && !error && (
        <p className="py-6 text-center text-xs font-mono text-slate-400">No recent games found.</p>
      )}

      {games && games.length > 0 && (
        <ul className="space-y-2">
          {games.map((g) => {
            const savedId = reviewedIdByHash.get(hashString(g.pgn));
            const badge = SOURCE_BADGE[g.source];
            return (
              <li key={`${g.source}:${g.id}`}>
                <button
                  onClick={() => (savedId ? onOpenSaved(savedId) : onAnalyze(g.pgn, g.source))}
                  className="w-full p-3 rounded-xl bg-indigo-950/40 hover:bg-cyan-500/15 border border-indigo-500/20 hover:border-cyan-400/30 transition-all text-left space-y-1.5 cursor-pointer"
                >
                  <span className="block text-xs font-bold text-white font-sans truncate">
                    {g.white} vs {g.black}
                  </span>
                  <span className="flex items-center justify-between gap-2 text-[10px] font-mono">
                    <span className={`px-1.5 py-0.5 rounded border ${badge.className}`}>{badge.label}</span>
                    <span className="text-slate-400">{g.date}</span>
                    {savedId ? (
                      <span className="flex items-center gap-1 text-cyan-300 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Saved
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-300 font-bold">
                        <Zap className="w-3 h-3" /> Analyze
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
