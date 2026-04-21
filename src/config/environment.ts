/**
 * @fileoverview Environment detection and banner configuration.
 *
 * Reads the build-time `VITE_APP_ENV` variable and exposes environment
 * helpers plus banner styling/copy for non-production builds.
 *
 * How `VITE_APP_ENV` is set:
 *   - Production: set to `production` in .github/workflows/deploy-production.yml
 *   - Staging:    set to `staging` in .github/workflows/deploy-staging.yml
 *   - Local dev:  set to `development` in .env (see .env.example). If omitted,
 *                 this module defaults to `development`.
 *
 * To customize beta/dev banner copy, edit ENV_BANNER_CONFIG below.
 */

export type AppEnvironment = 'development' | 'staging' | 'production';

const rawEnv = import.meta.env.VITE_APP_ENV as string | undefined;

/**
 * The current application environment. Defaults to `development` if
 * VITE_APP_ENV is not set or is not one of the known values.
 */
export const env: AppEnvironment =
  rawEnv === 'production' || rawEnv === 'staging' || rawEnv === 'development'
    ? rawEnv
    : 'development';

export const isProduction = env === 'production';
export const isStaging = env === 'staging';
export const isDevelopment = env === 'development';

/**
 * Styling and copy for the environment banner. Production has no entry
 * because the banner does not render there.
 *
 * Edit the `message` fields here to change what testers/developers see.
 */
export const ENV_BANNER_CONFIG: Record<
  Exclude<AppEnvironment, 'production'>,
  {
    /** Short uppercase label, e.g. "BETA PREVIEW" */
    label: string;
    /** Supporting message shown next to the label */
    message: string;
    /** Tailwind background class */
    bgClass: string;
    /** Tailwind text color class */
    textClass: string;
    /** Path (public-relative) to the env-specific favicon SVG */
    faviconPath: string;
    /** Path (public-relative) to env-specific apple-touch-icon PNG (iOS home screen) */
    appleTouchIconPath: string;
    /** Prefix prepended to document.title, e.g. "[BETA]" */
    titlePrefix: string;
  }
> = {
  staging: {
    label: 'BETA PREVIEW',
    message:
      'You are testing a pre-release build. Features may change. Report issues to Ed or to the league operator running tonight.',
    bgClass: 'bg-amber-500',
    textClass: 'text-black',
    faviconPath: '/favicon-staging.svg',
    appleTouchIconPath: '/icons-staging/apple-touch-icon.png',
    titlePrefix: '[BETA]',
  },
  development: {
    label: 'DEV',
    message: 'Development build — not connected to production data.',
    bgClass: 'bg-red-600',
    textClass: 'text-white',
    faviconPath: '/favicon-dev.svg',
    appleTouchIconPath: '/icons-dev/apple-touch-icon.png',
    titlePrefix: '[DEV]',
  },
};

/**
 * Applies environment-specific branding (favicon swap, apple-touch-icon
 * swap, title prefix) to the document. No-op on production. Call once,
 * as early as possible — typically from `main.tsx` before React renders,
 * to avoid a flash of production branding on non-production builds.
 *
 * The apple-touch-icon swap matters for iOS users who "Add to Home Screen"
 * — iOS captures the icon from the current `<link rel="apple-touch-icon">`
 * at the moment the user taps install, so swapping early ensures they get
 * the staging/dev icon on their home screen. (Already-installed PWAs do
 * NOT update their cached home-screen icon — users must reinstall.)
 */
export const applyEnvironmentBranding = (): void => {
  if (env === 'production') return;

  const config = ENV_BANNER_CONFIG[env];

  const faviconLink = document.querySelector<HTMLLinkElement>(
    'link[rel="icon"]'
  );
  if (faviconLink) {
    faviconLink.href = config.faviconPath;
  }

  const appleTouchLink = document.querySelector<HTMLLinkElement>(
    'link[rel="apple-touch-icon"]'
  );
  if (appleTouchLink) {
    appleTouchLink.href = config.appleTouchIconPath;
  }

  document.title = `${config.titlePrefix} ${document.title}`;
};
