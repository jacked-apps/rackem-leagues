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
}
