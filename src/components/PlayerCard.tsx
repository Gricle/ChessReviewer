import { useTranslation } from 'react-i18next';

interface Props {
  name: string;
  elo: number | null;
  accuracy: number | null;
  color: 'white' | 'black';
}

export function PlayerCard({ name, elo, accuracy, color }: Props) {
  const { t } = useTranslation('review');
  const isWhite = color === 'white';
  return (
    <div className="glass-panel rounded-2xl p-3 flex items-center justify-between border border-indigo-400/20">
      <div className="flex items-center gap-2.5">
        <div
          className={
            'w-8 h-8 rounded-xl border flex items-center justify-center text-lg font-bold ' +
            (isWhite
              ? 'bg-[#edf0fc] border-white text-[#05040c]'
              : 'bg-[#120f26] border-slate-600 text-white')
          }
        >
          {isWhite ? '♔' : '♚'}
        </div>
        <div>
          <p className="text-xs font-bold text-white font-mono">{name}</p>
          <p className="text-[10px] font-mono text-slate-400">{t('playerCard.elo', { elo: elo ?? '?' })}</p>
        </div>
      </div>

      {accuracy !== null && (
        <div className="text-right font-mono text-xs">
          <span className="text-cyan-300 font-bold">{t('playerCard.accuracy', { value: accuracy.toFixed(1) })}</span>
        </div>
      )}
    </div>
  );
}
