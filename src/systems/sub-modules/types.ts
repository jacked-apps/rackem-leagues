/**
 * @fileoverview SubModule — plug-in modules declaring which sub kinds
 * are available in a league's lineup.
 *
 * Per Ed: anonymous sub and double-duty sub are each their own
 * module. LO toggles each independently — neither, one, the other,
 * or both. Workshop (future) edits the per-league enabled set; today
 * each shipping system declares both as default.
 *
 * The persisted encoding for a sub slot is a sentinel UUID
 * (`getAnonSubId(...)`, `getDoubleDutySubId(...)` in
 * `src/utils/lineup/substituteHelpers.ts`). This module is a separate
 * concern — it describes which sub kinds the captain can pick from
 * the lineup-page dropdown.
 */

/**
 * Which kind of sub this module represents.
 *
 * - `'anonymous'` — captain picks "sub" for a slot and enters the
 *   handicap themselves. The actual player isn't named.
 * - `'double_duty'` — a real lineup player plays a second slot too.
 *   Opposing captain resolves which player.
 */
export type SubKind = 'anonymous' | 'double_duty';

/**
 * Plug-in SubModule. Describes one kind of substitute the league
 * allows.
 */
export interface SubModule {
  /** Discriminator. Stable across versions. */
  readonly kind: SubKind;

  /** Label shown in the player-selection dropdown. */
  readonly displayLabel: string;

  /**
   * In-memory option value used by the React `<Select>` widget.
   * `handlePlayerChange` decodes this back to a sentinel UUID via
   * `getSentinelId` below. The value is stable so existing UI logic
   * keeps working.
   */
  readonly dropdownValue: string;

  /**
   * Max instances of this sub kind allowed in a single lineup. Today
   * always 1 (matches the existing "at most one sub of either type"
   * rule). Future workshop can dial higher.
   */
  readonly maxPerLineup: number;

  /**
   * Generate the persisted sentinel UUID for this sub kind on a given
   * side. Thin wrapper over the existing per-kind helpers in
   * `src/utils/lineup/substituteHelpers.ts` — exposed on the module
   * so callers can dispatch generically without a switch on `kind`.
   */
  readonly getSentinelId: (isHomeTeam: boolean) => string;

  /**
   * Test whether a given player-id string is THIS kind's persisted
   * sentinel (`isAnonSubSentinel` / `isDoubleDutySentinel` etc).
   * Exposed on the module so display-name lookups can iterate the
   * enabled subs and ask each one.
   */
  readonly isPersistedSentinel: (playerId: string) => boolean;
}
