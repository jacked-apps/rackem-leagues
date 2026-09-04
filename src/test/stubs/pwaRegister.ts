/**
 * @fileoverview Test stub for `virtual:pwa-register/react`.
 *
 * That module is generated at build time by `vite-plugin-pwa`, which isn't in
 * the vitest plugin chain — so any component importing it fails to resolve
 * before `vi.mock` ever gets a chance to intercept. That is why
 * `PWAUpdatePrompt` had no tests while its "Update Now" button was quietly
 * broken in production.
 *
 * `vitest.config.ts` aliases the virtual id here so those components are
 * importable under test. Tests still `vi.mock('virtual:pwa-register/react')`
 * with whatever behaviour they need; this stub is only the resolvable floor
 * and its default is deliberately inert (no update waiting, update is a no-op).
 */

/** Shape of the real hook's return value, narrowed to what we consume. */
export interface RegisterSWReturn {
  needRefresh: [boolean, (value: boolean) => void];
  offlineReady: [boolean, (value: boolean) => void];
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

export function useRegisterSW(): RegisterSWReturn {
  return {
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: async () => {},
  };
}
