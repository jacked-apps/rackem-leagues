/**
 * @fileoverview The room race's settings — the ONE place they are defined.
 *
 * The race definition hands these to `create_room` (`defaultSettings`), the
 * room row stores them, and `open_room_race` / Run it back read them from the
 * room. SQL keeps no second copy: a room missing a key is refused
 * (`missing_setting`), never filled in, so changing a default here is the
 * whole change. A room keeps the values it was created with.
 *
 * Kept as variables, not constants baked into screens, so a future setup
 * screen or a tournament can write different values into the same slot.
 */
import type { Json } from '@/types/database.types';

/** The keys the database reads from `rooms.settings`. Never rename once rooms exist. */
export const RACE_SETTING_KEYS = ['base', 'break_rule', 'game_type'] as const;

/**
 * - `base`: games to win, the same for both players (a race to 5).
 * - `break_rule`: `winner_breaks` — whoever wins a game breaks the next.
 * - `game_type`: `eight_ball` — what the scoring dialog names the game.
 */
export const RACE_DEFAULT_SETTINGS: Record<(typeof RACE_SETTING_KEYS)[number], Json> = {
  base: 5,
  break_rule: 'winner_breaks',
  game_type: 'eight_ball',
};
