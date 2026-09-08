/**
 * @fileoverview The games a tournament can be played as (single source).
 *
 * Lived in DetailsStep with a second, drifting copy of the labels inside
 * tournamentRules. Both now read this, so the create page, the organizer's edit
 * form and the player-facing rules line can't disagree about what "nine_ball"
 * is called.
 */

/** Offered on the create page and the organizer's info tab, in display order. */
export const GAME_TYPES = [
  { value: 'eight_ball', label: '8-Ball' },
  { value: 'nine_ball', label: '9-Ball' },
  { value: 'ten_ball', label: '10-Ball' },
] as const;

/**
 * The display name for a stored game type.
 *
 * Falls back to the raw value rather than "Unknown": the column is free-form in
 * v1, so a tournament may legitimately carry something not on the list, and
 * showing what it actually says beats pretending we lost it.
 */
export function gameTypeLabel(value: string): string {
  return GAME_TYPES.find((g) => g.value === value)?.label ?? value;
}
