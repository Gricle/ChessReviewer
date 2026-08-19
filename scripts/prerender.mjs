// Emits one static HTML page per language after `vite build`.
//
// Why: the app is a single-page bundle, so every language used to share one
// index.html whose canonical pointed at the English URL. Google discards an
// hreflang cluster whose members canonicalise elsewhere, and the crawlers
// robots.txt invites (GPTBot, ClaudeBot, PerplexityBot) plus Bing's fallback
// path run little or no JavaScript — they saw the same English page ten times.
//
// Each generated page carries its own translated title, description, canonical
// (self-referencing), Open Graph tags, JSON-LD, and landing copy. English keeps
// the bare base URL; the rest live at <base>/<code>/.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { LANGS, langMeta, headTags, shellHtml, noscriptHtml, titleFor, esc } from './seoShared.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const REGIONS = ['head', 'shell', 'noscript'];

const template = readFileSync(join(dist, 'index.html'), 'utf8');

// This script rewrites dist/index.html in place, and its output carries no
// markers. Running it twice would therefore find nothing to replace and emit
// pages that look translated (title, lang) but keep the English head and the
// English canonical — the exact bug prerendering exists to fix, and one that
// no later check would catch. Refuse a template that vite has not just built.
for (const name of REGIONS) {
  if (!marker(name).test(template)) {
    throw new Error(`[prerender] no <!--seo:${name}--> region in dist/index.html — run \`vite build\` first`);
  }
}

/**
 * Rebuilds the built index.html for one language. Vite's asset tags are left
 * untouched; only the marked regions and the <html>/<title> values change, so
 * the ten pages share one hashed bundle.
 */
function pageFor(code) {
  const { dir } = langMeta(code);
  return template
    .replace(/<html[^>]*>/, `<html lang="${code}" dir="${dir}">`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(titleFor(code))}</title>`)
    .replace(marker('head'), headTags(code))
    .replace(marker('shell'), shellHtml(code))
    .replace(marker('noscript'), noscriptHtml(code));
}

/**
 * Matches the generated region for `name`, whether it still holds the raw
 * `<!--seo:name-->` marker (dev template) or the English content the vite
 * plugin already wrapped in `<!--seo:name:start/end-->`.
 */
function marker(name) {
  return new RegExp(
    `<!--seo:${name}-->|<!--seo:${name}:start-->[\\s\\S]*?<!--seo:${name}:end-->`,
  );
}

for (const { code } of LANGS) {
  const html = pageFor(code);
  if (html.includes('<!--seo:')) {
    throw new Error(`[prerender] ${code}: seo markers survived — index.html template changed?`);
  }
  const outDir = code === 'en' ? dist : join(dist, code);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);
}

console.log(`[prerender] wrote ${LANGS.length} static pages: ${LANGS.map((l) => l.code).join(', ')}`);
