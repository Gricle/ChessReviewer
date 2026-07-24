/**
 * Google AdSense integration — dormant until a real publisher ID is supplied.
 *
 * Activation is a two-value change, no code edits:
 *   1. Set VITE_ADSENSE_CLIENT="ca-pub-XXXXXXXXXXXXXXXX" (your publisher ID).
 *   2. Fill the real slot IDs in AD_SLOTS below (from the AdSense dashboard).
 *
 * The AdSense script is only ever injected AFTER the visitor grants consent
 * (see ./consent.ts), so with no ID or no consent nothing loads.
 */

const RAW_CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined)?.trim() ?? '';

/** True when a non-placeholder publisher ID is configured. */
export const ADS_CONFIGURED =
  /^ca-pub-\d{10,}$/.test(RAW_CLIENT) && !/0000000000000000/.test(RAW_CLIENT);

/** The `ca-pub-…` client id, or empty string when unconfigured. */
export const ADSENSE_CLIENT = ADS_CONFIGURED ? RAW_CLIENT : '';

/**
 * Named ad placements. Replace each `slot` with the numeric slot ID from your
 * AdSense dashboard once your account is approved. Until then they are inert.
 */
export const AD_SLOTS = {
  /** Below the import cards on the landing page. */
  landing: { slot: '0000000000', format: 'auto' as const },
  /** Under the review summary, after a game is analyzed. */
  review: { slot: '0000000000', format: 'auto' as const },
} satisfies Record<string, { slot: string; format: 'auto' | 'fluid' }>;

export type AdPlacement = keyof typeof AD_SLOTS;

const SCRIPT_ID = 'adsbygoogle-js';
let scriptRequested = false;

/**
 * Inject the AdSense loader script exactly once. Safe to call repeatedly.
 * Caller is responsible for having confirmed consent first.
 */
export function loadAdSense(): void {
  if (!ADS_CONFIGURED || scriptRequested || typeof document === 'undefined') return;
  if (document.getElementById(SCRIPT_ID)) {
    scriptRequested = true;
    return;
  }
  scriptRequested = true;
  const s = document.createElement('script');
  s.id = SCRIPT_ID;
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(s);
}

/** Register a rendered `<ins>` slot with AdSense. */
export function pushAd(): void {
  if (!ADS_CONFIGURED || typeof window === 'undefined') return;
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch {
    /* AdSense not ready / blocked — non-fatal */
  }
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}
