import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ADS_CONFIGURED, ADSENSE_CLIENT, AD_SLOTS, pushAd, type AdPlacement } from './adsense';
import { useConsent } from './useConsent';

interface Props {
  placement: AdPlacement;
  className?: string;
}

/**
 * A single AdSense placement. Renders nothing in production unless a publisher
 * ID is configured AND the visitor has granted consent — so the app is fully
 * functional and policy-safe with ads dormant. In dev, shows a labeled
 * placeholder box so the layout can be designed before an account exists.
 */
export function AdSlot({ placement, className }: Props) {
  const { t } = useTranslation('seo');
  const consent = useConsent();
  const insRef = useRef<HTMLModElement | null>(null);
  const pushed = useRef(false);
  const active = ADS_CONFIGURED && consent === 'granted';

  useEffect(() => {
    if (active && !pushed.current) {
      pushed.current = true;
      pushAd();
    }
  }, [active]);

  if (!active) {
    if (import.meta.env.DEV) {
      return (
        <div
          className={`mx-auto my-6 flex h-24 max-w-3xl items-center justify-center rounded-xl border border-dashed border-indigo-500/30 bg-indigo-950/20 text-[11px] font-mono text-slate-500 ${className ?? ''}`}
          aria-hidden="true"
        >
          Ad placement · {placement} {ADS_CONFIGURED ? '(awaiting consent)' : '(no publisher ID)'}
        </div>
      );
    }
    return null;
  }

  const { slot, format } = AD_SLOTS[placement];
  return (
    <div className={`mx-auto my-6 max-w-3xl text-center ${className ?? ''}`}>
      <p className="mb-1 text-[10px] font-mono uppercase tracking-wider text-slate-600">
        {t('ads.label')}
      </p>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
