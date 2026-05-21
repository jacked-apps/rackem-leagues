/**
 * @fileoverview Points System runtime evaluator.
 *
 * Walks a complete PointsSystem composition over a sequence of games,
 * producing the final per-side per-match points (and any other variables
 * triggers wrote to the match-state bag).
 *
 * **Three phases per match (driven by `trigger.type`):**
 *
 * 1. **Match-start phase.** Resolve all thresholds and write each into the
 *    state bag under its name (thresholds are state setters). Initialize
 *    per-side variables (home_wins / away_wins / home_points / away_points = 0).
 *    Fire all `match_start` triggers in `order.number` order.
 *
 * 2. **Per-game phase.** For each stored game record (chronological order):
 *    a. Increment the winning side's `*_wins` variable
 *    b. Fire `anytime` triggers with `order.beforeAllocator === true`
 *       (sorted by `order.number`)
 *    c. If a per-game allocator is configured, run it; add winner_contribution
 *       to the winner's points, loser_contribution to the loser's
 *    d. Increment games_played
 *    e. Fire `anytime` triggers with `order.beforeAllocator === false`
 *       (sorted by `order.number`)
 *
 * 3. **Match-end phase.** Fire all `match_end` triggers (sorted by
 *    `order.number`). End-of-match scoring (e.g. Points 3-Man) is just match_end
 *    triggers — there is no separate aggregate step.
 *
 * **NEVER-BREAK CONTRACT (load-bearing).** The runtime must NEVER throw on bad
 * math/data. When a trigger's condition or action can't evaluate (the
 * never-throw evaluators return `{ ok: false }`), we `console.warn` the reason
 * plus the trigger name and SKIP that trigger's action (no write) — then keep
 * going. The whole per-trigger body is wrapped so one bad trigger can't crash a
 * live match (games won/lost is the sacred metric and must keep recording).
 *
 * @see ./types.ts — PointsSystem composition shape
 * @see ./condition-evaluator.ts — never-throw condition check
 * @see ./expression-evaluator.ts — never-throw action arithmetic
 * @see docs/league-system/modules/points-system/trigger.md — the locked Trigger model
 */

import { evaluateAllocator } from './allocator-evaluator';
import { evaluateCondition } from './condition-evaluator';
import { evaluateExpression } from './expression-evaluator';
import { resolveAllThresholds } from './threshold-helpers';
import type {
  MatchStateBag,
  PointsSystem,
  ThresholdInputs,
  Trigger,
} from './types';

/**
 * Per-game record fed to the runtime. Mirrors AllocatorGameRecord with the
 * addition that the runtime only requires the winnerSide here; counter
 * inputs only matter if the composition has a per-game allocator with
 * counter-kind sides.
 */
export interface RuntimeGameRecord {
  winnerSide: 'home' | 'away';
  winnerCounterInput: number | null;
  loserCounterInput: number | null;
}

/**
 * Final result of a points-system evaluation: the populated match-state bag.
 * Callers typically read `home_points` / `away_points` for the per-match
 * totals, but any other variables the composition wrote (chips, signals,
 * chart values for display, etc.) are also available.
 */
export type RuntimeResult = MatchStateBag;

/**
 * Stable sort by `order.number` ascending. (`Array.prototype.sort` is stable in
 * modern engines, so equal `order.number` triggers keep declaration order.)
 */
function byOrder(a: Trigger, b: Trigger): number {
  return a.order.number - b.order.number;
}

/**
 * Fire one trigger against the state bag, honoring the re-arm policy and the
 * NEVER-BREAK contract. Mutates `state` and `firedNames` in place.
 *
 * 1. Evaluate the condition; on evaluator failure → warn + skip (don't fire);
 *    on `false` → skip (condition not met).
 * 2. Re-arm gate: a `single_shot`/`manual` trigger that already fired is
 *    skipped; `periodic` always allowed. (`manual` reset support is future.)
 * 3. Run the action: `set` writes the literal directly; `expr` evaluates the
 *    arithmetic and, on evaluator failure, warns + skips the write.
 * 4. Record the fire in `firedNames`.
 *
 * The whole body is wrapped in try/catch as a final backstop: even an
 * unexpected throw cannot escape into the match loop.
 */
function fireTrigger(
  trigger: Trigger,
  state: MatchStateBag,
  firedNames: Set<string>,
): void {
  try {
    // 1. Condition.
    const cond = evaluateCondition(trigger.condition, state);
    if (!cond.ok) {
      console.warn(
        `[points-system] trigger "${trigger.name}": condition not evaluable — ${cond.reason}; skipping`,
      );
      return;
    }
    if (cond.value === false) return; // condition not met

    // 2. Re-arm gate. periodic always re-fires; single_shot/manual fire once.
    if (trigger.rearm !== 'periodic' && firedNames.has(trigger.name)) return;

    // 3. Action.
    if (trigger.action.value.kind === 'set') {
      state[trigger.action.target] = trigger.action.value.value;
    } else {
      const r = evaluateExpression(trigger.action.value.expr, state);
      if (!r.ok) {
        console.warn(
          `[points-system] trigger "${trigger.name}": action expression not evaluable — ${r.reason}; skipping write`,
        );
        return;
      }
      state[trigger.action.target] = r.value;
    }

    // 4. Record the fire (drives the single_shot/manual re-arm gate above).
    firedNames.add(trigger.name);
  } catch (e) {
    // Final backstop — the never-throw evaluators shouldn't get here, but the
    // sacred-metric invariant means we swallow anything unexpected.
    console.warn(
      `[points-system] trigger "${trigger.name}": unexpected error while firing — ${
        e instanceof Error ? e.message : String(e)
      }; skipping`,
    );
  }
}

/**
 * Fire a list of triggers (already filtered + sorted) against the state bag.
 */
function fireAll(
  triggers: readonly Trigger[],
  state: MatchStateBag,
  firedNames: Set<string>,
): void {
  for (const trigger of triggers) fireTrigger(trigger, state, firedNames);
}

/**
 * Evaluate a PointsSystem composition over a match.
 *
 * @param composition The Points System (named thresholds, optional allocator, triggers, optional aggregate)
 * @param thresholdInputs Inputs for threshold resolution at match start (lineups, prefs, etc.)
 * @param games Per-game records in chronological order
 * @returns Final match-state bag with home_points/away_points and any other written variables
 */
export function evaluatePointsSystem(
  composition: PointsSystem,
  thresholdInputs: ThresholdInputs,
  games: readonly RuntimeGameRecord[],
): RuntimeResult {
  const state: MatchStateBag = {
    home_wins: 0,
    away_wins: 0,
    home_points: 0,
    away_points: 0,
    // Match-level state exposed to allocator formulas + triggers via the
    // universal state bag (per the locked Composability principle). Set at
    // match start from Team Geometry's gameCount.
    games_played: 0,
    total_games: thresholdInputs.gameCount,
  };

  // Re-arm bookkeeping: names of triggers that have already fired (drives the
  // single_shot/manual gate). One set for the whole match.
  const firedNames = new Set<string>();

  // Resolve all thresholds once at match start.
  const thresholdValues = resolveAllThresholds(
    composition.thresholds,
    thresholdInputs,
  );

  // Thresholds are state setters (locked Trigger model): each resolved value is
  // written into the state bag under its name at match start, before any trigger
  // fires. Consumers (triggers, the end-of-match scoring pattern) read these by
  // name from the bag — "thresholds resolve → then triggers fire."
  for (const [name, value] of Object.entries(thresholdValues)) {
    state[name] = value;
  }

  // Pre-partition triggers by type/group once (cheap, and keeps the per-game
  // loop tidy).
  const matchStartTriggers = composition.triggers
    .filter((t) => t.type === 'match_start')
    .sort(byOrder);
  const anytimeBefore = composition.triggers
    .filter((t) => t.type === 'anytime' && t.order.beforeAllocator)
    .sort(byOrder);
  const anytimeAfter = composition.triggers
    .filter((t) => t.type === 'anytime' && !t.order.beforeAllocator)
    .sort(byOrder);
  const matchEndTriggers = composition.triggers
    .filter((t) => t.type === 'match_end')
    .sort(byOrder);

  // Phase 1: match start.
  fireAll(matchStartTriggers, state, firedNames);

  // Phase 2: per-game.
  for (let gameIndex = 0; gameIndex < games.length; gameIndex++) {
    const game = games[gameIndex]!;

    // Increment wins for the winning side BEFORE the allocator runs — the
    // allocator's formulas read state.<side>_wins and should see the
    // already-incremented value for the side that just won.
    const winnerKey = `${game.winnerSide}_wins`;
    state[winnerKey] = ((state[winnerKey] as number) ?? 0) + 1;

    // anytime triggers that must fire BEFORE the per-game allocator.
    fireAll(anytimeBefore, state, firedNames);

    // Run per-game allocator if present; add contributions to per-side points.
    // The allocator reads the state bag directly (formulas may reference any
    // state var — home_wins, games_played, total_games, etc.).
    if (composition.perGameAllocator) {
      const allocation = evaluateAllocator(
        composition.perGameAllocator,
        {
          winnerSide: game.winnerSide,
          winnerCounterInput: game.winnerCounterInput,
          loserCounterInput: game.loserCounterInput,
        },
        state,
      );
      const loserSide: 'home' | 'away' =
        game.winnerSide === 'home' ? 'away' : 'home';
      const winnerPointsKey = `${game.winnerSide}_points`;
      const loserPointsKey = `${loserSide}_points`;
      state[winnerPointsKey] =
        ((state[winnerPointsKey] as number) ?? 0) + allocation.winnerContribution;
      state[loserPointsKey] =
        ((state[loserPointsKey] as number) ?? 0) + allocation.loserContribution;
    }

    // Increment games_played so per-game triggers + future formulas see
    // the post-game state ("this is game N completed").
    state.games_played = ((state.games_played as number) ?? 0) + 1;

    // anytime triggers that must fire AFTER the per-game allocator (e.g.
    // milestone/win jumps that OVERWRITE the allocator's per-game add).
    fireAll(anytimeAfter, state, firedNames);
  }

  // Phase 3: match end. End-of-match scoring (e.g. Points 3-Man) is just
  // match_end triggers — there is no separate aggregate step.
  fireAll(matchEndTriggers, state, firedNames);

  return state;
}
