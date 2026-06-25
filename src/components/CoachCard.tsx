import { useEffect, useRef } from 'react';
import type { Classification } from '../chess/types';
import { CLASS_META } from './classMeta';
import { speak, cancelSpeech } from '../speech';

export interface CurrentMove {
  san: string;
  cls: Classification;
  bestSan: string;
  isBest: boolean;
}

interface Props {
  opening: { eco: string; name: string } | null;
  evalCp: number;        // white-perspective centipawns
  move: CurrentMove | null;
  voiceOn?: boolean;
}

function formatEval(cp: number): string {
  if (Math.abs(cp) >= 10000) return cp > 0 ? 'M' : '-M';
  const p = cp / 100;
  return `${p > 0 ? '+' : ''}${p.toFixed(1)}`;
}

function description(move: CurrentMove): string {
  const cls = move.cls;

  if (cls === 'book') return `${move.san} is a book move — theory continues.`;

  if (cls === 'brilliant') return `A stunning sacrifice! ${move.bestSan} is the best move and it gives up material.`;
  if (cls === 'great') return `${move.san} is the only good move in this position.`;
  if (cls === 'best') return `${move.san} is the strongest move.`;
  if (cls === 'excellent') return `${move.san} is a strong move, but there was something even better.`;
  if (cls === 'good') return `${move.san} keeps the balance, but isn't the most accurate.`;

  if (cls === 'inaccuracy') return `Better was ${move.bestSan}.`;
  if (cls === 'mistake') return `Better was ${move.bestSan}. This could have been punished.`;
  if (cls === 'blunder') return `Better was ${move.bestSan}. This is a blunder.`;

  return '';
}

export function CoachCard({ opening, evalCp, move, voiceOn = true }: Props) {
  const meta = move ? CLASS_META[move.cls] : null;
  const evalPositive = evalCp >= 0;
  const wantsBetter = move && (move.cls === 'inaccuracy' || move.cls === 'mistake' || move.cls === 'blunder');
  const isGood = move && (move.cls === 'brilliant' || move.cls === 'great' || move.cls === 'best');
  const isNeutral = move && (move.cls === 'excellent' || move.cls === 'good' || move.cls === 'book');
  const comment = move ? description(move) : '';

  // Auto-speak coach comment when landing on a new move.
  const prevMoveRef = useRef<CurrentMove | null>(null);
  useEffect(() => {
    if (move && voiceOn && comment && move !== prevMoveRef.current) {
      speak(comment);
    } else if (!voiceOn) {
      cancelSpeech();
    }
    prevMoveRef.current = move;
  }, [move, voiceOn]);

  return (
    <div className="card coach">
      <div className="coach-head">
        <div className="avatar" aria-hidden="true">♞</div>
        <div className="coach-title">
          <h3>Game Review</h3>
          {opening && <div className="opening">{opening.eco} · {opening.name}</div>}
        </div>
        <div className={`eval-pill ${evalPositive ? 'pos' : 'neg'}`}>{formatEval(evalCp)}</div>
      </div>

      {move && (
        <div className="coach-move">
          <div className="move-class-row">
            <span className={`badge lg ${meta!.cls}`}>{meta!.sym}</span>
            <span className="class-label">{meta!.label}</span>
          </div>

          <div className="move-detail">
            {wantsBetter && (
              <>
                <div className="dual-line">
                  <span className="line-label">You played</span>
                  <span className="played-san">{move.san}</span>
                </div>
                <div className="dual-line best">
                  <span className="line-label">Best move</span>
                  <span className="best-san">{move.bestSan}</span>
                </div>
              </>
            )}

            {isGood && (
              <div className="single-line found">
                You found the best move: <strong>{move.san}</strong>
              </div>
            )}

            {isNeutral && (
              <div className="single-line">
                You played <strong>{move.san}</strong>
              </div>
            )}
          </div>

          <div className="desc-row">
            <p className="desc">{comment}</p>
            <button
              className="speak-btn"
              onClick={(e) => { e.stopPropagation(); speak(comment); }}
              title="Read aloud"
              aria-label="Read coach comment aloud"
              disabled={!voiceOn || !comment}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {!move && (
        <div className="coach-empty">
          <p>Step through the game to see each move reviewed.</p>
        </div>
      )}
    </div>
  );
}
