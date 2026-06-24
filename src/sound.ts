// Tiny Web Audio sound effects — synthesized, no asset files, works offline.
// The AudioContext is created lazily so it starts after a user gesture
// (clicking a move / nav button), satisfying browser autoplay policies.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// One short enveloped blip.
function blip(
  c: AudioContext,
  freq: number,
  start: number,
  dur: number,
  peak: number,
  type: OscillatorType = 'triangle',
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export type SoundKind = 'move' | 'capture' | 'check' | 'checkmate';

export function playSound(kind: SoundKind): void {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  switch (kind) {
    case 'move':
      blip(c, 180, t, 0.09, 0.11, 'triangle');
      break;
    case 'capture':
      blip(c, 260, t, 0.05, 0.13, 'square');
      blip(c, 110, t + 0.018, 0.11, 0.12, 'triangle');
      break;
    case 'check':
      blip(c, 880, t, 0.10, 0.10, 'sine');
      blip(c, 1320, t + 0.06, 0.10, 0.07, 'sine');
      break;
    case 'checkmate':
      blip(c, 523.25, t, 0.12, 0.11, 'triangle');
      blip(c, 659.25, t + 0.10, 0.12, 0.11, 'triangle');
      blip(c, 783.99, t + 0.20, 0.22, 0.12, 'triangle');
      break;
  }
}

// Pick the sound for a move from its SAN notation (priority: mate > check > capture).
export function sanToSound(san: string): SoundKind {
  if (san.includes('#')) return 'checkmate';
  if (san.includes('+')) return 'check';
  if (san.includes('x')) return 'capture';
  return 'move';
}
