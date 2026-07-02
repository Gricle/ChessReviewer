import { describe, it, expect } from 'vitest';
import { sanToSound, clampVolume, loadVolume, saveVolume, classToStinger, VOLUME_KEY } from './sound';

describe('sanToSound', () => {
  it('plays the move sound for a quiet move', () => {
    expect(sanToSound('Nf3')).toBe('move');
    expect(sanToSound('O-O')).toBe('castle');
    expect(sanToSound('O-O-O')).toBe('castle');
  });
  it('plays the capture sound when the move captures', () => {
    expect(sanToSound('exd5')).toBe('capture');
    expect(sanToSound('Nxe4')).toBe('capture');
  });
  it('plays the check sound on a checking move', () => {
    expect(sanToSound('Qh5+')).toBe('check');
  });
  it('plays the promote sound on promotion', () => {
    expect(sanToSound('e8=Q')).toBe('promote');
    expect(sanToSound('exd8=N+')).toBe('check');  // check beats promote
  });
  it('plays gameEnd on checkmate', () => {
    expect(sanToSound('Qxf7#')).toBe('gameEnd');
    expect(sanToSound('Rxe8#')).toBe('gameEnd');
  });
  it('prioritizes checkmate over capture and check', () => {
    expect(sanToSound('Rxe8#')).toBe('gameEnd');
    expect(sanToSound('Qh7#')).toBe('gameEnd');
  });
});

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() { return m.size; },
  } as Storage;
}

describe('volume persistence', () => {
  it('clamps to [0,1] and defaults garbage to 1', () => {
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(-2)).toBe(0);
    expect(clampVolume(7)).toBe(1);
    expect(clampVolume(NaN)).toBe(1);
  });

  it('round-trips through storage', () => {
    const s = fakeStorage();
    saveVolume(s, 0.35);
    expect(loadVolume(s)).toBe(0.35);
  });

  it('defaults to 1 on missing or corrupt values', () => {
    const s = fakeStorage();
    expect(loadVolume(s)).toBe(1);
    s.setItem(VOLUME_KEY, 'banana');
    expect(loadVolume(s)).toBe(1);
  });
});

describe('classToStinger', () => {
  it('maps the dramatic classifications to stingers', () => {
    expect(classToStinger('brilliant')).toBe('stBrilliant');
    expect(classToStinger('great')).toBe('stGreat');
    expect(classToStinger('mistake')).toBe('stMistake');
    expect(classToStinger('blunder')).toBe('stBlunder');
  });
  it('stays silent for ordinary moves', () => {
    expect(classToStinger('best')).toBeNull();
    expect(classToStinger('excellent')).toBeNull();
    expect(classToStinger('good')).toBeNull();
    expect(classToStinger('inaccuracy')).toBeNull();
    expect(classToStinger('book')).toBeNull();
  });
});
