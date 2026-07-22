import {
  SkipBack,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCw,
  Mic,
  MicOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export type Speed = 'off' | 'slow' | 'medium' | 'fast';

const navBtn =
  'p-2.5 rounded-xl bg-indigo-950/60 hover:bg-cyan-500/20 disabled:opacity-30 disabled:pointer-events-none text-slate-200 border border-indigo-500/20 transition-all cursor-pointer';

const toggleBtn =
  'p-2.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/40 text-slate-200 border border-indigo-500/20 transition-all cursor-pointer';

interface Props {
  ply: number;
  total: number;
  onSelectPly: (ply: number) => void;
  speed: Speed;
  onCycleSpeed: () => void;
  flipped: boolean;
  onToggleFlip: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
  voiceOn: boolean;
  onToggleVoice: () => void;
  volume: number;
  onVolume: (v: number) => void;
}

export function PlaybackControls({
  ply,
  total,
  onSelectPly,
  speed,
  onCycleSpeed,
  flipped,
  onToggleFlip,
  soundOn,
  onToggleSound,
  voiceOn,
  onToggleVoice,
  volume,
  onVolume,
}: Props) {
  const { t } = useTranslation('review');
  const atStart = ply === 0;
  const atEnd = ply >= total;
  const playing = speed !== 'off';

  const speedLabel: Record<Speed, string> = {
    off: t('playback.speed.autoplay'),
    slow: '×½',
    medium: '×1',
    fast: '×2',
  };

  return (
    <div className="glass-panel rounded-2xl p-4 border border-indigo-400/20 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
      {/* Playback Navigation Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onSelectPly(0)}
          disabled={atStart}
          title={t('playback.jumpStart')}
          aria-label={t('playback.jumpStart')}
          className={navBtn}
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectPly(ply - 1)}
          disabled={atStart}
          title={t('playback.prevMove')}
          aria-label={t('playback.prevMove')}
          className={navBtn}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Autoplay Button */}
        <button
          onClick={onCycleSpeed}
          title={t('playback.cycleSpeed')}
          aria-label={t('playback.cycleSpeed')}
          className={`px-3 py-2 rounded-xl border flex items-center gap-1.5 font-mono text-xs font-bold transition-all cursor-pointer ${
            playing
              ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(56,225,214,0.3)]'
              : 'bg-indigo-950/60 border-indigo-500/20 text-slate-300 hover:bg-indigo-900/40'
          }`}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span>{speedLabel[speed]}</span>
        </button>

        <button
          onClick={() => onSelectPly(ply + 1)}
          disabled={atEnd}
          title={t('playback.nextMove')}
          aria-label={t('playback.nextMove')}
          className={navBtn}
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <button
          onClick={() => onSelectPly(total)}
          disabled={atEnd}
          title={t('playback.jumpEnd')}
          aria-label={t('playback.jumpEnd')}
          className={navBtn}
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Board Flip & Sound Controls */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onToggleFlip}
          title={t('playback.flipBoard')}
          aria-label={t('playback.flipBoard')}
          aria-pressed={flipped}
          className={`p-2.5 rounded-xl border text-slate-200 transition-all cursor-pointer ${
            flipped
              ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
              : 'bg-indigo-950/60 border-indigo-500/20 hover:bg-indigo-900/40'
          }`}
        >
          <RotateCw className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleSound}
          title={soundOn ? t('playback.muteSound') : t('playback.unmuteSound')}
          aria-label={soundOn ? t('playback.muteSound') : t('playback.unmuteSound')}
          aria-pressed={soundOn}
          className={toggleBtn}
        >
          {soundOn ? <Volume2 className="w-4 h-4 text-cyan-300" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
        </button>

        {/* Volume Slider */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => onVolume(Number(e.target.value))}
          className="w-16 h-1.5 bg-indigo-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          title={t('playback.volume')}
          aria-label={t('playback.volume')}
        />

        <button
          onClick={onToggleVoice}
          title={voiceOn ? t('playback.disableVoice') : t('playback.enableVoice')}
          aria-label={voiceOn ? t('playback.disableVoice') : t('playback.enableVoice')}
          aria-pressed={voiceOn}
          className={toggleBtn}
        >
          {voiceOn ? <Mic className="w-4 h-4 text-cyan-300" /> : <MicOff className="w-4 h-4 text-rose-400" />}
        </button>

        {/* Ply Counter */}
        <div className="px-3 py-1.5 rounded-xl bg-indigo-950/80 border border-indigo-400/20 font-mono text-xs font-bold text-cyan-300 whitespace-nowrap">
          {ply} / {total}
        </div>
      </div>
    </div>
  );
}
