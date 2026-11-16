/**
 * @fileoverview Shared double-tap lock for the page header's back arrow.
 *
 * The Button's own double-tap lock is per button. That can't catch the back
 * arrow: a double click lands once on this page's back arrow and once on the
 * NEXT page's back arrow, which sits in the same spot but is a brand-new
 * element. (Ed, 2026-11-10: a double click on a league page's back went past
 * the LO dashboard to My Teams.) So every back arrow shares one timestamp,
 * kept here in module scope.
 *
 * Its own file, not inside PageHeader, so the global test setup can reset it
 * between tests without loading PageHeader and everything it imports.
 */

import { DOUBLE_TAP_WINDOW_MS } from '@/components/ui/button';

/** When any header back arrow last went back (ms since epoch). */
let lastBackTapAt = 0;

/**
 * True when this back tap lands within the double-tap window of the last one,
 * on any page, so the caller should ignore it. Records the tap otherwise.
 *
 * @returns Whether to drop this tap.
 */
export function isSecondBackTap(): boolean {
  const now = Date.now();
  if (now - lastBackTapAt < DOUBLE_TAP_WINDOW_MS) return true;
  lastBackTapAt = now;
  return false;
}

/**
 * Forget the last back tap. Tests only: the global test setup calls it after
 * each test, so one test's back tap can't swallow the next test's.
 */
export function resetBackTapLock(): void {
  lastBackTapAt = 0;
}
