import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en/index.ts';

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

export const NAMESPACES = ['shell', 'import', 'review', 'coach', 'library'] as const;

const STORAGE_KEY = 'chessreviewer.lang';

/**
 * Locale registry. Translation agent: to add a locale, create
 * `./locales/<code>/` (mirroring `./locales/en/`) and add one entry here,
 * e.g. `const RESOURCES = { en, fa } as const;` — nothing else in this file
 * needs to change.
 */
const RESOURCES = { en } as const;

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

function initialLanguage(): string {
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
}

export default i18n;
