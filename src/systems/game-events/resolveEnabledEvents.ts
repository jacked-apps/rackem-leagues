/**
 * @fileoverview Resolve which game events should render in the scoring modal
 * for a given game type, given the league's resolved enabled-events cascade.
 *
 * Layering (from lowest precedence to highest):
 *   1. Registry default (`event.enabledByDefault[gameType]`)
 *   2. Cascade map (org -> league `enabled_events` jsonb merge from the
 *      `resolved_league_preferences` view) — explicit `true` or `false` per
 *      event name overrides the registry default; absent keys inherit.
 *
 * Phase 1 ships with `cascadeMap` always equal to `{}` (no `enabled_events`
 * column yet), so every call falls through to the registry defaults — which
 * Phase 1 has locked to match today's modal exactly.
 *
 * Phase 2 wires `cascadeMap` to the resolved view's `enabled_events` jsonb
 * column so LOs can override per-event, per-org or per-league.
 *
 * Role gating (e.g., `winnerRequired: 'breaker'`) and mutual exclusion are
 * NOT applied here — those are runtime checks the modal performs at render
 * time based on current scoring state. This function only answers "is this
 * event enabled at all for this game type?"
 *
 * @see docs/plans/2026-05-09-001-feat-scoring-event-registry-plan.md (Unit 1)
 */

import type { GameType } from '@/types/league';
import { listGameEvents } from './index';
import type { GameEventDefinition } from './types';

/**
 * Sparse map of `event_name -> explicit boolean`. Absent keys mean "inherit
 * from the registry default." Sourced from the `resolved_league_preferences`
 * view's `enabled_events` jsonb in Phase 2; always `{}` in Phase 1.
 */
export type EnabledEventsCascadeMap = Readonly<Record<string, boolean>>;

/**
 * Returns the set of event definitions that should render in the modal for
 * the given game type, after applying the cascade overrides and the
 * registry's gameTypes filter.
 *
 * Output is a Set keyed by `event.name` for cheap membership checks at
 * modal-render time.
 */
export function resolveEnabledEvents(
  cascadeMap: EnabledEventsCascadeMap,
  gameType: GameType,
): ReadonlySet<string> {
  const enabled = new Set<string>();

  for (const event of listGameEvents()) {
    if (!event.gameTypes.includes(gameType)) continue;

    const override = cascadeMap[event.name];
    const isEnabled =
      override !== undefined ? override : event.enabledByDefault[gameType];

    if (isEnabled) {
      enabled.add(event.name);
    }
  }

  return enabled;
}

/**
 * Convenience: same as `resolveEnabledEvents` but returns the full
 * definition objects rather than just names. Useful for the modal which
 * needs the full definition (label, attributedTo, mutuallyExclusiveWith)
 * to render and behave correctly.
 */
export function resolveEnabledEventDefinitions(
  cascadeMap: EnabledEventsCascadeMap,
  gameType: GameType,
): ReadonlyArray<GameEventDefinition> {
  const enabledNames = resolveEnabledEvents(cascadeMap, gameType);
  return listGameEvents().filter(event => enabledNames.has(event.name));
}
