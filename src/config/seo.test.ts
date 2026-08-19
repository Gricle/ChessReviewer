import { describe, it, expect } from 'vitest';
// The build-time generator, imported directly so the test guards the exact
// strings that ship in dist/ rather than a re-implementation of them.
import {
  LANGS,
  canonicalForLang,
  headTags,
  shellHtml,
  noscriptHtml,
  titleFor,
  SITE_URL,
} from '../../scripts/seoShared.mjs';
import { canonicalForLang as appCanonicalForLang } from './site';

/**
 * These assertions exist because the previous setup shipped ten URLs that all
 * declared the English canonical, which makes Google drop the whole hreflang
 * cluster and index one page instead of ten. The failure was invisible: every
 * page built, rendered and passed its own tests.
 */
describe('per-language SEO output', () => {
  const codes: string[] = LANGS.map((l: { code: string }) => l.code);

  it('covers every UI language', () => {
    expect(codes).toEqual(['en', 'zh', 'hi', 'es', 'fr', 'ar', 'ru', 'pt', 'de', 'fa']);
  });

  it('gives each language a distinct canonical URL', () => {
    const urls = codes.map(canonicalForLang);
    expect(new Set(urls).size).toBe(urls.length);
    expect(canonicalForLang('en')).toBe(SITE_URL);
    expect(canonicalForLang('es')).toBe(`${SITE_URL}es/`);
  });

  it('keeps the app and the build in agreement on canonicals', () => {
    for (const code of codes) {
      expect(appCanonicalForLang(code)).toBe(canonicalForLang(code));
    }
  });

  it.each(['en', 'zh', 'es', 'ar', 'fa'])('page %s self-canonicalises', (code) => {
    const head = headTags(code);
    expect(head).toContain(`<link rel="canonical" href="${canonicalForLang(code)}" />`);
    expect(head).toContain(`<meta property="og:url" content="${canonicalForLang(code)}" />`);
  });

  it.each(['en', 'es', 'ar'])('page %s links every alternate plus x-default', (code) => {
    const head = headTags(code);
    for (const l of LANGS) {
      expect(head).toContain(`hreflang="${l.hreflang}" href="${canonicalForLang(l.code)}"`);
    }
    expect(head).toContain(`hreflang="x-default" href="${SITE_URL}"`);
  });

  it('declares exactly one og:locale per page, in language_TERRITORY form', () => {
    for (const code of codes) {
      const matches = headTags(code).match(/<meta property="og:locale" content="([^"]+)" \/>/g) ?? [];
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatch(/content="[a-z]{2}_[A-Za-z]{2,4}"/);
    }
  });

  it('translates the title and description away from English', () => {
    const enTitle = titleFor('en');
    for (const code of codes.filter((c) => c !== 'en')) {
      expect(titleFor(code)).not.toBe(enTitle);
    }
  });

  it('renders exactly one h1 in the static shell', () => {
    for (const code of codes) {
      expect(shellHtml(code).match(/<h1[ >]/g) ?? []).toHaveLength(1);
    }
  });

  it('leaves no unrendered <Trans> slots in the static markup', () => {
    for (const code of codes) {
      expect(shellHtml(code)).not.toMatch(/&lt;\/?\d+&gt;/);
      expect(noscriptHtml(code)).not.toMatch(/<\/?\d+>/);
    }
  });

  it('puts the full landing copy in the no-JS fallback', () => {
    for (const code of codes) {
      const html = noscriptHtml(code);
      // 6 features + 3 steps + 6 FAQ entries.
      expect(html.match(/<dt>/g) ?? []).toHaveLength(15);
      expect(html.match(/<h2>/g) ?? []).toHaveLength(4);
    }
  });
});
