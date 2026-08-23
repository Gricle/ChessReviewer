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

## 2. Google Search Console (gets you into Google)
- [ ] Add the property at https://search.google.com/search-console
- [x] Ownership is set up via the **HTML file** method —
      `public/googlec93fa45ea7830187.html` is committed and live at
      `https://gricle.github.io/ChessReviewer/googlec93fa45ea7830187.html`.
      Just click **Verify** in Search Console. Leave that file in `public/`
      forever — Google re-checks it and deleting it unverifies the property.
      (Because of this, `site.config.json` → `verification.google` can stay
      empty; the meta-tag method is only an alternative, not an extra step.)
- [ ] Submit the sitemap URL directly:
      `https://gricle.github.io/ChessReviewer/sitemap.xml`
      (On a GitHub Pages sub-path, `robots.txt` isn't at the domain root, so
      submit the sitemap URL by hand rather than relying on auto-discovery.)
- [ ] Use "Request indexing" on the URL to speed up first crawl.
- [ ] The sitemap now lists ten pages (`/`, `/es/`, `/de/`, …), one per
      language, each a real prerendered file with its own canonical. Expect
      Search Console to report ten indexed URLs, not one.
- [ ] If any old `?lng=` URL was already crawled, leave it alone. It serves the
      English page, which canonicalises to `/`, and the app forwards visitors to
      the path form.

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
