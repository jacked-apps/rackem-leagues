/**
 * @fileoverview LeagueWizardFormData — shared type for the league creation wizard
 *
 * Holds the answers captured across all wizard steps. During the wizard,
 * these live in React state. After Finish, they're written to the database
 * (Phase 9: Dual-Write Mutation).
 *
 * Fields are added as steps are built. For now only GameType exists.
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
