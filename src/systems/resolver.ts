/**
 * @fileoverview SystemModule Resolver
 *
 * Maps a league's `handicap_type` string (as stored in `preferences.handicap_type`
 * and surfaced via the `resolved_league_preferences` view / useResolvedLeaguePrefs hook)
 * to the SystemModule that owns its behavior.
 *
 * Mapping:
 *   'points'     → bca3v3
 *   'percentage' → bca5v5
 *   'fargo'      → fargo5v5
 *   unmapped     → bca5v5 (fallback; see note)
 *
 * Fallback rationale: `handicap_type` is always chosen from shipped presets in
 * Wizard 2.0 (never user-typed), so unmapped values should only appear on
 * legacy leagues pre-lazy-migration. `bca5v5` preserves the current default
 * routing of `getGamesNeeded()` in src/utils/handicap/index.ts
 * (`'points' → 3v3 chart, everything else → 5v5 chart`). Changing the fallback
 * without auditing every existing caller would silently change behavior.
 */

import type { SystemModule } from './types';
import type { SystemOverrides } from '@/types/systemOverrides';
import type { ResolvedSystemConfig } from '@/types/resolvedSystemConfig';
import { bca3v3 } from './bca3v3';
import { bca5v5 } from './bca5v5';
import { fargo5v5 } from './fargo5v5';
import { buildSystemFromPreferences } from './buildSystemFromPreferences';

/**
 * Resolve a `handicap_type` string to its SystemModule.
 *
 * Logs a warning (console.warn) when the input is unmapped and the fallback
 * is applied — production telemetry should pick this up to identify any
 * legacy leagues whose `handicap_type` hasn't been backfilled.
 *
 * Used by the many call sites that only have a `handicap_type` string
 * (legacy paths). For full-preference resolution (modular axes beyond
 * `handicap_type`), prefer {@link resolveSystem} which delegates to
 * {@link buildSystemFromPreferences} and supports ad-hoc combos.
 */
export function pickModule(handicapType: string | null | undefined): SystemModule {
  switch (handicapType) {
    case 'points':
      return bca3v3;
    case 'percentage':
      return bca5v5;
    case 'fargo':
      return fargo5v5;
    default:
      console.warn(
        `[systems/resolver] Unmapped handicap_type ${JSON.stringify(handicapType)} — falling back to bca5v5`
      );
      return bca5v5;
  }
}

/**
 * Resolve a full preference snapshot to a SystemModule.
 *
 * Thin wrapper around {@link buildSystemFromPreferences} that exists at
 * the resolver-module boundary so callers don't have to know about the
 * builder file. Fast-paths to one of the three shipped presets when prefs
 * match; otherwise builds an ad-hoc module.
 *
 * @see Phase 5 Unit 5.1 in the modular-league plan.
 */
export function resolveSystem(
  prefs: ResolvedSystemConfig,
  overrides: SystemOverrides,
): SystemModule {
  return buildSystemFromPreferences(prefs, overrides);
}
