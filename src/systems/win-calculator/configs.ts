/**
 * @fileoverview Win Calculator — code-defined config builder.
 *
 * Produces a {@link WinCalcConfig} from today's primitive `win_condition`
 * preference, reproducing the CURRENT winner behavior exactly. This is the
 * interim source of config until the workshop lets an LO author the dials as
 * data; it does NOT yet expose the most/met-goal choice — it maps the one
 * existing setting to a fixed config:
 *
 *   - `'games'`  → games comparator in `met_goal` mode
 *                  (reproduces `determineMatchResult`: per-side game targets)
 *   - `'points'` → points (`most`) then games (`most`)
 *                  (reproduces the inline points ternary: most points, games tiebreak)
 *
 * Canonical model: `docs/league-system/modules/win-calculator.md`.
 */

import type { WinCalcConfig } from './types';

/** `win_condition='games'` — decide by who reached their per-side game target. */
const GAMES_CONFIG: WinCalcConfig = {
  order: ['games'],
  games: { mode: 'met_goal' },
};

/** `win_condition='points'` — most points, then most games as the tiebreak. */
const POINTS_CONFIG: WinCalcConfig = {
  order: ['points', 'games'],
  points: { mode: 'most' },
  games: { mode: 'most' },
};

/**
 * Build the Win Calculator config for a league's `win_condition`.
 *
 * Reproduces today's fixed behavior. An unknown value falls back to the games
 * config with a single warning (graceful degradation — mirrors the
 * `buildSystemFromPreferences` resolver's unknown-value handling).
 *
 * @param winCondition the league's `win_condition` (`'games'` | `'points'`)
 */
export function buildWinCalcConfig(winCondition: string): WinCalcConfig {
  if (winCondition === 'games') return GAMES_CONFIG;
  if (winCondition === 'points') return POINTS_CONFIG;
  console.warn(
    `[buildWinCalcConfig] Unknown win_condition ${JSON.stringify(winCondition)} — defaulting to games config`,
  );
  return GAMES_CONFIG;
}
