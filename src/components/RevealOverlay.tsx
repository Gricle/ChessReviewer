import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReviewSummary } from '../chess/types';
import type { PlayerRatings } from '../chess/ratings';
import { CLASS_META, CLASS_ORDER } from './classMeta';
import { playSound } from '../sound';
import { useCountUp } from '../hooks/useCountUp';
import { prefersReducedMotion } from '../hooks/reducedMotion';
import { STAGE_MS, nextStage, stageReached, type RevealStage } from './revealStages';

interface Props {
  summary: ReviewSummary;
  white: string;
  black: string;
  ratings: PlayerRatings;
  soundOn: boolean;
  onClose: () => void;
}

export function RevealOverlay({ summary, white, black, ratings, soundOn, onClose }: Props) {
  const { t } = useTranslation('review');
  const [stage, setStage] = useState<RevealStage>(() => (prefersReducedMotion() ? 'done' : 'enter'));

  // Advance the timeline.
  useEffect(() => {
    if (stage === 'done') return;
    const id = window.setTimeout(() => setStage(nextStage(stage)), STAGE_MS[stage]);
    return () => window.clearTimeout(id);
  }, [stage]);

  // Stage-entry sounds.
  useEffect(() => {
    if (!soundOn) return;
    if (stage === 'enter') playSound('fanfare');
    if (stage === 'ratings') playSound('flip');
    if (stage === 'badges') playSound('tick');
  }, [stage, soundOn]);

  // Counter ticks while accuracy numbers run.
  useEffect(() => {
    if (!soundOn || stage !== 'accuracy') return;
    const id = window.setInterval(() => playSound('tick'), 150);
    return () => window.clearInterval(id);
  }, [stage, soundOn]);

  // Escape skips the animation, or closes once already at the done stage.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (stage !== 'done') setStage('done');
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, onClose]);

  const done = stage === 'done';
  const counting = stageReached(stage, 'accuracy');
  const whiteAcc = useCountUp(summary.whiteAccuracy, counting, done ? 0 : 1200);
  const blackAcc = useCountUp(summary.blackAccuracy, counting, done ? 0 : 1200);
  const showRatings = stageReached(stage, 'ratings');
  const showBadges = stageReached(stage, 'badges');

  const badgeRows = CLASS_ORDER.filter(
    (l) => summary.counts[l].white > 0 || summary.counts[l].black > 0,
  );

  const skip = () => { if (!done) setStage('done'); };

  return (
    <div className="reveal-overlay" onClick={skip} role="dialog" aria-modal="true" aria-label={t('reveal.ariaLabel')}>
      <div className="reveal-card">
        <div className="reveal-head">
          <span className="reveal-knight" aria-hidden="true">♞</span>
          <h2>{t('reveal.title')}</h2>
          {summary.opening && <div className="reveal-opening">{summary.opening.name}</div>}
        </div>

        <div className={`reveal-sec acc${counting ? ' in' : ''}`}>
          <div className="reveal-player">
            <div className="rp-name">{white}</div>
            <div className="rp-acc">{whiteAcc.toFixed(1)}</div>
            <div className={`rp-rating${showRatings ? ' flip-in' : ''}`}>
              {ratings.white !== null && <span className="rp-elo">{ratings.white}</span>}
              <span className="rp-est">~{summary.estRating.white}</span>
            </div>
          </div>
          <div className="reveal-vs">{t('reveal.vs')}</div>
          <div className="reveal-player">
            <div className="rp-name">{black}</div>
            <div className="rp-acc">{blackAcc.toFixed(1)}</div>
            <div className={`rp-rating${showRatings ? ' flip-in' : ''}`}>
              {ratings.black !== null && <span className="rp-elo">{ratings.black}</span>}
              <span className="rp-est">~{summary.estRating.black}</span>
            </div>
          </div>
        </div>

        <div className={`reveal-sec badges${showBadges ? ' in' : ''}`}>
          {badgeRows.map((label, i) => {
            const meta = CLASS_META[label];
            const c = summary.counts[label];
            return (
              <div
                className="reveal-badge-row"
                key={label}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span className={`badge ${meta.cls}`}>{meta.sym}</span>
                <span className="rb-label">{t(`cls.${label}`)}</span>
                <span className="rb-w">{c.white}</span>
                <span className="rb-b">{c.black}</span>
              </div>
            );
          })}
        </div>

        <div className={`reveal-sec cta${done ? ' in' : ''}`}>
          <button
            className="primary reveal-start"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            {t('reveal.startReview')}
          </button>
        </div>
      </div>
    </div>
  );
}
