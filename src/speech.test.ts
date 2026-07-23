import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickBestVoice, scoreVoice, speak } from './speech';
import { setVolume } from './sound';

function voice(name: string, lang: string, localService = true): SpeechSynthesisVoice {
  return { name, lang, localService, default: false, voiceURI: name } as SpeechSynthesisVoice;
}

// Realistic voice inventories from actual browsers.
const legacyDavid = voice('Microsoft David - English (United States)', 'en-US');
const edgeNeural = voice('Microsoft Andrew Online (Natural) - English (United States)', 'en-US', false);
const chromeGoogle = voice('Google US English', 'en-US', false);
const macEnhanced = voice('Ava (Enhanced)', 'en-US');
const frNeural = voice('Microsoft Vivienne Online (Natural) - French (France)', 'fr-FR', false);

describe('scoreVoice', () => {
  it('rejects voices in the wrong language', () => {
    expect(scoreVoice(frNeural, 'en')).toBe(-1);
    expect(scoreVoice(edgeNeural, 'fa')).toBe(-1);
  });

  it('ranks neural voices above legacy SAPI voices', () => {
    expect(scoreVoice(edgeNeural, 'en')).toBeGreaterThan(scoreVoice(legacyDavid, 'en'));
    expect(scoreVoice(chromeGoogle, 'en')).toBeGreaterThan(scoreVoice(legacyDavid, 'en'));
    expect(scoreVoice(macEnhanced, 'en')).toBeGreaterThan(scoreVoice(legacyDavid, 'en'));
  });
});

describe('pickBestVoice', () => {
  it('picks the Edge neural voice over legacy and network voices', () => {
    expect(pickBestVoice([legacyDavid, chromeGoogle, edgeNeural], 'en')).toBe(edgeNeural);
  });

  it('picks the Google network voice when no neural voice exists', () => {
    expect(pickBestVoice([legacyDavid, chromeGoogle], 'en')).toBe(chromeGoogle);
  });

  it('falls back to a legacy voice rather than none when it matches the language', () => {
    expect(pickBestVoice([legacyDavid, frNeural], 'en')).toBe(legacyDavid);
  });

  it('matches the active language, not English, when the UI is localized', () => {
    expect(pickBestVoice([legacyDavid, edgeNeural, frNeural], 'fr')).toBe(frNeural);
  });

  it('returns null when no voice matches the language at all', () => {
    expect(pickBestVoice([legacyDavid, edgeNeural], 'fa')).toBeNull();
  });
});

describe('speak', () => {
  const spoken: SpeechSynthesisUtterance[] = [];

  function stubSpeechSynthesis(): void {
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      text: string;
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;
      constructor(text: string) { this.text = text; }
    });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak: (u: SpeechSynthesisUtterance) => spoken.push(u),
        getVoices: () => [],
        addEventListener: vi.fn(),
      },
    });
  }

  afterEach(() => {
    spoken.length = 0;
    setVolume(1);
    vi.unstubAllGlobals();
  });

  it('scales utterance volume with the master volume bar', () => {
    stubSpeechSynthesis();
    setVolume(0.3);
    speak('nice move');
    expect(spoken).toHaveLength(1);
    expect(spoken[0].volume).toBeCloseTo(0.3 * 0.85);
  });

  it('is silent when the volume bar is at zero', () => {
    stubSpeechSynthesis();
    setVolume(0);
    speak('nice move');
    expect(spoken[0].volume).toBe(0);
  });
});
