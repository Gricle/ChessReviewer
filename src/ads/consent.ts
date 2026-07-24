/**
 * Lightweight consent layer with Google Consent Mode v2 signaling.
 *
 * Consent defaults to DENIED for all ad/analytics storage until the visitor
 * makes a choice, which is the safe global default (and required in the EEA/UK).
 * Ads only load after an explicit "accept".
 *
 * NOTE: For personalized-ads monetization of EEA/UK traffic, AdSense also
 * requires a Google-certified CMP. The simplest compliant path is to enable
 * "Privacy & messaging" in your AdSense account, which injects a certified
 * IAB-TCF banner. This module handles Consent Mode signaling and gates loading;
 * point Google's certified CMP at the same `grantConsent`/`denyConsent` calls,
 * or let it manage consent and keep this as the non-EEA fallback.
 */

export type ConsentState = 'granted' | 'denied' | 'unset';

const STORAGE_KEY = 'chessreviewer.consent';
const listeners = new Set<(state: ConsentState) => void>();

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked — treat as session-only */
  }
}

/** Current stored consent decision. `unset` means the banner should show. */
export function getConsent(): ConsentState {
  const v = safeGet(STORAGE_KEY);
  return v === 'granted' || v === 'denied' ? v : 'unset';
}

export function subscribeConsent(fn: (state: ConsentState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(state: ConsentState): void {
  for (const fn of listeners) fn(state);
}

// ---- Google Consent Mode v2 -------------------------------------------------

function gtag(...args: unknown[]): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

/** Set the Consent Mode v2 defaults (all denied). Call once, as early as possible. */
export function initConsentDefaults(): void {
  const consented = getConsent() === 'granted';
  const value = consented ? 'granted' : 'denied';
  gtag('consent', 'default', {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
    wait_for_update: 500,
  });
}

function updateConsentMode(granted: boolean): void {
  const value = granted ? 'granted' : 'denied';
  gtag('consent', 'update', {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  });
}

export function grantConsent(): void {
  safeSet(STORAGE_KEY, 'granted');
  updateConsentMode(true);
  emit('granted');
}

export function denyConsent(): void {
  safeSet(STORAGE_KEY, 'denied');
  updateConsentMode(false);
  emit('denied');
}

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}
