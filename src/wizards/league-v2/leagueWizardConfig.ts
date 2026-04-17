/**
 * @fileoverview League Wizard v2 Configuration
 *
 * THE CENTRAL CONFIG for the League Creation Wizard. This is where all
 * the steps are registered, ordered, and wired up.
 *
 * Two paths through the wizard:
 *   PRESET (fast): GameType → StartDate → Qualifier → Pick a preset → Review
 *   CUSTOM (longer): GameType → StartDate → Qualifier → Custom → LineupSize
 *                    → RosterSize → MatchFormat → HandicapSystem → Review
 *
 * Custom path steps use showIf: they only appear when formData['league-format']
 * === 'custom'. The shell handles this automatically — no routing needed.
 *
 * schemaVersion: bump this number if you change the form data shape or step
 * IDs in a way that would break saved localStorage data. It forces a fresh
 * start for users mid-wizard.
 *
 * getSummaryItems: maps form data to the live preview box that shows the
 * league name building in real time as the user answers questions.
 */

import type { WizardConfig } from '@/components/wizard';
import { ReviewStep } from '@/components/wizard';
import { LeagueIntroStep } from './steps/LeagueIntroStep';
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

/** Simple validator — blocks Next if nothing is selected */
const requireSelection = (value: unknown) =>
  value ? undefined : ['Please make a selection'];

export const leagueWizardConfig: WizardConfig<LeagueWizardFormData> = {
  id: 'league-creation-v2',
  title: 'Create New League',
  schemaVersion: 1,
  initialFormData: {},
  getSummaryItems: getLeagueSummaryItems,
  steps: [
    {
      id: 'intro',
      title: 'Create Your League',
      component: LeagueIntroStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'game-type',
      title: 'Game Type',
      validate: requireSelection,
      component: GameTypeStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'start-date',
      title: 'Start Date',
      validate: requireSelection,
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
      validate: requireSelection,
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
      validate: requireSelection,
      component: MatchFormatStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'handicap-system',
      title: 'Handicap System',
      showIf: (fd) => fd['league-format'] === 'custom',
      validate: requireSelection,
      component: HandicapSystemStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'review',
      title: 'Review',
      component: ReviewStep as WizardConfig<LeagueWizardFormData>['steps'][number]['component'],
    },
  ],
};
