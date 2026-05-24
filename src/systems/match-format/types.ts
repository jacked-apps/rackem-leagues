/**
 * @fileoverview Match Format Module — per-pairing structural configuration bundle.
 *
 * Per the locked Match Format blueprint (docs/league-system/modules/match-format.md),
 * Match Format is a passive configuration record bundling two independent axes:
 *
 *   - **pairing_format** — how an individual head-to-head pairing is structured:
 *     `single_rack` (each pairing is one rack of pool, winner takes the pairing) or
 *     `race_to_n` (each pairing is a race-to-N sequence of racks).
 *   - **race_length** — the N value when pairing_format is `race_to_n`. Null when
 *     pairing_format is `single_rack` (race length is not meaningful for single-rack
 *     pairings). Positive integer when race_to_n.
 *
 * The Module has NO behavior. It exposes the configured axes as a typed bundle for
 * downstream consumers — primarily the Pairings Generator (race_to_n affects per-pairing
 * internal structure) and the Handicap Mechanism's `race_length_adjustment` variant
 * (which reads race_length as its baseline race target).
 *
 * **Season-stability:** both axes are season-stable per the schema-level lock trigger.
 * Once a league season is locked, changing pairing_format or race_length would invalidate
 * snapshot reproducibility and could mid-season restructure pairing semantics.
 *
 * @see docs/league-system/modules/match-format.md — the locked blueprint
 */

/**
 * How an individual head-to-head pairing is structured.
 *
 * `single_rack` — each pairing is one rack of pool. The pairing's winner is whoever wins
 *   the rack. Used by all three currently-shipped prepackaged Scoring Systems.
 *
 * `race_to_n` — each pairing is a race-to-N sequence of racks. The pairing ends the moment
 *   one side wins N racks. Per-pairing time scales with N and skill. Used by future
 *   race-tradition Scoring Systems (BCAPL skill-level format and similar).
 */
export type PairingFormat = 'single_rack' | 'race_to_n';

/**
 * The Match Format Module.
 *
 * A passive configuration record with two axes. No methods, no state, no side effects.
 * Constructed by `getMatchFormat()` from validated preference inputs; consumed by Modules
 * that need to know what shape each pairing takes (Pairings Generator for per-pairing
 * internal structure; Handicap Mechanism `race_length_adjustment` for the baseline race
 * target).
 */
export interface MatchFormat {
  /** How each individual head-to-head pairing is structured. Season-stable. */
  readonly pairingFormat: PairingFormat;

  /**
   * The race-to-N target when `pairingFormat === 'race_to_n'`. Null when
   * `pairingFormat === 'single_rack'` (race length is not meaningful for
   * single-rack pairings). Positive integer otherwise. Season-stable.
   */
  readonly raceLength: number | null;
}
