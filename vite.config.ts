import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import site from './site.config.json' with { type: 'json' }
import { headTags, shellHtml, noscriptHtml, titleFor } from './scripts/seoShared.mjs'

/**
 * Fills the `<!--seo:*-->` markers in index.html with the English head tags and
 * static landing content. Every value comes from scripts/seoShared.mjs, which
 * scripts/prerender.mjs re-runs after the build to emit the other nine
 * languages — so the head, the shell and the sitemap can never disagree.
 *
 * The generated regions are wrapped in start/end comments so the prerenderer
 * can find and swap them in the built file.
 */
function seoHtml(): Plugin {
  const region = (name: string, body: string) =>
    `<!--seo:${name}:start-->${body}<!--seo:${name}:end-->`

  return {
    name: 'chess-reviewer-seo-html',
    transformIndexHtml(html) {
      return html
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${titleFor('en')}</title>`)
        .replace('<!--seo:head-->', region('head', headTags('en')))
        .replace('<!--seo:shell-->', region('shell', shellHtml('en')))
        .replace('<!--seo:noscript-->', region('noscript', noscriptHtml('en')))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: site.basePath,
  plugins: [react(), tailwindcss(), seoHtml()],
})
