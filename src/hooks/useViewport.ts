/**
 * @fileoverview useViewport Hook
 *
 * Returns viewport state for components that adapt to screen size.
 * Listens to `matchMedia` changes so it stays in sync with orientation
 * changes and window resizes.
 *
 * The 640px breakpoint matches Tailwind's `sm` boundary: anything below
 * 640px is treated as mobile.
 *
 * Usage:
 *   const { isMobile } = useViewport();
 *   return <div>{isMobile ? 'Mobile' : 'Desktop'}</div>;
 *
 * @returns { isMobile } — `true` when the viewport width is < 640px.
 */

import { useEffect, useState } from 'react';

/** Tailwind `sm` boundary: matches when viewport is < 640px. */
const MOBILE_QUERY = '(max-width: 639px)';

export function useViewport(): { isMobile: boolean } {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    // SSR-safe: when window is undefined (Vite SSR is not used today,
    // but cheap to be safe), default to desktop.
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia(MOBILE_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return { isMobile };
}
