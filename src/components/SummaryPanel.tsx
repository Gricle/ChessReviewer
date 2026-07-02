import type { ReactNode } from 'react';
import type { ReviewSummary } from '../chess/types';
import type { PlayerRatings } from '../chess/ratings';
import { CLASS_META, CLASS_ORDER } from './classMeta';

interface Props {
  summary: ReviewSummary;
  white: string;
  black: string;
  ratings: PlayerRatings;
  result?: string | null;
  children?: ReactNode;
}

function movesPlayed(summary: ReviewSummary, color: 'white' | 'black'): number {
  return Object.values(summary.counts).reduce((n, c) => n + c[color], 0);
}

export function SummaryPanel({ summary, white, black, ratings, result, children }: Props) {
  return (
    <div className="card panel-card">
      <div className="acc-row">
        <div className="acc white">
          <div className="who" title={white}>{white}</div>
          <div className="val">{summary.whiteAccuracy.toFixed(1)}</div>
          <div className="perf" title="Estimated performance this game">
            {ratings.white !== null && <span className="elo">{ratings.white}</span>}
            {movesPlayed(summary, 'white') > 0 && <span className="est">~{summary.estRating.white}</span>}
          </div>
        </div>
        <div className={`acc result${result ? '' : ' hidden'}`}>
          <div className="who">Result</div>
          <div className="val">{result ?? '?'}</div>
        </div>
        <div className="acc black">
          <div className="who" title={black}>{black}</div>
          <div className="val">{summary.blackAccuracy.toFixed(1)}</div>
          <div className="perf" title="Estimated performance this game">
            {ratings.black !== null && <span className="elo">{ratings.black}</span>}
            {movesPlayed(summary, 'black') > 0 && <span className="est">~{summary.estRating.black}</span>}
          </div>
        </div>
      </div>

      <div className="panel-scroll">
        {children}

        <div className="breakdown">
          <div className="bd-head"><span /><span>Move</span><span>W</span><span>B</span></div>
          {CLASS_ORDER.map((label) => {
            const c = summary.counts[label];
            if (c.white === 0 && c.black === 0) return null;
            const meta = CLASS_META[label];
            return (
              <div className="bd-row" key={label}>
                <span className={`badge ${meta.cls}`}>{meta.sym}</span>
                <span className="label">{meta.label}</span>
                <span className="w">{c.white}</span>
                <span className="b">{c.black}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
