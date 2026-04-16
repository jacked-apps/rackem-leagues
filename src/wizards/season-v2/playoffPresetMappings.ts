/**
 * @fileoverview Maps wizard playoff presets to playoff_configurations fields
 *
 * Each preset locks in: weeks, qualification type, team count, matchup styles.
 * Wildcard is handled separately (checkbox in the wizard step).
 */

import type { QualificationType, MatchupStyle } from '@/hooks/playoff/usePlayoffSettingsReducer';

export interface PlayoffPresetMapping {
  playoffWeeks: number;
  qualificationType: QualificationType;
  fixedTeamCount?: number;
  qualifyingPercentage?: number;
  weekMatchupStyles: MatchupStyle[];
}

export const PLAYOFF_PRESET_MAPPINGS: Record<string, PlayoffPresetMapping> = {
  'none': {
    playoffWeeks: 0,
    qualificationType: 'all',
    weekMatchupStyles: [],
  },
  '1week_all': {
    playoffWeeks: 1,
    qualificationType: 'all',
    weekMatchupStyles: ['seeded'],
  },
  '1week_top4': {
    playoffWeeks: 1,
    qualificationType: 'fixed',
    fixedTeamCount: 4,
    weekMatchupStyles: ['seeded'],
  },
  '2week_top4': {
    playoffWeeks: 2,
    qualificationType: 'fixed',
    fixedTeamCount: 4,
    weekMatchupStyles: ['seeded', 'bracket'],
  },
  '2week_percentage': {
    playoffWeeks: 2,
    qualificationType: 'percentage',
    qualifyingPercentage: 50,
    weekMatchupStyles: ['seeded', 'bracket'],
  },
};
