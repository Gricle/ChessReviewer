import { useState } from 'react';
import {
  rollingAverage,
  type TrendFilter, type ColorFilter, type RangeFilter,
  type TrendSeriesPoint, type BlunderPoint, type HeadlineStats, type Stat,
} from '../reports/aggregate';

interface Props {
  stats: HeadlineStats;
  series: TrendSeriesPoint[];
  blunders: BlunderPoint[];
  filter: TrendFilter;
  onFilterChange: (f: TrendFilter) => void;
}

const COLORS: ColorFilter[] = ['all', 'white', 'black'];
const RANGES: RangeFilter[] = ['all', '30d', '3mo'];
const RANGE_LABELS: Record<RangeFilter, string> = { all: 'All time', '30d': 'Last 30d', '3mo': 'Last 3mo' };
const COLOR_LABELS: Record<ColorFilter, string> = { all: 'Both', white: 'White', black: 'Black' };

const CW = 640;
const CH = 160;

export function TrendsDashboard({ stats, series, blunders, filter, onFilterChange }: Props) {
  return (
    <div className="trends">
      <div className="trends-filters">
        <Segmented label="Color" options={COLORS} value={filter.color}
          render={(c) => COLOR_LABELS[c]} onSelect={(color) => onFilterChange({ ...filter, color })} />
        <Segmented label="Range" options={RANGES} value={filter.range}
          render={(r) => RANGE_LABELS[r]} onSelect={(range) => onFilterChange({ ...filter, range })} />
      </div>

      <div className="trends-tiles">
        <Tile label="avg accuracy" stat={stats.avgAccuracy} format={(v) => `${v.toFixed(1)}%`} higherBetter />
        <Tile label="est. rating" stat={stats.estRating} format={(v) => v.toFixed(0)} higherBetter />
        <Tile label="win rate" stat={stats.winRate} format={(v) => `${v.toFixed(0)}%`} higherBetter />
        <Tile label="blunders / game" stat={stats.blundersPerGame} format={(v) => v.toFixed(1)} higherBetter={false} />
      </div>

      {series.length < 3 ? (
        <div className="card report-empty">Analyze more games to see your trend.</div>
      ) : (
        <>
          <TrendChart series={series} />
          <BlunderBars blunders={blunders} />
        </>
      )}
    </div>
  );
}

function Segmented<T extends string>({ label, options, value, render, onSelect }: {
  label: string; options: T[]; value: T; render: (o: T) => string; onSelect: (o: T) => void;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} className={`seg-btn${o === value ? ' seg-on' : ''}`}
          aria-pressed={o === value} onClick={() => onSelect(o)}>{render(o)}</button>
      ))}
    </div>
  );
}

function Tile({ label, stat, format, higherBetter }: {
  label: string; stat: Stat | null; format: (v: number) => string; higherBetter: boolean;
}) {
  if (!stat) {
    return (
      <div className="trend-tile">
        <div className="tile-value tile-muted">—</div>
        <div className="tile-label">{label}</div>
        <div className="tile-delta tile-muted" title="Set your username in Profile to track wins">no data</div>
      </div>
    );
  }
  const good = stat.delta === null ? null : higherBetter ? stat.delta > 0 : stat.delta < 0;
  const arrow = stat.delta === null ? '' : stat.delta > 0 ? '▲' : stat.delta < 0 ? '▼' : '';
  const deltaClass = good === null ? 'tile-muted' : good ? 'tile-up' : 'tile-down';
  return (
    <div className="trend-tile">
      <div className="tile-value">{format(stat.value)}</div>
      <div className="tile-label">{label}</div>
      <div className={`tile-delta ${deltaClass}`}>
        {stat.delta === null ? '—' : `${arrow} ${Math.abs(stat.delta).toFixed(1)} vs prev`}
      </div>
    </div>
  );
}

function TrendChart({ series }: { series: TrendSeriesPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const x = (i: number) => (i / Math.max(1, series.length - 1)) * CW;
  const yAcc = (v: number) => CH - (Math.max(0, Math.min(100, v)) / 100) * CH;

  const ratings = series.map((p) => p.estRating);
  const rMin = Math.min(...ratings);
  const rMax = Math.max(...ratings);
  const rSpan = rMax - rMin || 1;
  const yRating = (v: number) => CH - ((v - rMin) / rSpan) * CH;

  const roll = rollingAverage(series.map((p) => p.accuracy), 5);
  const rawPts = series.map((p, i) => `${x(i)},${yAcc(p.accuracy)}`).join(' ');
  const rollPts = roll.map((v, i) => `${x(i)},${yAcc(v)}`).join(' ');
  const ratingPts = series.map((p, i) => `${x(i)},${yRating(p.estRating)}`).join(' ');

  const ticks = [0, Math.floor(series.length / 2), series.length - 1];

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * CW;
    setHover(Math.max(0, Math.min(series.length - 1, Math.round((px / CW) * (series.length - 1)))));
  };

  return (
    <div className="card trend-chart">
      <div className="trend-chart-head">
        <span>Accuracy &amp; est. rating over time</span>
        <span className="trend-legend"><i className="lg-acc" /> accuracy <i className="lg-rating" /> rating</span>
      </div>
      <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" preserveAspectRatio="none"
        className="trend-svg" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <polyline points={ratingPts} fill="none" className="ln-rating" />
        <polyline points={rawPts} fill="none" className="ln-acc-raw" />
        <polyline points={rollPts} fill="none" className="ln-acc" />
        {hover !== null && (
          <line x1={x(hover)} y1={0} x2={x(hover)} y2={CH} className="ln-cursor" strokeDasharray="3 3" />
        )}
      </svg>
      <div className="trend-axis">
        {ticks.map((i) => <span key={i}>{series[i]?.date}</span>)}
      </div>
      {hover !== null && series[hover] && (
        <div className="trend-tip">
          {series[hover].date} · acc {series[hover].accuracy.toFixed(1)} · rating {series[hover].estRating.toFixed(0)}
          {series[hover].result ? ` · ${series[hover].result}` : ''}
        </div>
      )}
    </div>
  );
}

function BlunderBars({ blunders }: { blunders: BlunderPoint[] }) {
  const max = Math.max(1, ...blunders.map((b) => b.blunders));
  return (
    <div className="card blunder-bars">
      <div className="trend-chart-head"><span>Blunders per game</span></div>
      <div className="bb-row">
        {blunders.map((b, i) => (
          <span key={i} className="bb-bar" title={`${b.date}: ${b.blunders}`}
            style={{ height: `${(b.blunders / max) * 100}%` }} />
        ))}
      </div>
    </div>
  );
}
