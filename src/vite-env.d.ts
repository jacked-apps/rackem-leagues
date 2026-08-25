/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: 'development' | 'staging' | 'production';
  // Web Push VAPID public key (Unit 2). Passed to pushManager.subscribe as the
  // applicationServerKey. Public; must be present at build time to subscribe.
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}
