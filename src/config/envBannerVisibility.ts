/**
 * @fileoverview Lets a page hide the staging/dev environment banner while it
 * is open (e.g. a page shown to outside readers, like /aboutstopstop).
 *
 * The banner is mounted above the router, so it can't read the current route;
 * pages flip this tiny shared switch instead and the banner subscribes to it.
 */
import { useEffect, useSyncExternalStore } from 'react';

let hiders = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setHiders(n: number) {
  hiders = n;
  listeners.forEach((l) => l());
}

/** True while any open page asked to hide the banner. */
export function useEnvBannerHidden(): boolean {
  return useSyncExternalStore(subscribe, () => hiders > 0);
}

/** Hides the environment banner for as long as the calling page is mounted. */
export function useHideEnvBanner(): void {
  useEffect(() => {
    setHiders(hiders + 1);
    return () => setHiders(hiders - 1);
  }, []);
}
