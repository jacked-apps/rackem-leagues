/**
 * @fileoverview League Wizard v2 Configuration
 *
 * Defines the steps, schema version, and initial form data for the
 * League Creation Wizard. Steps are added incrementally as they're built.
 *
 * Currently: GameTypeStep (real) + DummyTextStep (placeholder)
 * Eventually: GameType → StartDate → Qualifier → LeagueFormat → (Custom path)
 */

import type { WizardConfig } from '@/components/wizard';
import { ReviewStep } from '@/components/wizard';
import { GameTypeStep } from './steps/GameTypeStep';
import { StartDateStep } from './steps/StartDateStep';
import { QualifierStep } from './steps/QualifierStep';
import { LeagueFormatStep } from './steps/LeagueFormatStep';
import { LineupSizeStep } from './steps/LineupSizeStep';
import { RosterSizeStep } from './steps/RosterSizeStep';
import { MatchFormatStep } from './steps/MatchFormatStep';
import { HandicapSystemStep } from './steps/HandicapSystemStep';
import type { LeagueWizardFormData } from './leagueWizardTypes';
import { getLeagueSummaryItems } from './leagueWizardHelpers';

export const leagueWizardConfig: WizardConfig<LeagueWizardFormData> = {
  id: 'league-creation-v2',
  title: 'Create New League',
  schemaVersion: 1,
  initialFormData: {},
  getSummaryItems: getLeagueSummaryItems,
  steps: [
    {
      id: 'game-type',
      title: 'Game Type',
      component: GameTypeStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'start-date',
      title: 'Start Date',
      component: StartDateStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'qualifier',
      title: 'Division Descriptor',
      optional: true,
      component: QualifierStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'league-format',
      title: 'League Format',
      component: LeagueFormatStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    // Custom path — only shown when user picks "Custom" format
    {
      id: 'lineup-size',
      title: 'Lineup Size',
      showIf: (fd) => fd['league-format'] === 'custom',
      component: LineupSizeStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'roster-size',
      title: 'Roster Size',
      showIf: (fd) => fd['league-format'] === 'custom',
      component: RosterSizeStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'match-format',
      title: 'Match Format',
      showIf: (fd) => fd['league-format'] === 'custom',
      component: MatchFormatStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'handicap-system',
      title: 'Handicap System',
      showIf: (fd) => fd['league-format'] === 'custom',
      component: HandicapSystemStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'review',
      title: 'Review',
      component: ReviewStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
  ],
};
