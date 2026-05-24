/**
 * @fileoverview Behind-Boost Handicap — ILLUSTRATIVE per-game allocator example.
 *
 * **This is NOT a real scoring system.** It exists to demonstrate the
 * per-game allocator's ability to read MULTIPLE state variables inside one
 * formula. It is intentionally unused by any prepackaged Scoring System, and
 * serves as:
 *   - A runnable reference for future LO-editing UI work
 *   - A worked example for the how-to documentation we'll write
 *   - Test coverage for the `state_diff_times_constant` operation in a full
 *     composition context (not just the unit test)
 *
 * **What it demonstrates:** the winner of each game earns more points when
 * their team is further behind on the win count — a "catch-up" handicap.
 * The formula reads two state variables in one expression:
 *
 *   winner_contribution = (total_games - home_wins) * 0.5
 *
 * - `total_games` — match-level state (from Team Geometry)
 * - `home_wins` — cumulative state (incremented per home win)
 *
 * (A real handicap would anchor this — e.g., `5 + (total_games - home_wins) * 0.5`
 * — so trailing teams don't get absurd per-game values. This example keeps the
 * raw form to illustrate the mechanism, not to be competitively sound. It also
 * only boosts the HOME side for illustration; a symmetric real version would
 * use per-side formulas.)
 *
 * **Composition shape:** just a per-game allocator. No thresholds, no
 * triggers, no aggregate — the allocator is a standalone piece, and this
 * example shows it in isolation.
 *
 * @see ../allocator-formula-operations/state-diff-times-constant.ts — the operation exercised
 */

// Importing this auto-registers the operation.
import '../allocator-formula-operations/state-diff-times-constant';

import { validatePointsSystem } from '../composition-validator';
import type { PointsSystem } from '../types';

/**
 * Build the illustrative behind-boost composition. No params — the multiplier
 * and var names are baked in to keep the example concrete.
 */
export function buildBehindBoostExample(): PointsSystem {
  const composition: PointsSystem = {
    name: 'behind_boost_example',
    thresholds: {},
    perGameAllocator: {
      name: 'behind_boost_per_game',
      // Winner gets (total_games - home_wins) * 0.5 — more when home trails.
      winner: {
        base: 0,
        formula: {
          operationKind: 'state_diff_times_constant',
          operationArgs: {
            minuend_var: 'total_games',
            subtrahend_var: 'home_wins',
            multiplier: 0.5,
          },
        },
      },
      // Loser gets nothing in this illustration.
      loser: { base: 0, formula: null },
    },
    triggers: [],
  };

  validatePointsSystem(composition);
  return composition;
}
