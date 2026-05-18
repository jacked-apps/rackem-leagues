/**
 * @fileoverview Helpers for the season lifecycle — used by both the
 * org dashboard (ActiveLeagues hint badge) and the league detail page
 * (ActionCard "Start Next Season" button) so the gating logic is in
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
 * Returns false for brand-new leagues (seasonCount === 0) — those go
 * through the first-time setup flow instead.
 *
 * @param activeSeason The league's most-recent season row (may be
 *   active, upcoming, or completed) — falsy if the league has none.
 * @param seasonCount Total seasons the league has had (active +
 *   completed + upcoming).
 */
export function isNextSeasonRipe(
  activeSeason: { end_date?: string | null; status?: string } | null | undefined,
  seasonCount: number,
): boolean {
  if (seasonCount === 0) return false; // no previous season to copy
  if (!activeSeason) return true; // had seasons, none active now → previous done

  // Active or upcoming season with an end_date — check if we're
  // inside the 14-day pre-end window.
  if (!activeSeason.end_date) return false;
  const end = new Date(activeSeason.end_date).getTime();
  const now = Date.now();
  const daysUntilEnd = (end - now) / (1000 * 60 * 60 * 24);
  return daysUntilEnd <= 14;
}
