import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { fetchProfile } from '../supabase/library';
import { fetchReportGames, fetchReportFacts } from '../supabase/reports';
import {
  worstOpenings, missedMotifs, phaseCollapse,
  type OpeningStat, type MotifStat, type PhaseStat,
} from '../reports/aggregate';

interface Props { user: User; }

interface ReportData {
  openings: OpeningStat[];
  motifs: MotifStat[];
  phases: PhaseStat[];
  hasHistory: boolean;
}

const MOTIF_LABELS: Record<string, string> = {
  missed_mate: 'missed mates',
  walked_into_mate: 'walked into mate',
  hung_piece: 'hung pieces',
  missed_fork: 'missed forks',
};

const PHASE_LABELS: Record<PhaseStat['phase'], string> = {
  opening: 'Opening',
  middlegame: 'Middlegame',
  endgame: 'Endgame',
};

export function ReportsView({ user }: Props) {
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    (async () => {
      try {
        // Profile + the games list can be fetched together; move_facts needs
        // the games' ids first (fetchReportFacts is strictly scoped to the
        // games passed in — see src/supabase/reports.ts), so it follows.
        const [profile, games] = await Promise.all([
          fetchProfile(client, user.id),
          fetchReportGames(client),
        ]);
        const facts = await fetchReportFacts(client, games.map((g) => g.id));
        if (cancelled) return;
        setData({
          openings: worstOpenings(games, profile),
          motifs: missedMotifs(facts, games, profile),
          phases: phaseCollapse(facts, games, profile),
          hasHistory: games.length > 0,
        });
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  if (error) return <div className="err">{error}</div>;

  if (!data) {
    return (
      <div className="reports">
        <div className="card report-card skel" style={{ height: 140 }} />
        <div className="card report-card skel" style={{ height: 140 }} />
        <div className="card report-card skel" style={{ height: 140 }} />
        <div className="card report-card skel" style={{ height: 140 }} />
      </div>
    );
  }

  if (!data.hasHistory) {
    return (
      <div className="reports">
        <div className="card report-empty">Analyze a few games to unlock your weakness reports.</div>
      </div>
    );
  }

  return (
    <div className="reports">
      <OpeningsCard openings={data.openings} />
      <MotifsCard motifs={data.motifs} />
      <PhaseCard phases={data.phases} />
    </div>
  );
}

function OpeningsCard({ openings }: { openings: OpeningStat[] }) {
  return (
    <div className="card report-card">
      <h4>Worst openings</h4>
      {openings.length === 0 ? (
        <div className="report-empty-row">Play the same opening a couple of times to see this.</div>
      ) : (
        <div className="rep-rows">
          {openings.slice(0, 8).map((o) => (
            <div className="rep-row" key={o.opening}>
              <span className="rep-label">{o.opening}</span>
              <span className="rep-sub">{o.games} games</span>
              <span className="rep-bar-track">
                <span className="rep-bar" style={{ width: `${Math.max(0, Math.min(100, o.avgAccuracy))}%` }} />
              </span>
              <span className="rep-value">{o.avgAccuracy.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MotifsCard({ motifs }: { motifs: MotifStat[] }) {
  const max = Math.max(1, ...motifs.map((m) => m.count));
  return (
    <div className="card report-card">
      <h4>Missed motifs</h4>
      {motifs.length === 0 ? (
        <div className="report-empty-row">No recurring tactical misses found — nice.</div>
      ) : (
        <div className="rep-rows">
          {motifs.map((m) => (
            <div className="rep-row" key={m.motif}>
              <span className="rep-label">{MOTIF_LABELS[m.motif] ?? m.motif}</span>
              <span className="rep-bar-track">
                <span className="rep-bar" style={{ width: `${(m.count / max) * 100}%` }} />
              </span>
              <span className="rep-value">×{m.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PhaseCard({ phases }: { phases: PhaseStat[] }) {
  const worst = phases.reduce<PhaseStat | null>((w, p) => (!w || p.badMovePct > w.badMovePct ? p : w), null);
  return (
    <div className="card report-card">
      <h4>Phase breakdown</h4>
      {phases.length === 0 ? (
        <div className="report-empty-row">Not enough analyzed moves yet.</div>
      ) : (
        <div className="rep-phases">
          {phases.map((p) => (
            <div className={`rep-phase${worst && p.phase === worst.phase ? ' rep-phase-worst' : ''}`} key={p.phase}>
              <div className="rep-phase-name">{PHASE_LABELS[p.phase]}</div>
              <div className="rep-phase-stat">{p.avgWinDrop.toFixed(1)}<span className="rep-phase-unit">avg win-drop</span></div>
              <div className="rep-phase-stat">{p.badMovePct.toFixed(0)}%<span className="rep-phase-unit">bad moves</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
