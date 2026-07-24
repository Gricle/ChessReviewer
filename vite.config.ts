import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import site from './site.config.json' with { type: 'json' }

const ORIGIN = site.origin.replace(/\/$/, '')
const BASE = site.basePath.endsWith('/') ? site.basePath : `${site.basePath}/`
const SITE_URL = `${ORIGIN}${BASE}`
const abs = (p: string) => `${ORIGIN}${BASE}${p.replace(/^\//, '')}`
const OG_IMAGE = abs(site.ogImage)
const TITLE = `${site.tagline} — ${site.name}`

function canonicalFor(code: string): string {
  return code === 'en' ? SITE_URL : `${SITE_URL}?lng=${code}`
}

const FAQ = [
  {
    q: 'Is Chess Reviewer really free?',
    a: 'Yes. Chess Reviewer is completely free with no account required. The Stockfish engine runs entirely in your browser, so there are no analysis limits and no server costs to pass on to you.',
  },
  {
    q: 'How do I analyze my chess game?',
    a: 'Paste a PGN, or type your Chess.com or Lichess username to import your recent games. Chess Reviewer then evaluates every position with Stockfish and classifies each move from Brilliant to Blunder with an accuracy score.',
  },
  {
    q: 'Is this a free alternative to the Chess.com Game Review?',
    a: 'Yes. Chess Reviewer reproduces the Chess.com-style Game Review experience — move classifications, accuracy percentages, best-move arrows, and coaching — without a paid membership, and it works with Lichess games too.',
  },
  {
    q: 'Does my game data stay private?',
    a: 'Analysis happens locally in your browser using WebAssembly Stockfish. Your PGNs are never uploaded unless you choose to sign in and sync your library to the cloud.',
  },
  {
    q: 'What engine does it use?',
    a: 'It uses Stockfish, the strongest open-source chess engine, compiled to WebAssembly and evaluated at depth 14 with two principal variations for accurate best-move detection.',
  },
  {
    q: 'Which languages are supported?',
    a: 'The interface ships in ten languages: English, Chinese, Hindi, Spanish, French, Arabic, Russian, Portuguese, German, and Persian, including full right-to-left support.',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}#app`,
      name: site.name,
      alternateName: site.tagline,
      url: SITE_URL,
      description: site.description,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Any (modern web browser)',
      browserRequirements: 'Requires JavaScript and WebAssembly',
      inLanguage: site.languages.map((l) => l.hreflang),
      image: OG_IMAGE,
      screenshot: OG_IMAGE,
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: [
        'Stockfish move-by-move analysis in the browser',
        'Move classification from Brilliant to Blunder',
        'Accuracy percentage per player',
        'Best-move arrows and evaluation graph',
        'Opening detection (full Lichess ECO set)',
        'Natural-language coaching',
        'Import from Chess.com and Lichess',
      ],
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
      '@id': `${SITE_URL}#website`,
      url: SITE_URL,
      name: site.name,
      description: site.shortDescription,
      inLanguage: 'en',
      publisher: { '@id': `${SITE_URL}#org` },
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}#faq`,
      mainEntity: FAQ.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
}

/** Injects SEO/social/head tags generated from site.config.json. */
function seoHtml(): Plugin {
  const alternates = [
    ...site.languages.map(
      (l) => `<link rel="alternate" hreflang="${l.hreflang}" href="${canonicalFor(l.code)}" />`,
    ),
    `<link rel="alternate" hreflang="x-default" href="${SITE_URL}" />`,
  ].join('\n    ')

  const ogLocales = site.languages
    .filter((l) => l.code !== 'en')
    .map((l) => `<meta property="og:locale:alternate" content="${l.hreflang.replace('-', '_')}" />`)
    .join('\n    ')

  const verify = [
    site.verification?.google
      ? `<meta name="google-site-verification" content="${site.verification.google}" />`
      : '',
    site.verification?.bing
      ? `<meta name="msvalidate.01" content="${site.verification.bing}" />`
      : '',
  ]
    .filter(Boolean)
    .join('\n    ')

  const tags = `${verify ? `\n    ${verify}` : ''}
    <meta name="description" content="${site.description}" />
    <meta name="keywords" content="${site.keywords.join(', ')}" />
    <meta name="author" content="${site.author}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
    <meta name="theme-color" content="${site.themeColor}" />
    <meta name="application-name" content="${site.name}" />
    <meta name="apple-mobile-web-app-title" content="${site.shortName}" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="canonical" href="${SITE_URL}" />
    <link rel="manifest" href="${BASE}site.webmanifest" />
    <link rel="apple-touch-icon" href="${BASE}favicon.svg" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${site.name}" />
    <meta property="og:title" content="${TITLE}" />
    <meta property="og:description" content="${site.shortDescription}" />
    <meta property="og:url" content="${SITE_URL}" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${site.name} — ${site.tagline}" />
    <meta property="og:locale" content="en_US" />
    ${ogLocales}

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${TITLE}" />
    <meta name="twitter:description" content="${site.shortDescription}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
    <meta name="twitter:image:alt" content="${site.name} — ${site.tagline}" />
    <meta name="twitter:site" content="${site.twitter}" />

    ${alternates}

    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`

  return {
    name: 'chess-reviewer-seo-html',
    transformIndexHtml(html) {
      return html
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${TITLE}</title>`)
        .replace('</head>', `${tags}\n  </head>`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: site.basePath,
  plugins: [react(), tailwindcss(), seoHtml()],
})
