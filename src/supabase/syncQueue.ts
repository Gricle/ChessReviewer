// localStorage-backed queue of pending review uploads. Write-behind sync:
// the review UI never waits on the network; failed uploads stay queued and
// are retried on the next flush (login, next review, or app start).
import type { ReviewUpload } from './mapReview';

export const QUEUE_KEY = 'chessreviewer.pendingUploads';

export interface QueuedUpload {
  id: string;
  payload: ReviewUpload;
}

export function loadQueue(storage: Storage): QueuedUpload[] {
  try {
    const raw = storage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (q): q is QueuedUpload =>
        !!q && typeof q.id === 'string' && typeof q.payload === 'object' && q.payload !== null,
    );
  } catch {
    return [];
  }
}

function saveQueue(storage: Storage, queue: QueuedUpload[]): void {
  storage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(storage: Storage, payload: ReviewUpload, id: string): void {
  const queue = loadQueue(storage).filter((q) => q.id !== id);
  queue.push({ id, payload });
  try {
    saveQueue(storage, queue);
  } catch {
    // Storage full (payloads are ~100-300KB each). Best-effort: drop the
    // oldest pending upload to make room; if even that fails, skip queueing —
    // sync is a background nicety, never worth crashing the review UI.
    try {
      saveQueue(storage, queue.slice(1));
    } catch {
      /* give up silently */
    }
  }
}

// djb2 — stable, dependency-free string hash for building queue ids.
// Deterministic ids let React StrictMode's double effect invocation replace
// instead of duplicate, while still keying distinct games separately.
export function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

// Attempts every queued upload once; keeps failures. Returns how many remain.
export async function flushQueue(
  storage: Storage,
  upload: (payload: ReviewUpload, id: string) => Promise<void>,
): Promise<number> {
  const queue = loadQueue(storage);
  const failed: QueuedUpload[] = [];
  for (const item of queue) {
    try {
      await upload(item.payload, item.id);
    } catch {
      failed.push(item);
    }
  }
  saveQueue(storage, failed);
  return failed.length;
}
