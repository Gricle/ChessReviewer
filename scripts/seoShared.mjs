// Single source for every SEO artifact: the head tags injected into
// index.html, the static crawlable shell, the per-language pages emitted by
// scripts/prerender.mjs, and the sitemap written by scripts/genSeo.mjs.
//
// Structural values come from site.config.json; all human-readable copy comes
// from the same src/i18n/locales/<code>/*.json files the running app uses, so
// a prerendered page can never drift from what React renders.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const site = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));

export const ORIGIN = site.origin.replace(/\/$/, '');
export const BASE = site.basePath.endsWith('/') ? site.basePath : `${site.basePath}/`;
export const SITE_URL = `${ORIGIN}${BASE}`;
export const LANGS = site.languages;

/** Absolute URL for a path relative to the deploy base. */
export const abs = (p) => `${SITE_URL}${p.replace(/^\//, '')}`;

/**
 * Canonical URL for a language. English keeps the bare base URL (it holds the
 * existing crawl equity); every other language gets its own directory, e.g.
 * `/ChessReviewer/es/`. Directories, not `?lng=`, because a query parameter
 * cannot carry its own static HTML and therefore cannot self-canonicalise.
 */
export function canonicalForLang(code) {
  return code === 'en' ? SITE_URL : `${SITE_URL}${code}/`;
}

const localeCache = new Map();

/** Loads one namespace of one locale, e.g. loadNs('es', 'seo'). */
export function loadNs(code, ns) {
  const key = `${code}/${ns}`;
  if (!localeCache.has(key)) {
    const file = join(root, 'src/i18n/locales', code, `${ns}.json`);
    localeCache.set(key, JSON.parse(readFileSync(file, 'utf8')));
  }
  return localeCache.get(key);
}

export function langMeta(code) {
  return LANGS.find((l) => l.code === code) ?? LANGS[0];
}

// ---- text helpers -----------------------------------------------------------

export const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Escapes text, then re-opens the `<0>`/`<1>` slots react-i18next <Trans> uses. */
function rich(text, tags) {
  let out = esc(text);
  tags.forEach((tag, i) => {
    out = out.split(`&lt;${i}&gt;`).join(tag[0]).split(`&lt;/${i}&gt;`).join(tag[1]);
  });
  return out;
}

/** Drops `<0>`-style slots for contexts that must be plain text. */
export const plain = (text) => String(text).replace(/<\/?\d+>/g, '');

// ---- structured data --------------------------------------------------------

function jsonLd(code) {
  const seo = loadNs(code, 'seo');
  const canonical = canonicalForLang(code);
  const { hreflang } = langMeta(code);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${canonical}#app`,
        name: site.name,
        alternateName: site.tagline,
        url: canonical,
        description: seo.meta.description,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any (modern web browser)',
        browserRequirements: 'Requires JavaScript and WebAssembly',
        inLanguage: hreflang,
        image: abs(site.ogImage),
        screenshot: abs(site.ogImage),
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: Object.values(seo.landing.features).map((f) => f.title),
        author: { '@id': `${SITE_URL}#org` },
        publisher: { '@id': `${SITE_URL}#org` },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}#org`,
        name: site.name,
        url: SITE_URL,
        logo: abs('favicon.svg'),
      },
      {
        '@type': 'WebSite',
        '@id': `${canonical}#website`,
        url: canonical,
        name: site.name,
        description: seo.meta.description,
        inLanguage: hreflang,
        publisher: { '@id': `${SITE_URL}#org` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonical}#faq`,
        inLanguage: hreflang,
        mainEntity: Object.values(seo.landing.faq).map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
}

// ---- head -------------------------------------------------------------------

/**
 * The full hreflang cluster, identical on every page and always paired with a
 * self-referencing canonical. Google discards a cluster where either half
 * disagrees, which is exactly what the old `?lng=` pages did.
 */
export function alternates(indent = '    ') {
  const links = [
    ...LANGS.map(
      (l) => `<link rel="alternate" hreflang="${l.hreflang}" href="${canonicalForLang(l.code)}" />`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${SITE_URL}" />`,
  ];
  return links.join(`\n${indent}`);
}

export const titleFor = (code) => loadNs(code, 'seo').meta.title;

export function headTags(code) {
  const seo = loadNs(code, 'seo');
  const canonical = canonicalForLang(code);
  const { title, description } = seo.meta;
  const ogImage = abs(site.ogImage);
  const ogAlt = `${site.name} — ${site.tagline}`;

  const verify = [
    site.verification?.google &&
      `<meta name="google-site-verification" content="${esc(site.verification.google)}" />`,
    site.verification?.bing && `<meta name="msvalidate.01" content="${esc(site.verification.bing)}" />`,
  ].filter(Boolean);

  const ogAlternates = LANGS.filter((l) => l.code !== code).map(
    (l) => `<meta property="og:locale:alternate" content="${l.ogLocale}" />`,
  );

  return [
    ...verify,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta name="author" content="${esc(site.author)}" />`,
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />',
    `<meta name="theme-color" content="${site.themeColor}" />`,
    `<meta name="application-name" content="${esc(site.name)}" />`,
    `<meta name="apple-mobile-web-app-title" content="${esc(site.shortName)}" />`,
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
    `<link rel="canonical" href="${canonical}" />`,
    `<link rel="manifest" href="${BASE}site.webmanifest" />`,
    `<link rel="apple-touch-icon" href="${BASE}favicon.svg" />`,
    '',
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${esc(site.name)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${ogImage}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${esc(ogAlt)}" />`,
    `<meta property="og:locale" content="${langMeta(code).ogLocale}" />`,
    ...ogAlternates,
    '',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${ogImage}" />`,
    `<meta name="twitter:image:alt" content="${esc(ogAlt)}" />`,
    `<meta name="twitter:site" content="${esc(site.twitter)}" />`,
    '',
    alternates(),
    '',
    `<script type="application/ld+json">${JSON.stringify(jsonLd(code))}</script>`,
  ].join('\n    ');
}

// ---- body -------------------------------------------------------------------

const S = {
  hero: "min-height:100vh;background:#05040c;color:#e2e8f0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2rem;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif",
  h1: 'font-size:clamp(1.75rem,5vw,3rem);font-weight:800;line-height:1.15;margin:0 0 1rem;max-width:24ch',
  lead: 'color:#94a3b8;max-width:60ch;font-size:1.05rem;line-height:1.6;margin:0',
  badge: 'color:#38e1d6;font-family:monospace;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;margin:0 0 1rem',
};

/**
 * First-paint shell rendered inside #root. It mirrors the hero React actually
 * renders (same i18n keys as ImportSection), so a crawler that never runs JS
 * and one that does see the same heading and lead paragraph.
 */
export function shellHtml(code) {
  const hero = loadNs(code, 'import').hero;
  const title = rich(hero.title, [['<span style="color:#5eead4">', '</span>']]);
  const description = rich(hero.description, [
    ['<strong style="color:#67e8f9">', '</strong>'],
    ['<strong style="color:#fb7185">', '</strong>'],
  ]);

  return [
    `<main style="${S.hero}">`,
    `  <p style="${S.badge}">${esc(hero.badge)}</p>`,
    `  <h1 style="${S.h1}">${title}</h1>`,
    `  <p style="${S.lead}">${description}</p>`,
    '</main>',
  ].join('\n      ');
}

/**
 * The landing copy (features, steps, comparison, FAQ) for crawlers that do not
 * execute JavaScript — Bing's fallback path and the AI crawlers robots.txt
 * invites in. Word for word the same strings SeoContent renders, so this is a
 * no-JS fallback rather than separate content served only to bots.
 */
export function noscriptHtml(code) {
  const { landing } = loadNs(code, 'seo');
  const wrap =
    'max-width:52rem;margin:0 auto;padding:2rem;color:#e2e8f0;background:#05040c;font-family:system-ui,sans-serif;line-height:1.6';

  const pairs = (items, k1, k2) => [
    '  <dl>',
    ...items.flatMap((it) => [`    <dt><strong>${esc(it[k1])}</strong></dt>`, `    <dd>${esc(it[k2])}</dd>`]),
    '  </dl>',
  ];

  return [
    `<div style="${wrap}">`,
    `  <p><strong>${esc(landing.noscript)}</strong></p>`,
    `  <h2>${esc(landing.featuresHeading)}</h2>`,
    `  <p>${esc(landing.featuresSub)}</p>`,
    ...pairs(Object.values(landing.features), 'title', 'body'),
    `  <h2>${esc(landing.howHeading)}</h2>`,
    `  <p>${esc(landing.howSub)}</p>`,
    ...pairs(Object.values(landing.how), 'title', 'body'),
    `  <h2>${esc(landing.compareHeading)}</h2>`,
    `  <p>${esc(landing.compareBody)}</p>`,
    `  <h2>${esc(landing.faqHeading)}</h2>`,
    ...pairs(Object.values(landing.faq), 'q', 'a'),
    '</div>',
  ].join('\n      ');
}
