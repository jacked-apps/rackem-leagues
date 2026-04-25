/**
 * @fileoverview Top-of-app banner that labels non-production builds.
 *
 * Renders nothing on production. On staging, shows an amber "BETA PREVIEW"
 * bar. On development, shows a red "DEV" bar. The banner is sticky at the
 * top of the viewport so it remains visible during page scroll.
 *
 * Copy, colors, and label text are configured in src/config/environment.ts
 * so content tweaks don't require editing this component.
 */

import { env, ENV_BANNER_CONFIG } from '@/config/environment';

/**
 * Sticky environment banner. Mount once at the app root (above the router)
 * so it is visible on every page regardless of per-route layout.
 */
export const EnvironmentBanner: React.FC = () => {
  if (env === 'production') return null;

  const config = ENV_BANNER_CONFIG[env];

  return (
    <div
      role="status"
      aria-label={`${config.label} environment banner`}
      className={`${config.bgClass} ${config.textClass} sticky top-0 z-50 w-full px-3 py-1.5 text-center text-xs font-medium shadow-sm`}
    >
      <span className="font-bold uppercase tracking-wide">{config.label}</span>
      <span className="mx-2" aria-hidden="true">
        ·
      </span>
      <span>{config.message}</span>
    </div>
  );
};
