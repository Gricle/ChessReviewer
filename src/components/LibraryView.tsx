import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Library, AlertTriangle, TrendingUp } from 'lucide-react';
import { supabase } from '../supabase/client';
import { fetchLibrary, fetchProfile, saveProfile, type LibraryRow, type Profile } from '../supabase/library';
import { ReportsView } from './ReportsView';
import { TrendsView } from './TrendsView';

interface Props {
  user: User;
  onOpen: (gameId: string) => void;
}

const SUB_TABS = [
  { id: 'games' as const, label: 'Games', icon: Library, iconClass: '' },
  { id: 'reports' as const, label: 'Weakness Reports', icon: AlertTriangle, iconClass: 'text-amber-400' },
  { id: 'trends' as const, label: 'Trends', icon: TrendingUp, iconClass: 'text-emerald-400' },
];

function pillClass(active: boolean): string {
  return `px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
    active
      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(56,225,214,0.3)]'
      : 'border border-transparent text-slate-400 hover:text-white'
  }`;
}

const inputClass =
  'bg-[#0b0918] border border-indigo-500/30 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400';

export function LibraryView({ user, onOpen }: Props) {
  const [rows, setRows] = useState<LibraryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>({ display_name: null, chesscom_username: null, lichess_username: null });
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'games' | 'reports' | 'trends'>('games');

  useEffect(() => {
    if (!supabase) return;
    fetchLibrary(supabase).then(setRows).catch((e: Error) => setError(e.message));
    void fetchProfile(supabase, user.id).then((p) => { if (p) setProfile(p); });
  }, [user.id]);

  async function submitProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSaved(false);
    const err = await saveProfile(supabase, user.id, profile);
    if (err) setError(err); else setSaved(true);
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Profile header banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass-panel rounded-3xl p-6 border border-indigo-400/20 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center text-2xl font-bold text-[#05040c] shadow-[0_0_20px_rgba(56,225,214,0.4)]">
            ♞
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white font-display">
              {profile.display_name || user.email}
            </h2>
            <p className="text-xs font-mono text-slate-400">
              {rows ? `${rows.length} saved game reviews` : 'Loading your library…'}
            </p>
          </div>
        </div>

        {/* Sub-tab pill switcher */}
        <div
          role="group"
          aria-label="Library section"
          className="flex items-center gap-1.5 bg-indigo-950/60 p-1.5 rounded-2xl border border-indigo-500/20"
        >
          {SUB_TABS.map(({ id, label, icon: Icon, iconClass }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={pillClass(tab === id)}
            >
              <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
              {id === 'games' ? `Games (${rows?.length ?? 0})` : label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-mono">
          {error}
        </div>
      )}

      {tab === 'games' && (
        <>
          {/* Profile form */}
          <form className="glass-panel rounded-3xl p-6 border border-indigo-400/20 space-y-4" onSubmit={submitProfile}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 font-mono">Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                placeholder="display name"
                value={profile.display_name ?? ''}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value || null })}
                className={inputClass}
              />
              <input
                placeholder="chess.com username"
                value={profile.chesscom_username ?? ''}
                onChange={(e) => setProfile({ ...profile, chesscom_username: e.target.value || null })}
                className={inputClass}
              />
              <input
                placeholder="lichess username"
                value={profile.lichess_username ?? ''}
                onChange={(e) => setProfile({ ...profile, lichess_username: e.target.value || null })}
                className={inputClass}
              />
            </div>
            <div className="flex items-center gap-4">
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#05040c] font-sans font-bold text-xs shadow-[0_0_15px_rgba(56,225,214,0.3)] transition-all cursor-pointer"
              >
                Save
              </button>
              {saved && <span className="text-xs font-mono text-cyan-300">Profile saved.</span>}
            </div>
          </form>

          {/* Games list */}
          <div className="glass-panel rounded-3xl p-6 border border-indigo-400/20 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 font-mono">
              Saved Analysis History
            </h3>

            {!rows && !error && (
              <div className="h-[200px] rounded-2xl bg-indigo-950/40 border border-indigo-500/20 animate-pulse" />
            )}

            {rows && rows.length === 0 && (
              <div className="py-12 text-center text-slate-400 font-mono text-xs">
                No saved games yet — analyze a game and it lands here automatically.
              </div>
            )}

            {rows && rows.length > 0 && (
              <div className="space-y-2">
                {rows.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onOpen(r.id)}
                    className="w-full p-4 rounded-2xl bg-indigo-950/40 hover:bg-cyan-500/20 border border-indigo-500/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
                  >
                    <div className="space-y-1">
                      <span className="text-sm font-extrabold text-white font-sans">
                        {r.white_name}{r.white_rating != null && ` (${r.white_rating})`} vs {r.black_name}{r.black_rating != null && ` (${r.black_rating})`}
                      </span>
                      <p className="text-xs font-mono text-slate-400">
                        {r.opening_name ?? '—'} · {r.result ?? '*'} · {r.played_at ?? r.created_at.slice(0, 10)}
                      </p>
                    </div>

                    <div className="text-xs font-mono text-right">
                      <p className="text-slate-400 font-bold">Accuracy</p>
                      {r.reviews ? (
                        <p className="text-cyan-300 font-extrabold">
                          W: {r.reviews.white_accuracy.toFixed(0)}% | B: {r.reviews.black_accuracy.toFixed(0)}%
                        </p>
                      ) : (
                        <p className="text-cyan-300 font-extrabold">…</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'reports' && <div><ReportsView user={user} /></div>}
      {tab === 'trends' && <div><TrendsView user={user} /></div>}
    </div>
  );
}
