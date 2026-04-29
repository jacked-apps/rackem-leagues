/**
 * @fileoverview LeagueWizardFormData — shared type for the league creation wizard
 *
 * Holds the answers captured across all wizard steps. Keys match the step
 * IDs in leagueWizardConfig.ts (e.g., 'game-type' matches the GameTypeStep).
 *
 * During the wizard, this lives in React state + localStorage scratch.
 * After Finish, it gets written to the database via the dual-write mutation
 * (writes to both existing leagues columns AND new modular preferences columns).
 *
 * Custom path fields (lineup-size, roster-size, etc.) are only populated
 * when the user picks "Custom" format. For presets, these stay undefined
 * and the mutation maps the preset to the correct values.
 */

import type { GameType } from '@/types/league';

export interface LeagueWizardFormData {
  /** Step: GameTypeStep */
  'game-type'?: GameType;

  /** Step: StartDateStep */
  'start-date'?: string;

  /** Step: QualifierStep (optional descriptor) */
  'qualifier'?: string;

  /** Step: LeagueFormatStep (the 4 preset cards) */
  'league-format'?: string;

  /** Custom path steps — only captured when league-format === 'custom' */
  'lineup-size'?: number;
  'roster-size'?: number;
  'match-format'?: string;
  'handicap-system'?: string;

  // Phase 4 Unit 4.1 — additional modular axes (custom path only).
  // Each step's id matches the form-data key (canonical wizard convention).
  /** Step: PairingFormatStep — single_rack | race_to_n */
  'pairing-format'?: string;
  /** Step: ScoringMethodStep — winner_takes_all | points_10_7 | race_winner */
  'scoring-method'?: string;
  /** Step: WinConditionStep — first_to_games | first_to_pairings | highest_after_all_games | total_points_target */
  'win-condition'?: string;
  /** Step: MechanismStep — extra_games | start_points | race_length_adjustment | none */
  'mechanism'?: string;
  /** Step: StandingsSortStep — preset key for the sort priority list */
  'standings-sort'?: string;
  /** Step: TiebreakerStep — combined trigger+format key (accept_tie / best_of_3 / single_short_race) */
  'tiebreaker'?: string;
  /** Step: PairingFormatStep — race_length (only when pairing-format === 'race_to_n') */
  'race-length'?: number;
}
