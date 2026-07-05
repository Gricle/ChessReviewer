import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { fetchLibrary, fetchProfile, saveProfile, type LibraryRow, type Profile } from '../supabase/library';
import { ReportsView } from './ReportsView';
import { TrendsView } from './TrendsView';

interface Props {
  user: User;
  onOpen: (gameId: string) => void;
  onClose: () => void;
}

export function LibraryView({ user, onOpen, onClose }: Props) {
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
    <div className="library">
      <div className="library-head">
        <h2>Your games</h2>
        <div className="seg lib-tabs" role="group" aria-label="Library section">
          {(['games', 'reports', 'trends'] as const).map((t) => (
            <button key={t} className={`seg-btn${tab === t ? ' seg-on' : ''}`}
              aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === 'games' ? 'Games' : t === 'reports' ? 'Reports' : 'Trends'}
            </button>
          ))}
        </div>
        <button onClick={onClose}>← Back</button>
      </div>

      {error && <div className="err">{error}</div>}

      {tab === 'games' && (
        <>
          <form className="card profile-card" onSubmit={submitProfile}>
            <h4>Profile</h4>
            <div className="profile-fields">
              <input placeholder="display name" value={profile.display_name ?? ''}
                onChange={(e) => setProfile({ ...profile, display_name: e.target.value || null })} />
              <input placeholder="chess.com username" value={profile.chesscom_username ?? ''}
                onChange={(e) => setProfile({ ...profile, chesscom_username: e.target.value || null })} />
              <input placeholder="lichess username" value={profile.lichess_username ?? ''}
                onChange={(e) => setProfile({ ...profile, lichess_username: e.target.value || null })} />
              <button className="primary" type="submit">Save</button>
            </div>
            {saved && <div className="auth-notice">Profile saved.</div>}
          </form>

          {!rows && !error && <div className="card skel" style={{ height: 200 }} />}
          {rows && rows.length === 0 && (
            <div className="card library-empty">No saved games yet — analyze a game and it lands here automatically.</div>
          )}
          {rows && rows.length > 0 && (
            <div className="card library-list">
              {rows.map((r) => (
                <button className="library-row" key={r.id} onClick={() => onOpen(r.id)}>
                  <span className="lr-players">
                    {r.white_name}{r.white_rating != null && <em> ({r.white_rating})</em>} vs {r.black_name}{r.black_rating != null && <em> ({r.black_rating})</em>}
                  </span>
                  <span className="lr-opening">{r.opening_name ?? '—'}</span>
                  <span className="lr-acc">{r.reviews ? `${r.reviews.white_accuracy.toFixed(0)}·${r.reviews.black_accuracy.toFixed(0)}` : '…'}</span>
                  <span className="lr-result">{r.result ?? '*'}</span>
                  <span className="lr-date">{r.played_at ?? r.created_at.slice(0, 10)}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'reports' && <ReportsView user={user} />}
      {tab === 'trends' && <TrendsView user={user} />}
    </div>
  );
}
