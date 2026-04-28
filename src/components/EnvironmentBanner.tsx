/**
 * @fileoverview Top-of-app banner that labels non-production builds.
 *
 * Renders nothing on production. On staging, shows an amber "BETA PREVIEW"
 * bar. On development, shows a red "DEV" bar. The banner is sticky at the
 * top of the viewport so it remains visible during page scroll.
 *
 * Copy, colors, and label text are configured in src/config/environment.ts
 * so content tweaks don't require editing this component.
 *
 * Stacking with the global header: the banner publishes its rendered height
 * to the `--env-banner-height` CSS variable on the document root so the
 * sticky `<PageHeader>` can offset its `top` and sit immediately below the
 * banner. We use `useLayoutEffect` (not `useEffect`) so the variable is set
 * synchronously before the first paint — no flicker, no position jump as
 * the header animates from `0px` to the banner's height. A `ResizeObserver`
 * keeps the variable in sync if the banner copy reflows (e.g., narrow
 * viewports wrapping to two lines).
 */
import { useLayoutEffect, useRef } from 'react';
import { env, ENV_BANNER_CONFIG } from '@/config/environment';

/** CSS variable name; consumed by `<PageHeader>`'s sticky `top:` offset. */
const ENV_BANNER_HEIGHT_VAR = '--env-banner-height';

/**
 * Sticky environment banner. Mount once at the app root (above the router)
 * so it is visible on every page regardless of per-route layout.
 */
export const EnvironmentBanner: React.FC = () => {
  const ref = useRef<HTMLDivElement | null>(null);

  // Synchronously measure the banner before paint and publish its height to
  // the CSS variable. ResizeObserver handles later reflows. On unmount (or
  // hot-reload) we clean the variable so a stale value doesn't leak.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const setVar = () => {
      const px = `${Math.round(el.getBoundingClientRect().height)}px`;
      document.documentElement.style.setProperty(ENV_BANNER_HEIGHT_VAR, px);
    };

    // Initial measurement before paint.
    setVar();

    const observer = new ResizeObserver(setVar);
    observer.observe(el);

    return () => {
      observer.disconnect();
      // Reset to default so production builds (which never mount the banner)
      // and hot-reload paths don't see a stale height.
      document.documentElement.style.removeProperty(ENV_BANNER_HEIGHT_VAR);
    };
  }, []);

  if (env === 'production') return null;

  const config = ENV_BANNER_CONFIG[env];

  return (
    <div
      ref={ref}
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
