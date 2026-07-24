// Generates the static SEO artifacts (robots.txt, sitemap.xml, site.webmanifest,
// ads.txt) into public/ from the single source of truth in site.config.json.
// Run automatically before every build (see package.json "prebuild"), so a
// domain change in site.config.json propagates everywhere with no hand edits.
//
// NOTE on GitHub Pages project sites: robots.txt / ads.txt are only honored at
// the domain ROOT (e.g. https://host/robots.txt), not under /ChessReviewer/.
// These files become canonical automatically once a custom domain moves the
// deploy to basePath "/". Until then, submit the sitemap URL directly in Google
// Search Console.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicDir = join(root, 'public');
mkdirSync(publicDir, { recursive: true });

const site = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));
const origin = site.origin.replace(/\/$/, '');
const base = site.basePath.endsWith('/') ? site.basePath : `${site.basePath}/`;
const siteUrl = `${origin}${base}`;
const abs = (p) => `${origin}${base}${p.replace(/^\//, '')}`;
const canonicalFor = (code) => (code === 'en' ? siteUrl : `${siteUrl}?lng=${code}`);

// A recent, stable date. Kept out of the running app (Date.now is fine in a
// build script, but a committed constant keeps output deterministic in CI).
const lastmod = new Date().toISOString().slice(0, 10);

// ---- sitemap.xml (with hreflang alternates per language) --------------------
const alternates = [
  ...site.languages.map(
    (l) => `      <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${canonicalFor(l.code)}"/>`,
  ),
  `      <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}"/>`,
].join('\n');

const urlEntries = site.languages
  .map(
    (l) => `  <url>
    <loc>${canonicalFor(l.code)}</loc>
${alternates}
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${l.code === 'en' ? '1.0' : '0.8'}</priority>
  </url>`,
  )
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries}
</urlset>
`;
writeFileSync(join(publicDir, 'sitemap.xml'), sitemap);

// ---- robots.txt -------------------------------------------------------------
const robots = `# ${site.name} — ${site.tagline}
User-agent: *
Allow: /

# AI crawlers are welcome to read the public content
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /

Sitemap: ${abs('sitemap.xml')}
`;
writeFileSync(join(publicDir, 'robots.txt'), robots);

// ---- site.webmanifest (PWA) -------------------------------------------------
const manifest = {
  name: `${site.name} — ${site.tagline}`,
  short_name: site.shortName,
  description: site.shortDescription,
  start_url: base,
  scope: base,
  display: 'standalone',
  orientation: 'any',
  background_color: site.themeColor,
  theme_color: site.themeColor,
  categories: ['games', 'education', 'sports'],
  lang: 'en',
  dir: 'ltr',
  icons: [
    { src: `${base}favicon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: `${base}icon-maskable.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
  ],
};
writeFileSync(join(publicDir, 'site.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);

// ---- ads.txt ----------------------------------------------------------------
// AdSense reads ads.txt at the domain root. VITE_ADSENSE_CLIENT is "ca-pub-…";
// ads.txt wants the bare "pub-…" form. Falls back to a clearly-marked
// placeholder so the file is present and ready the moment a publisher ID lands.
const client = (process.env.VITE_ADSENSE_CLIENT || '').trim();
const pub = client.replace(/^ca-/, '') || 'pub-0000000000000000';
const isPlaceholder = pub === 'pub-0000000000000000';
const adsTxt = `${isPlaceholder ? '# PLACEHOLDER — replace with your AdSense publisher ID before going live.\n' : ''}google.com, ${pub}, DIRECT, f08c47fec0942fa0
`;
writeFileSync(join(publicDir, 'ads.txt'), adsTxt);

console.log(`[genSeo] wrote sitemap.xml, robots.txt, site.webmanifest, ads.txt for ${siteUrl}`);
