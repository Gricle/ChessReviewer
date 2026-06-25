// Web Speech API wrapper for coach voice comments.
// Uses the browser's built-in speech synthesis — no external assets.
// Chess.com-style: speaks the coach's evaluation aloud when landing on a move.

export function speak(text: string): void {
  if (!('speechSynthesis' in window)) return;

  // Cancel any in-progress speech so overlapping comments don't pile up.
  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.92;   // Slightly slower than default for a calm coach voice
  u.pitch = 1.0;
  u.volume = 0.85;

  // Try to pick a male English voice — authoritative coach tone.
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) => v.lang.startsWith('en') && (
      v.name.includes('Male') || v.name.includes('David') || v.name.includes('Daniel')
      || v.name.includes('Google UK') || v.name.includes('Alex')
    ),
  );
  if (preferred) u.voice = preferred;

  window.speechSynthesis.speak(u);
}

export function cancelSpeech(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
