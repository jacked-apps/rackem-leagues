/**
 * @fileoverview useIsWizard2League — detects if a league was created by Wizard 2.0
 *
 * Checks whether the league's preferences row has modular columns populated
 * (lineup_size, handicap_type, etc.). Wizard 1 leagues have these as NULL.
 * Wizard 2 leagues have real values from the dual-write mutation.
 *
 * Use this to decide which routes/buttons to show on the league detail page.
 */

import { useLeaguePreferences } from './usePreferences';

/**
 * Returns true if this league was created by Wizard 2.0.
 * Returns false if Wizard 1 or if preferences haven't loaded yet.
 *
 * @param leagueId - the league to check
 *
 * @example
 * const isV2 = useIsWizard2League(leagueId);
 * // Route to v2 flow or v1 flow based on this
 */
export function useIsWizard2League(leagueId: string | null | undefined): boolean {
  const { data: prefs } = useLeaguePreferences(leagueId);

  // If lineup_size is set, this league was created by Wizard 2.0
  return prefs?.lineup_size != null;
}
