/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: 'development' | 'staging' | 'production';
  // Web Push VAPID public key (Unit 2). Passed to pushManager.subscribe as the
  // applicationServerKey. Public; must be present at build time to subscribe.
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

/**
 * The running app version, injected at build time from package.json.
 *
 * Exists so a user can answer "am I on the new build?" without DevTools —
 * on 2026-09-05 a stale bundle was twice mistaken for a broken feature, and
 * both times that was the question.
 */
declare const __APP_VERSION__: string;
