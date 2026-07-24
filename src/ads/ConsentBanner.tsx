import { useTranslation } from 'react-i18next';
import { ADS_CONFIGURED, loadAdSense } from './adsense';
import { grantConsent, denyConsent } from './consent';
import { useConsent } from './useConsent';

/**
 * GDPR/Consent-Mode banner. Only appears when ads are configured and the
 * visitor has not yet decided. "Accept" grants consent and loads AdSense;
 * "Reject" keeps ad/analytics storage denied and loads nothing.
 */
export function ConsentBanner() {
  const { t } = useTranslation('seo');
  const consent = useConsent();

  if (!ADS_CONFIGURED || consent !== 'unset') return null;

  const privacyHref = `${import.meta.env.BASE_URL}privacy.html`;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-indigo-400/20 bg-[#0b0918]/95 backdrop-blur px-4 py-4 shadow-2xl"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-xs leading-relaxed text-slate-300 font-sans">
          {t('consent.message')}{' '}
          <a
            href={privacyHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
          >
            {t('consent.privacy')}
          </a>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => denyConsent()}
            className="rounded-xl border border-indigo-500/30 bg-indigo-950/60 px-4 py-2 text-xs font-mono text-slate-300 hover:bg-indigo-900/60 cursor-pointer"
          >
            {t('consent.reject')}
          </button>
          <button
            type="button"
            onClick={() => {
              grantConsent();
              loadAdSense();
            }}
            className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold font-sans text-[#05040c] shadow-[0_0_15px_rgba(56,225,214,0.3)] hover:bg-cyan-300 cursor-pointer"
          >
            {t('consent.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
