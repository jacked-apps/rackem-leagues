/**
 * @fileoverview Match total-games derivation from modular lineup geometry.
 *
 * Used by:
 *   - MatchEndVerification.tsx — to compute how many regular games a match
 *     contains (drives where tiebreaker game numbers start: regular + 1)
 *   - tiebreakerGameNumbers (Phase 5 Unit 5.4) — caller passes the result
 *     of this function as `matchTotalGames`
 *
 * Formula: lineup × lineup × (DRR ? 2 : 1).
 *   3v3 DRR → 3 × 3 × 2 = 18
 *   5v5 SRR → 5 × 5 × 1 = 25
 *   4v4 DRR → 4 × 4 × 2 = 32
 *   4v4 SRR → 4 × 4 × 1 = 16
 *   6v6 SRR → 6 × 6 × 1 = 36
 *
 * Phase 7 Unit 7.3 deleted the legacy `getRegularGameCount(teamFormat)`
 * helper — `team_format` no longer exists. This is the only total-games
 * helper now.
 *
 * @see docs/plans/2026-05-01-001-feat-modular-league-system-v2-plan.md (Unit 5.2)
 */

export interface MatchGeometry {
  /** Players per team in a match-night lineup (3 for 3v3, 5 for 5v5, etc.) */
  lineupSize: number;
  /** Game generation: each home player faces each away player N times. */
  gameGeneration: 'single_round_robin' | 'double_round_robin' | string;
}

/**
 * Compute the number of regular (non-tiebreaker) games in a match.
 *
 * Falls back to single-round-robin multiplier (1×) for any unknown
 * `gameGeneration` value — graceful degradation rather than throw.
 *
 * @param geometry - lineupSize and gameGeneration from resolved preferences
 * @returns Total regular games for the match
 */
export function getMatchTotalGames(geometry: MatchGeometry): number {
  const { lineupSize, gameGeneration } = geometry;
  const multiplier = gameGeneration === 'double_round_robin' ? 2 : 1;
  return lineupSize * lineupSize * multiplier;
}
