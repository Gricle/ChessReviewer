import { describe, it, expect, beforeEach } from 'vitest';
import { loadQueue, enqueue, flushQueue, hashString, QUEUE_KEY } from './syncQueue';
import type { ReviewUpload } from './mapReview';

// Minimal fake payload — the queue never inspects its contents.
const payload = { game: { pgn: 'x' } } as unknown as ReviewUpload;

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() { return map.size; },
  } as Storage;
}

let storage: Storage;
beforeEach(() => { storage = makeStorage(); });

describe('syncQueue', () => {
  it('starts empty', () => {
    expect(loadQueue(storage)).toEqual([]);
  });

  it('enqueue persists and loadQueue round-trips', () => {
    enqueue(storage, payload, 'id-1');
    enqueue(storage, payload, 'id-2');
    expect(loadQueue(storage).map((q) => q.id)).toEqual(['id-1', 'id-2']);
  });

  it('enqueue with a duplicate id replaces instead of duplicating', () => {
    enqueue(storage, payload, 'id-1');
    enqueue(storage, payload, 'id-1');
    expect(loadQueue(storage)).toHaveLength(1);
  });

  it('recovers from corrupt storage', () => {
    storage.setItem(QUEUE_KEY, '{not json');
    expect(loadQueue(storage)).toEqual([]);
  });

  it('flushQueue removes succeeded items and returns 0 remaining', async () => {
    enqueue(storage, payload, 'id-1');
    enqueue(storage, payload, 'id-2');
    const uploaded: string[] = [];
    const remaining = await flushQueue(storage, async (_p, id) => { uploaded.push(id); });
    expect(remaining).toBe(0);
    expect(uploaded).toEqual(['id-1', 'id-2']);
    expect(loadQueue(storage)).toEqual([]);
  });

  it('flushQueue keeps failed items for the next retry', async () => {
    enqueue(storage, payload, 'ok');
    enqueue(storage, payload, 'bad');
    const remaining = await flushQueue(storage, async (_p, id) => {
      if (id === 'bad') throw new Error('network down');
    });
    expect(remaining).toBe(1);
    expect(loadQueue(storage).map((q) => q.id)).toEqual(['bad']);
  });

  it('hashString is deterministic and separates different strings', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
    expect(hashString('')).toBe(hashString(''));
  });

  it('recovers from valid-JSON-but-non-array storage', () => {
    storage.setItem(QUEUE_KEY, '{}');
    expect(loadQueue(storage)).toEqual([]);
  });

  it('filters malformed items out of a stored array', () => {
    storage.setItem(QUEUE_KEY, JSON.stringify([42, { id: 'ok', payload: {} }, { id: 7, payload: {} }, null]));
    expect(loadQueue(storage).map((q) => q.id)).toEqual(['ok']);
  });

  it('drops the oldest item instead of crashing when storage is full', () => {
    enqueue(storage, payload, 'old');
    enqueue(storage, payload, 'new');
    let failNext = 1; // fail the first setItem call only
    const realSet = storage.setItem.bind(storage);
    storage.setItem = (k: string, v: string) => {
      if (failNext > 0) { failNext--; throw new DOMException('quota', 'QuotaExceededError'); }
      realSet(k, v);
    };
    expect(() => enqueue(storage, payload, 'newest')).not.toThrow();
    expect(loadQueue(storage).map((q) => q.id)).toEqual(['new', 'newest']);
  });

  it('gives up silently when storage stays full', () => {
    const realSet = storage.setItem.bind(storage);
    storage.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
    expect(() => enqueue(storage, payload, 'x')).not.toThrow();
    storage.setItem = realSet;
    expect(loadQueue(storage)).toEqual([]);
  });
});
