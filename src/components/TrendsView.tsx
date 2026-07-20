import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { fetchProfile } from '../supabase/library';
import { fetchReportGames, fetchReportFacts, type ReportGameRow, type ReportFactRow } from '../supabase/reports';
import type { Profile } from '../supabase/library';
import {
  trendSeries, blundersPerGame, headlineStats, type TrendFilter,
} from '../reports/aggregate';
import { TrendsDashboard } from './TrendsDashboard';

interface Props { user: User; }
interface Loaded { games: ReportGameRow[]; facts: ReportFactRow[]; profile: Profile | null; }

export function TrendsView({ user }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TrendFilter>({ color: 'all', range: 'all' });

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    (async () => {
      try {
        const [profile, games] = await Promise.all([fetchProfile(client, user.id), fetchReportGames(client)]);
        const facts = await fetchReportFacts(client, games.map((g) => g.id));
        if (!cancelled) setLoaded({ games, facts, profile });
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  const derived = useMemo(() => {
    if (!loaded) return null;
    return {
      stats: headlineStats(loaded.games, loaded.facts, loaded.profile, filter),
      series: trendSeries(loaded.games, loaded.profile, filter),
      blunders: blundersPerGame(loaded.facts, loaded.games, loaded.profile, filter),
    };
  }, [loaded, filter]);

  if (error) return <div className="err">{error}</div>;
  if (!derived) return <div className="card report-card skel" style={{ height: 320 }} />;
  if (loaded && loaded.games.length === 0) {
    return <div className="card report-empty">Analyze a few games to unlock your trends.</div>;
  }

  return (
    <TrendsDashboard
      stats={derived.stats}
      series={derived.series}
      blunders={derived.blunders}
      filter={filter}
      onFilterChange={setFilter}
    />
  );
}
