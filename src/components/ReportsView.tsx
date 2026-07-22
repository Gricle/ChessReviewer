import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useTranslation } from 'react-i18next';
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

const MOTIF_LABEL_KEYS: Record<string, string> = {
  missed_mate: 'reports.motifs.labels.missedMate',
  walked_into_mate: 'reports.motifs.labels.walkedIntoMate',
  hung_piece: 'reports.motifs.labels.hungPiece',
  missed_fork: 'reports.motifs.labels.missedFork',
};

const PHASE_LABEL_KEYS: Record<PhaseStat['phase'], string> = {
  opening: 'reports.phases.labels.opening',
  middlegame: 'reports.phases.labels.middlegame',
  endgame: 'reports.phases.labels.endgame',
};

export function ReportsView({ user }: Props) {
  const { t } = useTranslation('library');
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
        <div className="card report-empty">{t('reports.empty')}</div>
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
  const { t } = useTranslation('library');
  return (
    <div className="card report-card">
      <h4>{t('reports.worstOpenings.heading')}</h4>
      {openings.length === 0 ? (
        <div className="report-empty-row">{t('reports.worstOpenings.empty')}</div>
      ) : (
        <div className="rep-rows">
          {openings.slice(0, 8).map((o) => (
            <div className="rep-row" key={o.opening}>
              <span className="rep-label">{o.opening}</span>
              <span className="rep-sub">{t('reports.worstOpenings.gamesCount', { count: o.games })}</span>
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
  const { t } = useTranslation('library');
  const max = Math.max(1, ...motifs.map((m) => m.count));
  return (
    <div className="card report-card">
      <h4>{t('reports.motifs.heading')}</h4>
      {motifs.length === 0 ? (
        <div className="report-empty-row">{t('reports.motifs.empty')}</div>
      ) : (
        <div className="rep-rows">
          {motifs.map((m) => (
            <div className="rep-row" key={m.motif}>
              <span className="rep-label">{MOTIF_LABEL_KEYS[m.motif] ? t(MOTIF_LABEL_KEYS[m.motif]) : m.motif}</span>
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
  const { t } = useTranslation('library');
  const worst = phases.reduce<PhaseStat | null>((w, p) => (!w || p.badMovePct > w.badMovePct ? p : w), null);
  return (
    <div className="card report-card">
      <h4>{t('reports.phases.heading')}</h4>
      {phases.length === 0 ? (
        <div className="report-empty-row">{t('reports.phases.empty')}</div>
      ) : (
        <div className="rep-phases">
          {phases.map((p) => (
            <div className={`rep-phase${worst && p.phase === worst.phase ? ' rep-phase-worst' : ''}`} key={p.phase}>
              <div className="rep-phase-name">{t(PHASE_LABEL_KEYS[p.phase])}</div>
              <div className="rep-phase-stat">{p.avgWinDrop.toFixed(1)}<span className="rep-phase-unit">{t('reports.phases.avgWinDrop')}</span></div>
              <div className="rep-phase-stat">{p.badMovePct.toFixed(0)}%<span className="rep-phase-unit">{t('reports.phases.badMoves')}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
