/**
 * @fileoverview Classifies where a league's handicap thresholds will come
 * from, given the wizard answers so far. Drives `ThresholdSourceStep`'s copy.
 *
 * Kept out of the step component so that file exports only components
 * (keeps React fast-refresh working). Unit-tested directly.
 */

import type { LeagueWizardFormData } from '../leagueWizardTypes';

export type SourceClass =
  | 'tested_preset_3v3'
  | 'tested_preset_5v5'
  | 'fargo_start_points'
  | 'fargo_games_won'
  | 'manual_entry';

export function classifyThresholdSource(formData: LeagueWizardFormData): SourceClass {
  const handicapType = formData['handicap-system'];
  const winCondition = formData['win-condition'] ?? 'games';
  const mechanism = formData['mechanism'];
  const lineupSize = formData['lineup-size'];
  const matchFormat = formData['match-format'];

  // Tested Preset: BCA 3v3 (lineup=3, points handicap, double_round_robin)
  if (
    lineupSize === 3 &&
    matchFormat === 'double_round_robin' &&
    handicapType === 'points' &&
    mechanism === 'extra_games'
  ) {
    return 'tested_preset_3v3';
  }

  // Tested Preset: BCA 5v5 (lineup=5, percentage, single_round_robin)
  if (
    lineupSize === 5 &&
    matchFormat === 'single_round_robin' &&
    handicapType === 'percentage' &&
    mechanism === 'extra_games'
  ) {
    return 'tested_preset_5v5';
  }

  // Fargo + start_points + win_condition='points' (start-points-credit flow)
  if (handicapType === 'fargo' && (mechanism === 'start_points' || winCondition === 'points')) {
    return 'fargo_start_points';
  }

  // Fargo + games-won + extra_games (the formula from Unit 3.2)
  if (handicapType === 'fargo' && winCondition === 'games') {
    return 'fargo_games_won';
  }

  // Anything else: no calibrated source — captains adjust at lineup
  // lock or the LO opts into mechanism='none'.
  return 'manual_entry';
}
