import { useEffect, useState } from 'react';
import { getConsent, subscribeConsent, type ConsentState } from './consent';

/** Reactive access to the current consent decision. */
export function useConsent(): ConsentState {
  const [state, setState] = useState<ConsentState>(() => getConsent());
  useEffect(() => subscribeConsent(setState), []);
  return state;
}
