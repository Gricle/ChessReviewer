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

export type Speed = 'off' | 'slow' | 'medium' | 'fast';

const SPEED_LABEL: Record<Speed, string> = {
  off: 'Autoplay',
  slow: '×½',
  medium: '×1',
  fast: '×2',
};

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
  const atStart = ply === 0;
  const atEnd = ply >= total;
  const playing = speed !== 'off';

  return (
    <div className="glass-panel rounded-2xl p-4 border border-indigo-400/20 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
      {/* Playback Navigation Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onSelectPly(0)}
          disabled={atStart}
          title="Jump to Start (Home)"
          aria-label="Jump to Start (Home)"
          className={navBtn}
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={() => onSelectPly(ply - 1)}
          disabled={atStart}
          title="Previous Move (←)"
          aria-label="Previous Move (←)"
          className={navBtn}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Autoplay Button */}
        <button
          onClick={onCycleSpeed}
          title="Cycle Autoplay Speed (Space)"
          aria-label="Cycle Autoplay Speed (Space)"
          className={`px-3 py-2 rounded-xl border flex items-center gap-1.5 font-mono text-xs font-bold transition-all cursor-pointer ${
            playing
              ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(56,225,214,0.3)]'
              : 'bg-indigo-950/60 border-indigo-500/20 text-slate-300 hover:bg-indigo-900/40'
          }`}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span>{SPEED_LABEL[speed]}</span>
        </button>

        <button
          onClick={() => onSelectPly(ply + 1)}
          disabled={atEnd}
          title="Next Move (→)"
          aria-label="Next Move (→)"
          className={navBtn}
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <button
          onClick={() => onSelectPly(total)}
          disabled={atEnd}
          title="Jump to End (End)"
          aria-label="Jump to End (End)"
          className={navBtn}
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Board Flip & Sound Controls */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onToggleFlip}
          title="Flip Board Orientation (F)"
          aria-label="Flip Board Orientation (F)"
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
          title={soundOn ? 'Mute Sound FX' : 'Unmute Sound FX'}
          aria-label={soundOn ? 'Mute Sound FX' : 'Unmute Sound FX'}
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
          title="Volume"
          aria-label="Volume"
        />

        <button
          onClick={onToggleVoice}
          title={voiceOn ? 'Disable Coach Voice' : 'Enable Coach Voice'}
          aria-label={voiceOn ? 'Disable Coach Voice' : 'Enable Coach Voice'}
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
