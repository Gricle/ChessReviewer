import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { BASE_PATH } from '../config/site';
import { en } from './locales/en/index.ts';
import { zh } from './locales/zh/index.ts';
import { hi } from './locales/hi/index.ts';
import { es } from './locales/es/index.ts';
import { fr } from './locales/fr/index.ts';
import { ar } from './locales/ar/index.ts';
import { ru } from './locales/ru/index.ts';
import { pt } from './locales/pt/index.ts';
import { de } from './locales/de/index.ts';
import { fa } from './locales/fa/index.ts';

export interface Language {
  code: string;
  native: string;
  dir: 'ltr' | 'rtl';
}

/** The 10 supported languages. `native` is the language's own name; `dir` its text direction. */
export const LANGUAGES: readonly Language[] = [
  { code: 'en', native: 'English', dir: 'ltr' },
  { code: 'zh', native: '中文', dir: 'ltr' },
  { code: 'hi', native: 'हिन्दी', dir: 'ltr' },
  { code: 'es', native: 'Español', dir: 'ltr' },
  { code: 'fr', native: 'Français', dir: 'ltr' },
  { code: 'ar', native: 'العربية', dir: 'rtl' },
  { code: 'ru', native: 'Русский', dir: 'ltr' },
  { code: 'pt', native: 'Português', dir: 'ltr' },
  { code: 'de', native: 'Deutsch', dir: 'ltr' },
  { code: 'fa', native: 'فارسی', dir: 'rtl' },
];

export const NAMESPACES = ['shell', 'import', 'review', 'coach', 'library', 'seo'] as const;

const STORAGE_KEY = 'chessreviewer.lang';

/**
 * Locale registry. Translation agent: to add a locale, create
 * `./locales/<code>/` (mirroring `./locales/en/`) and add one entry here,
 * e.g. `const RESOURCES = { en, fa } as const;` — nothing else in this file
 * needs to change.
 */
const RESOURCES = { en, zh, hi, es, fr, ar, ru, pt, de, fa } as const;

// Storage access never crashes the app (mirrors safeStorageGet in src/App.tsx).
function safeStorageGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeStorageSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

function findLanguage(code: string): Language | undefined {
  return LANGUAGES.find((lang) => lang.code === code);
}

/**
 * Language taken from the URL path, e.g. `/ChessReviewer/es/`. These are the
 * canonical, crawlable addresses: `scripts/prerender.mjs` writes a real static
 * page for each one, so a hard refresh and a crawler both get translated HTML.
 */
function pathLanguage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const { pathname } = window.location;
    if (!pathname.startsWith(BASE_PATH)) return null;
    const code = pathname.slice(BASE_PATH.length).split('/')[0];
    return code && findLanguage(code) ? code : null;
  } catch {
    return null;
  }
}

/** Legacy `?lng=` links, kept working so already-shared URLs still resolve. */
function queryLanguage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const code = new URLSearchParams(window.location.search).get('lng');
    return code && findLanguage(code) ? code : null;
  } catch {
    return null;
  }
}

/**
 * Reflect the active language in the URL path so each language has a stable,
 * shareable address that matches its `hreflang` alternate and its canonical.
 * English is the bare base URL. Any legacy `?lng=` param is dropped, which
 * migrates old links onto the canonical path form.
 */
function applyUrlLang(code: string): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    if (!url.pathname.startsWith(BASE_PATH)) return;
    const rest = url.pathname.slice(BASE_PATH.length).split('/');
    if (findLanguage(rest[0])) rest.shift();
    const tail = rest.join('/');
    url.pathname = code === 'en' ? `${BASE_PATH}${tail}` : `${BASE_PATH}${code}/${tail}`;
    url.searchParams.delete('lng');
    window.history.replaceState(null, '', url.toString());
  } catch {
    /* history/URL unavailable — non-fatal */
  }
}

// Path wins (canonical URLs), then legacy ?lng=, then stored preference, then English.
function initialLanguage(): string {
  const fromUrl = pathLanguage() ?? queryLanguage();
  if (fromUrl) return fromUrl;
  const stored = safeStorageGet(STORAGE_KEY);
  return stored && findLanguage(stored) ? stored : 'en';
}

function applyDocumentLangDir(code: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = code;
  document.documentElement.dir = findLanguage(code)?.dir ?? 'ltr';
}

// Idempotent: tests import this module from a setup file and again transitively.
if (!i18n.isInitialized) {
  const lng = initialLanguage();
  void i18n.use(initReactI18next).init({
    resources: RESOURCES,
    lng,
    fallbackLng: 'en',
    ns: [...NAMESPACES],
    defaultNS: 'shell',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnNull: false,
  });
  applyDocumentLangDir(lng);
  applyUrlLang(lng);
}

/**
 * Switch the UI language. Owns persistence and `<html lang>`/`<html dir>` —
 * always call this instead of `i18n.changeLanguage` directly.
 */
export function setLanguage(code: string): void {
  if (!findLanguage(code)) return;
  void i18n.changeLanguage(code);
  safeStorageSet(STORAGE_KEY, code);
  applyDocumentLangDir(code);
  applyUrlLang(code);
}

export default i18n;
