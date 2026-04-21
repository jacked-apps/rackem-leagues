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
  }
> = {
  staging: {
    label: 'BETA PREVIEW',
    message:
      'You are testing a pre-release build. Features may change. Report issues to Ed or to the league operator running tonight.',
    bgClass: 'bg-amber-500',
    textClass: 'text-black',
  },
  development: {
    label: 'DEV',
    message: 'Development build — not connected to production data.',
    bgClass: 'bg-red-600',
    textClass: 'text-white',
  },
};
