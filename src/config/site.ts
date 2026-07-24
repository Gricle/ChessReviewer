import config from '../../site.config.json';

/**
 * Single source of truth for public site metadata (SEO, social cards, sitemap,
 * PWA manifest, ads). The raw values live in `site.config.json` at the repo
 * root so Node build scripts (e.g. `scripts/genSitemap.mjs`) and the app share
 * exactly the same data.
 *
 * When the custom domain lands, change `origin` (and `basePath` to `"/"`) in
 * `site.config.json` — nothing else needs to move.
 */

export interface SiteLanguage {
  /** i18n code used by the app (e.g. `fr`). */
  code: string;
  /** BCP-47 tag emitted in `hreflang` links (e.g. `zh-Hans`). */
  hreflang: string;
  dir: 'ltr' | 'rtl';
}

const origin = config.origin.replace(/\/$/, '');
/** Always starts and ends with `/` (e.g. `/ChessReviewer/` or `/`). */
const basePath = ensureSlashes(config.basePath);

/** Canonical origin, no trailing slash (e.g. `https://gricle.github.io`). */
export const SITE_ORIGIN = origin;
/** Deploy sub-path, leading + trailing slash. */
export const BASE_PATH = basePath;
/** Canonical home URL (origin + base), with trailing slash. */
export const SITE_URL = `${origin}${basePath}`;

export const SITE_NAME = config.name;
export const SITE_SHORT_NAME = config.shortName;
export const SITE_TAGLINE = config.tagline;
export const SITE_DESCRIPTION = config.description;
export const SITE_SHORT_DESCRIPTION = config.shortDescription;
export const SITE_KEYWORDS = config.keywords;
export const SITE_AUTHOR = config.author;
export const TWITTER_HANDLE = config.twitter;
export const THEME_COLOR = config.themeColor;
export const SITE_LANGUAGES = config.languages as readonly SiteLanguage[];

/** Absolute URL to the social share image (1200×630). */
export const OG_IMAGE_URL = absolute(config.ogImage);

/** Absolute canonical URL for a given UI language. English is the bare home URL. */
export function canonicalForLang(code: string): string {
  if (code === 'en') return SITE_URL;
  return `${SITE_URL}?lng=${encodeURIComponent(code)}`;
}

/** Resolve a path relative to the deploy base into an absolute URL. */
export function absolute(path: string): string {
  const clean = path.replace(/^\//, '');
  return `${origin}${basePath}${clean}`;
}

function ensureSlashes(p: string): string {
  let out = p.startsWith('/') ? p : `/${p}`;
  if (!out.endsWith('/')) out += '/';
  return out;
}
