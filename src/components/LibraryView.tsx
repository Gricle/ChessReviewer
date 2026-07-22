import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
import { Library, AlertTriangle, TrendingUp } from 'lucide-react';
import { supabase } from '../supabase/client';
import { fetchLibrary, fetchLibraryPgnHashes, fetchProfile, saveProfile, type LibraryRow, type Profile } from '../supabase/library';
import { ReportsView } from './ReportsView';
import { TrendsView } from './TrendsView';
import { RecentGamesSidebar, type RecentSource } from './RecentGamesSidebar';

interface Props {
  user: User;
  onOpen: (gameId: string) => void;
  onAnalyze: (pgn: string, source: RecentSource) => void;
}

const SUB_TABS = [
  { id: 'games' as const, labelKey: 'tabs.games', icon: Library, iconClass: '' },
  { id: 'reports' as const, labelKey: 'tabs.reports', icon: AlertTriangle, iconClass: 'text-amber-400' },
  { id: 'trends' as const, labelKey: 'tabs.trends', icon: TrendingUp, iconClass: 'text-emerald-400' },
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

export function LibraryView({ user, onOpen, onAnalyze }: Props) {
  const { t } = useTranslation('library');
  const [rows, setRows] = useState<LibraryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>({ display_name: null, chesscom_username: null, lichess_username: null });
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'games' | 'reports' | 'trends'>('games');
  // The sidebar keys off the last SAVED usernames, not the live form state —
  // otherwise every keystroke in the profile form would refire the fetch.
  const [linked, setLinked] = useState<Pick<Profile, 'chesscom_username' | 'lichess_username'>>({ chesscom_username: null, lichess_username: null });
  const [hashes, setHashes] = useState<Array<{ id: string; pgn_hash: string }>>([]);

  useEffect(() => {
    if (!supabase) return;
    fetchLibrary(supabase).then(setRows).catch((e: Error) => setError(e.message));
    fetchLibraryPgnHashes(supabase).then(setHashes).catch(() => { /* sidebar dedupe is best-effort */ });
    void fetchProfile(supabase, user.id).then((p) => {
      if (p) { setProfile(p); setLinked(p); }
    });
  }, [user.id]);

  const reviewedIdByHash = useMemo(
    () => new Map(hashes.map((h) => [h.pgn_hash, h.id] as const)),
    [hashes],
  );

  async function submitProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSaved(false);
    const err = await saveProfile(supabase, user.id, profile);
    if (err) { setError(err); } else { setSaved(true); setLinked(profile); }
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
              {rows ? t('profile.savedCount', { count: rows.length }) : t('profile.loading')}
            </p>
          </div>
        </div>

        {/* Sub-tab pill switcher */}
        <div
          role="group"
          aria-label={t('subTabs.ariaLabel')}
          className="flex items-center gap-1.5 bg-indigo-950/60 p-1.5 rounded-2xl border border-indigo-500/20"
        >
          {SUB_TABS.map(({ id, labelKey, icon: Icon, iconClass }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={pillClass(tab === id)}
            >
              <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
              {id === 'games' ? t('tabs.games', { count: rows?.length ?? 0 }) : t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-mono">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-8 items-start">
        <RecentGamesSidebar
          chesscomUsername={linked.chesscom_username}
          lichessUsername={linked.lichess_username}
          reviewedIdByHash={reviewedIdByHash}
          onAnalyze={onAnalyze}
          onOpenSaved={onOpen}
        />

        <div className="space-y-8 min-w-0">
      {tab === 'games' && (
        <>
          {/* Profile form */}
          <form className="glass-panel rounded-3xl p-6 border border-indigo-400/20 space-y-4" onSubmit={submitProfile}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 font-mono">{t('profileForm.heading')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                placeholder={t('profileForm.displayNamePlaceholder')}
                value={profile.display_name ?? ''}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value || null })}
                className={inputClass}
              />
              <input
                placeholder={t('profileForm.chesscomPlaceholder')}
                value={profile.chesscom_username ?? ''}
                onChange={(e) => setProfile({ ...profile, chesscom_username: e.target.value || null })}
                className={inputClass}
              />
              <input
                placeholder={t('profileForm.lichessPlaceholder')}
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
                {t('profileForm.save')}
              </button>
              {saved && <span className="text-xs font-mono text-cyan-300">{t('profileForm.saved')}</span>}
            </div>
          </form>

          {/* Games list */}
          <div className="glass-panel rounded-3xl p-6 border border-indigo-400/20 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 font-mono">
              {t('history.heading')}
            </h3>

            {!rows && !error && (
              <div className="h-[200px] rounded-2xl bg-indigo-950/40 border border-indigo-500/20 animate-pulse" />
            )}

            {rows && rows.length === 0 && (
              <div className="py-12 text-center text-slate-400 font-mono text-xs">
                {t('history.empty')}
              </div>
            )}

            {rows && rows.length > 0 && (
              <div className="space-y-2">
                {rows.map((r) => {
                  const whiteLabel = `${r.white_name}${r.white_rating != null ? ` (${r.white_rating})` : ''}`;
                  const blackLabel = `${r.black_name}${r.black_rating != null ? ` (${r.black_rating})` : ''}`;
                  return (
                  <button
                    key={r.id}
                    onClick={() => onOpen(r.id)}
                    className="w-full p-4 rounded-2xl bg-indigo-950/40 hover:bg-cyan-500/20 border border-indigo-500/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
                  >
                    <div className="space-y-1">
                      <span className="text-sm font-extrabold text-white font-sans">
                        {t('history.matchup', { white: whiteLabel, black: blackLabel })}
                      </span>
                      <p className="text-xs font-mono text-slate-400">
                        {r.opening_name ?? '—'} · {r.result ?? '*'} · {r.played_at ?? r.created_at.slice(0, 10)}
                      </p>
                    </div>

                    <div className="text-xs font-mono text-right">
                      <p className="text-slate-400 font-bold">{t('history.accuracyLabel')}</p>
                      {r.reviews ? (
                        <p className="text-cyan-300 font-extrabold">
                          {t('history.accuracyValue', {
                            white: r.reviews.white_accuracy.toFixed(0),
                            black: r.reviews.black_accuracy.toFixed(0),
                          })}
                        </p>
                      ) : (
                        <p className="text-cyan-300 font-extrabold">{t('history.accuracyPending')}</p>
                      )}
                    </div>
                  </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'reports' && <div><ReportsView user={user} /></div>}
      {tab === 'trends' && <div><TrendsView user={user} /></div>}
        </div>
      </div>
    </div>
  );
}
