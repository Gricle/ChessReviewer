import { describe, it, expect } from 'vitest';
import { sanToSound } from './sound';

describe('sanToSound', () => {
  it('plays the move sound for a quiet move', () => {
    expect(sanToSound('Nf3')).toBe('move');
    expect(sanToSound('O-O')).toBe('move');
  });
  it('plays the capture sound when the move captures', () => {
    expect(sanToSound('exd5')).toBe('capture');
    expect(sanToSound('Nxe4')).toBe('capture');
  });
  it('plays the check sound on a checking move', () => {
    expect(sanToSound('Qh5+')).toBe('check');
  });
  it('plays the checkmate sound on mate', () => {
    expect(sanToSound('Qxf7#')).toBe('checkmate');
  });
  it('prioritizes mate over capture and check', () => {
    expect(sanToSound('Rxe8#')).toBe('checkmate');
  });
});
