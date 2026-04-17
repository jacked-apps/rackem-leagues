/**
 * @fileoverview Matchups Wizard v2 Configuration
 *
 * Two-step wizard for the final "Matchups" stage of the Create New League flow:
 *   1. PositionsStep — shuffle / manually set each team's schedule position
 *   2. ReviewStep — auto-generates matches on mount if none exist, then renders
 *      week cards with per-week edit capability (reuses WeekEditorView).
 *
 * No stage handler is required — Step 2 generates on mount, and per-week edits
 * save themselves via the existing useUpdateMatch mutation.
 */

import type { WizardConfig } from '@/components/wizard';
import { PositionsStep } from './steps/PositionsStep';
import { ReviewStep } from './steps/ReviewStep';
import type { MatchupsWizardFormData, MatchupTeamPosition } from './matchupsWizardTypes';

export const matchupsWizardConfig: WizardConfig<MatchupsWizardFormData> = {
  id: 'matchups-creation-v2',
  title: 'Matchups',
  schemaVersion: 1,
  initialFormData: {},
  steps: [
    {
      id: 'positions',
      title: 'Team Positions',
      subtitle: 'Assign each team a schedule position — determines who plays who each week',
      validate: (value: unknown) => {
        const v = value as MatchupTeamPosition[] | undefined;
        return v && v.length >= 2 ? undefined : ['Teams must be loaded before continuing'];
      },
      component: PositionsStep as WizardConfig<MatchupsWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'review',
      title: 'Review Schedule',
      subtitle: 'Review the generated matchups. Click "Edit Week" to swap teams or venues.',
      // Hide default Back — going back with existing matches would desync from positions.
      // Users go back only via the "Reset Matchups" button, which wipes first.
      hideBack: true,
      // Hide Cancel — by the time the operator sees this step, matchups are already
      // saved to the DB. Cancel would just leave them here in an "upcoming" season
      // state, which is confusing. The PageHeader's "Back to Dashboard" is still
      // available if they truly need to bail out.
      hideCancel: true,
      // Confirm before activating the season. Emphasize that edits are still
      // possible afterward via the season schedule page.
      confirmOnNext: {
        title: 'Accept this schedule and activate the season?',
        message:
          'The season will move from "upcoming" to "active" and players can begin scoring matches.\n\nYou can still edit individual weeks later from the season schedule page — swap teams, change venues, or adjust tables whenever you need to. You don\'t have to have everything perfect right now.',
        confirmText: 'Yes, Activate Season',
        cancelText: 'Not Yet',
      },
      component: ReviewStep as WizardConfig<MatchupsWizardFormData>['steps'][number]['component'],
    },
  ],
};
