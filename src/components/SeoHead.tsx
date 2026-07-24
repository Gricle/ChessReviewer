import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { canonicalForLang, SITE_LANGUAGES } from '../config/site';

/**
 * Keeps the document head in sync with the active UI language: title, meta
 * description, self-referencing canonical, and the Open Graph / Twitter URL,
 * title, description and locale. The static tags in index.html cover the
 * first paint (English); this updates them once React knows the real language.
 *
 * Renders nothing.
 */
export function SeoHead() {
  const { t, i18n } = useTranslation('seo');
  const lang = i18n.language || 'en';

  useEffect(() => {
    const title = t('meta.title');
    const description = t('meta.description');
    const canonical = canonicalForLang(lang);
    const hreflang = SITE_LANGUAGES.find((l) => l.code === lang)?.hreflang ?? 'en';
    const ogLocale = hreflang.replace('-', '_');

    document.title = title;
    setMeta('name', 'description', description);

    setLink('canonical', canonical);

    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:locale', ogLocale);

    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
  }, [t, lang]);

  return null;
}

function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}
