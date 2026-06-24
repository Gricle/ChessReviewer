import { describe, it, expect } from 'vitest';
import { classify, type ClassifyInput } from './classifier';

const base: ClassifyInput = {
  isBook: false,
  playedUci: 'g1f3',
  bestUci: 'g1f3',
  evalBeforeCp: 30,
  evalAfterCp: 30,
  secondBestEvalCp: 20,
  materialSacrificed: 0,
};

describe('classify', () => {
  it('labels opening-book moves', () => {
    expect(classify({ ...base, isBook: true })).toBe('book');
  });

  it('labels the engine move as best when nothing special applies', () => {
    expect(classify(base)).toBe('best');
  });

  it('labels increasing win% drops as inaccuracy/mistake/blunder', () => {
    // A non-best move from an equal position. Win% drop grows with the eval swing.
    const played = { ...base, playedUci: 'a2a3', evalBeforeCp: 0 };
    expect(classify({ ...played, evalAfterCp: -150 })).toBe('inaccuracy'); // ~13% drop
    expect(classify({ ...played, evalAfterCp: -250 })).toBe('mistake');    // ~22% drop
    expect(classify({ ...played, evalAfterCp: -500 })).toBe('blunder');    // ~36% drop
  });

  it('labels a far-and-away only move as great', () => {
    expect(classify({
      ...base, evalBeforeCp: 50, evalAfterCp: 50, secondBestEvalCp: -200,
    })).toBe('great');
  });

  it('labels a winning material sacrifice as brilliant', () => {
    expect(classify({
      ...base, evalBeforeCp: 200, evalAfterCp: 200, materialSacrificed: 3,
    })).toBe('brilliant');
  });
});
