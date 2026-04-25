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
import { bca3v3 } from './bca3v3';
import { bca5v5 } from './bca5v5';
import { fargo5v5 } from './fargo5v5';

/**
 * Resolve a `handicap_type` string to its SystemModule.
 *
 * Logs a warning (console.warn) when the input is unmapped and the fallback
 * is applied — production telemetry should pick this up to identify any
 * legacy leagues whose `handicap_type` hasn't been backfilled.
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
