import { describe, it, expect } from 'vitest';
import { sanToSound } from './sound';

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
