// Web Speech API wrapper for coach voice comments.
// Uses the browser's built-in speech synthesis — no external assets.
// Chess.com-style: speaks the coach's evaluation aloud when landing on a move.

import i18n from './i18n';

// getVoices() is often empty until the async `voiceschanged` event fires, so
// keep a cache that refreshes when the browser reports its voice list.
let voiceCache: SpeechSynthesisVoice[] = [];
function refreshVoices(): void {
  voiceCache = window.speechSynthesis.getVoices();
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}

// Rank voices by realism. Modern neural voices (Edge "… Online (Natural)",
// Chrome's network "Google …", macOS "Enhanced"/"Premium"/Siri) sound human;
// the legacy local SAPI/eSpeak voices are the robotic ones — never prefer
// them over a neural voice. Returns -1 for voices in the wrong language.
export function scoreVoice(v: SpeechSynthesisVoice, lang: string): number {
  const primary = lang.split('-')[0].toLowerCase();
  if (!v.lang.toLowerCase().startsWith(primary)) return -1;
  const name = v.name.toLowerCase();
  let s = 0;
  if (name.includes('natural') || name.includes('neural')) s += 8;
  if (name.includes('google')) s += 4;
  if (name.includes('premium') || name.includes('enhanced')) s += 4;
  if (name.includes('siri')) s += 3;
  if (name.includes('online')) s += 2;
  if (!v.localService) s += 1; // network voices are generally the modern ones
  if (v.lang.toLowerCase() === lang.toLowerCase()) s += 1; // exact region match
  return s;
}

export function pickBestVoice(voices: readonly SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const s = scoreVoice(v, lang);
    if (s > bestScore) { best = v; bestScore = s; }
  }
  return best;
}

export function speak(text: string): void {
  if (!('speechSynthesis' in window)) return;

  // Cancel any in-progress speech so overlapping comments don't pile up.
  window.speechSynthesis.cancel();

  if (voiceCache.length === 0) refreshVoices();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = i18n.language; // Match the utterance language to the active UI locale.
  const voice = pickBestVoice(voiceCache, i18n.language);
  if (voice) u.voice = voice;

  // Neural voices pace themselves naturally at full rate; only the legacy
  // voices need slowing down to stay intelligible.
  const neural = voice ? scoreVoice(voice, i18n.language) >= 4 : false;
  u.rate = neural ? 1.0 : 0.92;
  u.pitch = 1.0;
  u.volume = 0.85;

  window.speechSynthesis.speak(u);
}

export function cancelSpeech(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
