/**
 * @fileoverview composeMatchThresholds — system-agnostic match threshold composer.
 *
 * Single entry point for "given a match's resolved system config and its
 * (possibly post-swap) lineups, what are the six match-level threshold columns?"
 * Used by the lineup-swap recalibration flow to recompute thresholds after a
 * player swap, and available to any future caller that needs the same numbers.
 *
 * Architectural contract (R7 / [[feedback_match_ops_system_agnostic]]):
 * this operation-level helper NEVER branches on `handicap_type`. It builds a
 * SystemModule via `buildSystemFromPreferences` (the blessed dispatcher — the
 * only place that switches on system identity) and reads the resolved
 * `handicapMechanism`. It then dispatches on the *mechanism kind* — the
 * declared SHAPE of the handicap asymmetry — not on which scoring system this
 * is. A new handicap encoding plugged into the registry works here untouched.
 *
 * Parity: for the extended-finish (games axis) shape it delegates to
 * `calculateHandicapThresholds`, the exact helper match preparation uses, so
 * swap recalibration is byte-identical to the numbers a fresh prep would
 * produce — team-bonus handling and chart lookup both live in that helper,
 * which itself routes back through this mechanism via `getGamesNeeded`.
 *
 * @see src/systems/buildSystemFromPreferences.ts — the system-identity dispatcher
 * @see docs/plans/2026-06-02-001-feat-lineup-swap-recalibration-plan.md — Unit 2
 */

import { buildSystemFromPreferences } from '@/systems/buildSystemFromPreferences';
import { calculateHandicapThresholds } from '@/utils/calculateHandicapThresholds';
import type { ResolvedSystemConfig } from '@/types/resolvedSystemConfig';
import type { Lineup } from '@/types/match';

/**
 * The six match-level threshold columns written to the `matches` row. `null`
 * means "no threshold of this kind applies under the active mechanism."
 */
export interface ThresholdPayload {
  home_to_win: number | null;
  home_to_tie: number | null;
  home_to_lose: number | null;
  away_to_win: number | null;
  away_to_tie: number | null;
  away_to_lose: number | null;
}

/**
 * Inputs the composer needs. Lineups are passed in (not fetched) because the
 * swap flow computes thresholds for the POST-swap lineup before it is written
 * to the DB — the caller assembles the prospective lineup state.
 */
export interface ComposeThresholdsInput {
  /** Resolved per-match system config (from the resolved-prefs view / snapshot). */
  prefs: ResolvedSystemConfig;
  /** Home team's lineup (post-swap handicaps already applied by the caller). */
  homeLineup: Lineup;
  /** Away team's lineup (post-swap handicaps already applied by the caller). */
  awayLineup: Lineup;
  homeTeamId: string;
  awayTeamId: string;
  seasonId: string;
}

/** A fresh all-null payload — "no match-level thresholds apply." */
function neutralPayload(): ThresholdPayload {
  return {
    home_to_win: null,
    home_to_tie: null,
    home_to_lose: null,
    away_to_win: null,
    away_to_tie: null,
    away_to_lose: null,
  };
}

/** Non-null per-position player handicaps in lineup order (Fargo ratings, etc.). */
function extractRatings(lineup: Lineup): number[] {
  const row = lineup as Record<string, unknown>;
  return [1, 2, 3, 4, 5]
    .map((n) => row[`player${n}_handicap`])
    .filter((h): h is number => typeof h === 'number');
}

/**
 * Compose the six match-level thresholds for a match's current lineup state.
 *
 * @param input - resolved prefs + both lineups + team/season context
 * @returns the threshold payload to write to the match row
 */
export async function composeMatchThresholds(
  input: ComposeThresholdsInput,
): Promise<ThresholdPayload> {
  const { prefs, homeLineup, awayLineup, homeTeamId, awayTeamId, seasonId } = input;
  const overrides = prefs.overrides;

  const system = buildSystemFromPreferences(prefs, overrides);
  const mechanism = system.handicapMechanism;

  if (!mechanism) {
    // Unwired combo (no calibrated chart for this system) — the runtime keeps
    // playing with no handicap rather than throwing. Mirrors the resolver's
    // own graceful-degradation philosophy.
    console.warn(
      '[composeMatchThresholds] System resolved no handicap mechanism — returning neutral thresholds.',
    );
    return neutralPayload();
  }

  // Extended-finish on the games axis: stronger team needs more games to win.
  // Delegate to the prep helper for byte-identical numbers (it owns team-bonus
  // assembly and routes the chart lookup back through this same mechanism).
  if (mechanism.kind === 'extra_games') {
    const { homeThresholds, awayThresholds } = await calculateHandicapThresholds(
      homeLineup,
      awayLineup,
      homeTeamId,
      awayTeamId,
      seasonId,
      prefs.handicap_type,
    );
    return {
      home_to_win: homeThresholds.games_to_win,
      home_to_tie: homeThresholds.games_to_tie,
      home_to_lose: homeThresholds.games_to_lose,
      away_to_win: awayThresholds.games_to_win,
      away_to_tie: awayThresholds.games_to_tie,
      away_to_lose: awayThresholds.games_to_lose,
    };
  }

  // Per-pairing race-length adjustment is RESERVED — no shipping system uses it,
  // and it produces per-pairing race targets, not a match-level threshold trio.
  if (mechanism.kind === 'race_length_adjustment') {
    console.warn(
      '[composeMatchThresholds] race_length_adjustment has no match-level threshold mapping — returning neutral thresholds.',
    );
    return neutralPayload();
  }

  // Remaining kind: head-start on the points axis. The weaker team starts the
  // match with bonus points; recompute that credit fresh from the post-swap
  // ratings (silent recalibration — opponent approval is the consent point, no
  // renegotiation). The credit is stored in the weaker side's *_to_tie column;
  // the stronger side gets 0 (no head start); no win/lose threshold applies.
  const { startPointsForWeakerTeam, weakerTeam } = mechanism.compute(
    extractRatings(homeLineup),
    extractRatings(awayLineup),
    overrides,
  );
  return {
    home_to_win: null,
    home_to_tie: weakerTeam === 'home' ? startPointsForWeakerTeam : 0,
    home_to_lose: null,
    away_to_win: null,
    away_to_tie: weakerTeam === 'away' ? startPointsForWeakerTeam : 0,
    away_to_lose: null,
  };
}
