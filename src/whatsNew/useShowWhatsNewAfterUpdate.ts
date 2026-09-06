/**
 * @fileoverview Carries "show me what's new" across the update reload.
 *
 * Applying an update reloads the page, which wipes React state — so the intent
 * has to survive in storage. `sessionStorage` rather than `localStorage`: the
 * flag is meaningful for exactly one reload in one tab, and a leftover
 * localStorage value would drag someone to the notes weeks later.
 *
 * @see src/components/PWAUpdatePrompt.tsx
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/** Survives the reload; consumed once on the other side. */
const FLAG = 'rackem:show-whats-new-after-update';

/** The member's last answer, so someone who opts out isn't asked every release. */
const PREFERENCE = 'rackem:whats-new-after-update-pref';

/**
 * Ask to be taken to What's New after the update reload.
 *
 * Storage can throw in a private window or with site data blocked, so a failure
 * here must not take the update down with it — landing on the same page is a
 * fine outcome; not updating is not.
 */
export function requestWhatsNewAfterUpdate(): void {
  try {
    sessionStorage.setItem(FLAG, '1');
  } catch {
    // Ignore — worst case they stay where they are.
  }
}

/**
 * Read the member's saved preference for the checkbox.
 *
 * @returns Their last answer, defaulting to true — most people haven't formed
 *          an opinion, and the notes are the point of the update prompt.
 */
export function getWhatsNewPreference(): boolean {
  try {
    return localStorage.getItem(PREFERENCE) !== 'false';
  } catch {
    return true;
  }
}

/**
 * Remember the checkbox answer, so unchecking it once sticks.
 *
 * @param wanted - Whether they want to see the notes after updating
 */
export function setWhatsNewPreference(wanted: boolean): void {
  try {
    localStorage.setItem(PREFERENCE, wanted ? 'true' : 'false');
  } catch {
    // Ignore — they'll just be asked again next time.
  }
}

/**
 * On load, if an update asked for it, go to What's New.
 *
 * Mounted once at the router root. Clears the flag BEFORE navigating so a
 * failure can't leave it set and redirect them again on the next load.
 */
export function useShowWhatsNewAfterUpdate(): void {
  const navigate = useNavigate();

  useEffect(() => {
    let wanted = false;
    try {
      wanted = sessionStorage.getItem(FLAG) === '1';
      if (wanted) sessionStorage.removeItem(FLAG);
    } catch {
      return;
    }
    // `replace` so Back returns to wherever they were before updating, rather
    // than bouncing them into the notes again.
    if (wanted) navigate('/whats-new', { replace: true });
  }, [navigate]);
}
