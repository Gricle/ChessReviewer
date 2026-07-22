import { describe, expect, it } from 'vitest';
import { pickBestVoice, scoreVoice } from './speech';

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
