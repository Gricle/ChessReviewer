# 🚀 Go-Live checklist (do these later)

The SEO foundation and the AdSense-ready ad system are **built and deployed**.
Everything below needs *your* accounts — I can't do them for you. None are urgent;
knock them out whenever.

---

## 1. Confirm the deploy went out
- [ ] Check the **Actions** tab on GitHub — the "Deploy to GitHub Pages" run
      should be green after the push.
- [ ] Visit https://gricle.github.io/ChessReviewer/ and confirm the new landing
      content (features, FAQ, footer) shows.

## 2. Google Search Console — DONE (2026-08-23)
Property verified, homepage submitted for indexing, sitemap submitted. Nothing
left to do here.
- [x] Property added as the URL prefix `https://gricle.github.io/ChessReviewer/`.
- [x] Ownership verified via the **HTML file** method —
      `public/googlec93fa45ea7830187.html`. Leave that file in `public/`
      forever; Google re-checks it and deleting it unverifies the property.
      (So `site.config.json` → `verification.google` stays empty by design.)
- [x] `sitemap.xml` submitted by hand. On a Pages sub-path `robots.txt` isn't at
      the domain root, so auto-discovery would never have found it.
- [x] "Request indexing" run on the homepage.
- Expect ten indexed URLs eventually (`/`, `/es/`, `/de/`, …), each a real
  prerendered file with its own canonical — not one.
- If an old `?lng=` URL was already crawled, leave it. It serves the English
  page, canonicalises to `/`, and the app forwards visitors to the path form.

## 3. Bing Webmaster Tools (optional, easy extra traffic)
- [ ] https://www.bing.com/webmasters → add site → verify.
- [ ] Paste token into `site.config.json` → `verification.bing` → push.
- [ ] Submit the same sitemap URL.

## 4. Custom domain (recommended — helps ranking AND AdSense)
- [ ] Point your domain at GitHub Pages (or move to Vercel).
- [ ] In **`site.config.json`**: set `origin` to the new domain and
      `basePath` to `"/"`. That single change regenerates every canonical,
      sitemap entry, hreflang, manifest, and ads.txt on the next build.
- [ ] Also update `vite.config.ts` `base` and `public/404.html` base if you
      leave the GitHub Pages sub-path. Then re-submit the sitemap in Search
      Console under the new domain.

## 5. Start ads (AdSense)
- [ ] Apply at https://adsense.google.com (approval needs live content + a
      privacy policy — both already shipped: `public/privacy.html`).
- [ ] Once approved, set the build env var
      `VITE_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX`
      (add it as a GitHub Actions secret + in the workflow's build env).
- [ ] Create ad units in AdSense and paste their numeric slot IDs into
      `src/ads/adsense.ts` → `AD_SLOTS` (`landing`, `review`).
- [ ] Push. `ads.txt` auto-fills your real publisher line; the consent banner
      and ads activate. Verify `https://<domain>/ads.txt` shows your pub ID.
- [ ] For EEA/UK personalized ads, enable a Google-certified CMP via
      **Privacy & messaging** in the AdSense dashboard.

---

### Nice-to-haves for "popular"
- [ ] Share the tool on r/chess, chess Discords, and chess forums (organic
      traffic + backlinks are the #1 ranking signal after content).
- [ ] Ask a few chess sites/blogs for a backlink.
- [ ] Consider adding a short blog/guide page per big keyword later
      ("how to read a chess game review", "what is chess accuracy", etc.).

_See the README "SEO" and "Ads" sections for how the system is wired._
