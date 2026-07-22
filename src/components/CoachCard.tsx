import { useEffect, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import type { Classification } from '../chess/types';
import { CLASS_META } from './classMeta';
import { ClassChip } from './ClassChip';
import { speak, cancelSpeech } from '../speech';

export interface CurrentMove {
  san: string;
  cls: Classification;
  bestSan: string;
  isBest: boolean;
  explanation: string;
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

export function CoachCard({ opening, evalCp, move, voiceOn = true }: Props) {
  const { t } = useTranslation('review');
  const meta = move ? CLASS_META[move.cls] : null;
  const wantsBetter = move && (move.cls === 'inaccuracy' || move.cls === 'mistake' || move.cls === 'blunder');
  const isGood = move && (move.cls === 'brilliant' || move.cls === 'great' || move.cls === 'best');
  const isNeutral = move && (move.cls === 'excellent' || move.cls === 'good' || move.cls === 'book');
  const comment = move ? move.explanation : '';

  // Auto-speak coach comment when landing on a new move.
  const prevMoveRef = useRef<CurrentMove | null>(null);
  useEffect(() => {
    if (move && voiceOn && comment && move !== prevMoveRef.current) {
      speak(comment);
    } else if (!voiceOn) {
      cancelSpeech();
    }
    prevMoveRef.current = move;
  }, [move, voiceOn, comment]);

  const evalPillClass = evalCp > 50
    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
    : evalCp < -50
      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
      : 'bg-slate-800 text-slate-300 border border-slate-700';

  return (
    <div className="glass-panel rounded-2xl p-5 border border-indigo-400/20 flex flex-col gap-3 shadow-xl relative overflow-hidden">
      {move && meta && (
        <div
          className="absolute top-0 right-0 w-32 h-32 blur-3xl opacity-20 pointer-events-none rounded-full"
          style={{ backgroundColor: meta.hex }}
        />
      )}

      <div className="flex items-center justify-between border-b border-indigo-400/10 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600/40 to-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-xl text-cyan-300" aria-hidden="true">
            ♞
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
              {t('coachCard.title')}
            </span>
            {opening && (
              <span className="text-[11px] text-slate-400 font-mono bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-500/20">
                {opening.eco} · {opening.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold ${evalPillClass}`}>
            {formatEval(evalCp)}
          </div>
          <button
            className="p-2 rounded-xl bg-indigo-950/60 hover:bg-cyan-500/20 text-cyan-300 border border-indigo-500/30 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={(e) => { e.stopPropagation(); speak(comment); }}
            title={t('coachCard.readAloud')}
            aria-label={t('coachCard.readAloudAria')}
            disabled={!voiceOn || !comment}
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {move && meta && (
        <>
          <div className="bg-indigo-950/40 p-3 rounded-xl border border-indigo-400/10">
            <ClassChip cls={move.cls} size="md" />
          </div>

          <div className="text-sm font-mono bg-black/20 p-3 rounded-xl border border-white/5 space-y-1">
            {wantsBetter && (
              <>
                <div className="text-slate-300">
                  <Trans
                    i18nKey="review:coachCard.youPlayed"
                    values={{ san: move.san }}
                    components={{ bold: <strong className="text-cyan-300" /> }}
                  />
                </div>
                <div className="text-emerald-400 font-semibold">
                  <Trans
                    i18nKey="review:coachCard.bestMove"
                    values={{ bestSan: move.bestSan }}
                    components={{ bold: <strong className="underline underline-offset-2" /> }}
                  />
                </div>
              </>
            )}

            {isGood && (
              <div className="text-slate-300">
                <Trans
                  i18nKey="review:coachCard.foundBest"
                  values={{ san: move.san }}
                  components={{ bold: <strong className="text-cyan-300" /> }}
                />
              </div>
            )}

            {isNeutral && (
              <div className="text-slate-300">
                <Trans
                  i18nKey="review:coachCard.youPlayed"
                  values={{ san: move.san }}
                  components={{ bold: <strong className="text-cyan-300" /> }}
                />
              </div>
            )}
          </div>

          <p className="text-sm text-indigo-100/90 leading-relaxed font-sans">{comment}</p>
        </>
      )}

      {!move && (
        <div className="text-center text-indigo-200/60 text-sm py-4">
          {t('coachCard.empty')}
        </div>
      )}
    </div>
  );
}
