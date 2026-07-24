import { useEffect } from 'react';
import { ADS_CONFIGURED, loadAdSense } from './adsense';
import { initConsentDefaults, getConsent } from './consent';
import { ConsentBanner } from './ConsentBanner';

/**
 * Mount once near the app root. Sets Consent Mode v2 defaults, loads AdSense if
 * consent was already granted in a prior visit, and renders the consent banner.
 * A no-op when no publisher ID is configured.
 */
export function AdsRoot() {
  useEffect(() => {
    if (!ADS_CONFIGURED) return;
    initConsentDefaults();
    if (getConsent() === 'granted') loadAdSense();
  }, []);

  return <ConsentBanner />;
}
