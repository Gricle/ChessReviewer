import { useTranslation } from 'react-i18next';
import { SITE_NAME } from '../config/site';

/**
 * Site footer: brand line, privacy policy and source links. Present on every
 * tab — gives crawlers internal links and satisfies AdSense's requirement for a
 * visible privacy policy and clear site navigation.
 */
export function Footer() {
  const { t } = useTranslation('seo');
  const privacyHref = `${import.meta.env.BASE_URL}privacy.html`;

  return (
    <footer className="border-t border-indigo-400/10 bg-[#07061199] mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="space-y-1">
          <p className="text-sm font-bold text-white font-display">{SITE_NAME}</p>
          <p className="text-xs text-slate-500 font-sans max-w-sm">{t('footer.tagline')}</p>
        </div>
        <nav className="flex items-center gap-5 text-xs font-mono text-slate-400">
          <a
            href={privacyHref}
            className="hover:text-cyan-300 transition-colors"
          >
            {t('footer.privacy')}
          </a>
          <a
            href="https://github.com/Gricle/ChessReviewer"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-cyan-300 transition-colors"
          >
            {t('footer.sourceCode')}
          </a>
        </nav>
      </div>
      <p className="pb-6 text-center text-[10px] font-mono text-slate-600">{t('footer.builtWith')}</p>
    </footer>
  );
}
