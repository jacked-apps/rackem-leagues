/**
 * @fileoverview Team Geometry Module — three-axis configuration bundle.
 *
 * Per the locked Team Geometry blueprint (docs/league-system/modules/team-geometry.md),
 * Team Geometry is a passive configuration record that bundles three independent axes:
 *
 *   - **lineup_size** — players per team in a match-night lineup (3 for 3v3, 5 for 5v5, etc.)
 *   - **max_roster_size** — administrative cap on team roster (mutable mid-season; NOT consumed
 *     by any scoring code; only used by the lineup-page UI to size the roster grid)
 *   - **game_generation** — how match-night games arise from the cross-product of lineups
 *     (`single_round_robin` = each pairing once; `double_round_robin` = each pairing twice)
 *
 * The Module has NO behavior. It exposes the configured axes plus one derived value:
 *
 *   - **game_count** — total regular games per match-night, derived as
 *     `lineup_size² × multiplier(game_generation)`. Consumed by Pairings Generator,
 *     game-count-dependent Threshold Charts, scoring runtime, and tiebreaker numbering.
 *
 * **Season-stability:** `lineup_size` and `game_generation` are season-stable — once a
 * league season is locked, changing either invalidates accumulated standings and snapshot
 * reproducibility. Enforced at the schema layer by the season-stability lock trigger.
 * `max_roster_size` is NOT season-stable; it can change mid-season without invalidating
 * scoring (since no scoring code consumes it).
 *
 * @see docs/league-system/modules/team-geometry.md — the locked blueprint
 */

/**
 * How match-night games arise from the lineup cross-product.
 *
 * `single_round_robin` — each home-team player faces each away-team player once.
 *   Game count = lineup_size².
 *
 * `double_round_robin` — each home-team player faces each away-team player twice.
 *   Game count = lineup_size² × 2.
 */
export type GameGeneration = 'single_round_robin' | 'double_round_robin';

/**
 * The Team Geometry Module.
 *
 * A passive configuration record with three axes + one derived value. No methods,
 * no state, no side effects. Constructed by `getTeamGeometry()` from validated
 * preference inputs; consumed by every Module that needs to know how many players,
 * how many games, or how games arrange.
 */
export interface TeamGeometry {
  /** Players per team on a match night. Season-stable. */
  readonly lineupSize: number;

  /**
   * Administrative cap on team roster size. NOT season-stable; NOT consumed by
   * any scoring/threshold/win-calc code. Used only by the lineup-page UI to
   * know how many roster-management slots to render.
   */
  readonly maxRosterSize: number;

  /** Game-generation mode for the match-night pairing cross-product. Season-stable. */
  readonly gameGeneration: GameGeneration;

  /**
   * Total regular (non-tiebreaker) games per match-night, derived from the axes:
   * `lineup_size² × multiplier(game_generation)`.
   *
   * Examples:
   *   - 3v3 DRR → 3² × 2 = 18 games
   *   - 5v5 SRR → 5² × 1 = 25 games
   *   - 4v4 SRR → 4² × 1 = 16 games
   *   - 4v4 DRR → 4² × 2 = 32 games
   */
  readonly gameCount: number;
}
