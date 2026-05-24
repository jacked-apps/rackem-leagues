/**
 * @fileoverview Helpers for the season lifecycle — used by both the
 * org dashboard (ActiveLeagues hint badge) and the league detail page
 * (ActionCard "Create Next Season" button) so the gating logic is in
 * one place.
 */

/**
 * Whether the league is "ripe" for starting the next season.
 *
 * Returns true if either:
 *   - The active season is in its final ~2 weeks (within 14 days of
 *     end_date) — gives LOs a head start on planning while the
 *     current season is still wrapping up. Per Ed's rule (2026-05-17):
 *     "I would allow this to happen starting in the last weeks of
 *     the previous season."
 *   - There's no active season AND the league has at least one prior
 *     season to copy from (i.e., the previous season was just
 *     completed and a new one hasn't been activated yet).
 *
 * Returns false in two extra cases:
 *   - Brand-new leagues (seasonCount === 0) — those go through the
 *     first-time setup flow instead.
 *   - A `scheduled` season already exists for this league — the
 *     operator already set up the next season and it's just waiting
 *     for its start date. Showing the CTA again would offer them a
 *     SECOND next-next-season, which isn't what they want.
 *
 * @param activeSeason The league's most-recent active season row —
 *   falsy if the league has none.
 * @param seasonCount Total seasons the league has had (active +
 *   completed + upcoming + scheduled).
 * @param hasScheduledSeason True if the league already has a season
 *   with status='scheduled' (created via the wizard but not yet live).
 */
export function isNextSeasonRipe(
  activeSeason: { end_date?: string | null; status?: string } | null | undefined,
  seasonCount: number,
  hasScheduledSeason: boolean = false,
): boolean {
  if (seasonCount === 0) return false; // no previous season to copy
  // A scheduled season already covers "what's next" — hide the CTA
  // so the operator doesn't accidentally build a third overlapping
  // season on top of one that's just queued.
  if (hasScheduledSeason) return false;
  if (!activeSeason) return true; // had seasons, none active now → previous done

  // Active or upcoming season with an end_date — check if we're
  // inside the 14-day pre-end window.
  if (!activeSeason.end_date) return false;
  const end = new Date(activeSeason.end_date).getTime();
  const now = Date.now();
  const daysUntilEnd = (end - now) / (1000 * 60 * 60 * 24);
  return daysUntilEnd <= 14;
}
