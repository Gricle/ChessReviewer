// Chess.com-style sound effects synthesized via Web Audio API.
// No external assets needed — works offline. The AudioContext is created
// lazily after the first user gesture so it passes browser autoplay policies.
//
// Sound design:
//  - move:     soft wooden thud (filtered noise + low thump)
//  - capture:  sharp impact + piece collision rattle
//  - check:    bright ring (two sine waves)
//  - castle:   two wooden thuds (king slides, rook follows)
//  - promote:  rising flourish (three ascending tones + landing)
//  - gameEnd:  conclusive musical phrase (descending)
//  - draw:     flat two-tone (no winner)

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// ── helpers ──────────────────────────────────────────────

/** Short burst of white noise run through a bandpass filter. */
function noiseHit(
  c: AudioContext,
  t: number,
  freq: number,
  Q: number,
  dur: number,
  peak: number,
) {
  const bufSize = c.sampleRate * dur;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(freq, t);
  bp.Q.setValueAtTime(Q, t);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(bp).connect(gain).connect(c.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

/** Single sine thump for the low body of a move. */
function thump(
  c: AudioContext,
  t: number,
  freq: number,
  dur: number,
  peak: number,
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.3, t + dur * 0.5);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Bell-like ring for checks. */
function ring(
  c: AudioContext,
  t: number,
  freq: number,
  dur: number,
  peak: number,
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// ── sounds ───────────────────────────────────────────────

export type SoundKind =
  | 'move'
  | 'capture'
  | 'check'
  | 'castle'
  | 'promote'
  | 'gameEnd'
  | 'draw';

export function playSound(kind: SoundKind): void {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;

  switch (kind) {
    case 'move': {
      // Wooden thud: low thump + body resonance
      thump(c, t, 110, 0.10, 0.18);
      noiseHit(c, t, 1200, 2.0, 0.055, 0.08);
      break;
    }

    case 'capture': {
      // Sharp impact — louder thump + higher frequency rattle
      thump(c, t, 130, 0.08, 0.25);
      noiseHit(c, t, 1600, 1.8, 0.04, 0.18);
      // Second smaller hit for the captured piece falling
      noiseHit(c, t + 0.03, 900, 1.5, 0.04, 0.08);
      break;
    }

    case 'check': {
      // Bright ring + harmonic
      ring(c, t, 1047, 0.28, 0.10);    // C6
      ring(c, t + 0.04, 1319, 0.25, 0.06);  // E6
      break;
    }

    case 'castle': {
      // King moves first, then rook slides over
      thump(c, t, 110, 0.08, 0.15);
      noiseHit(c, t, 1200, 2.0, 0.04, 0.06);
      // Rook
      thump(c, t + 0.12, 95, 0.09, 0.14);
      noiseHit(c, t + 0.12, 1000, 2.5, 0.05, 0.05);
      break;
    }

    case 'promote': {
      // Triplet ascending flourish
      ring(c, t, 523, 0.10, 0.07);     // C5
      ring(c, t + 0.06, 659, 0.10, 0.07);   // E5
      ring(c, t + 0.12, 784, 0.10, 0.07);   // G5
      // Landing on the piece
      thump(c, t + 0.20, 130, 0.12, 0.20);
      noiseHit(c, t + 0.20, 1400, 2.0, 0.05, 0.10);
      break;
    }

    case 'gameEnd': {
      // Conclusive descending phrase: C-E-G → G-E-C
      ring(c, t, 523, 0.15, 0.07);      // C5
      ring(c, t + 0.10, 659, 0.15, 0.07);    // E5
      ring(c, t + 0.20, 784, 0.15, 0.07);    // G5
      ring(c, t + 0.35, 659, 0.18, 0.06);    // E5
      ring(c, t + 0.45, 523, 0.30, 0.05);    // C5
      break;
    }

    case 'draw': {
      // Flat draw — two equal tones
      ring(c, t, 659, 0.20, 0.06);       // E5
      ring(c, t + 0.12, 659, 0.25, 0.05);     // E5 again
      break;
    }
  }
}

/** Pick the sound for a move from its SAN notation. */
export function sanToSound(san: string): SoundKind {
  if (san.includes('#')) return 'gameEnd';
  if (san === 'O-O' || san === 'O-O-O') return 'castle';   // castle even if giving check
  if (san.includes('+')) return 'check';
  if (san.includes('=')) return 'promote';
  if (san.includes('x')) return 'capture';
  return 'move';
}
