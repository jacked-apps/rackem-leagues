/**
 * @fileoverview Matchups Wizard v2 Configuration
 *
 * Three-step wizard for the final "Matchups" stage of the flow:
 *   1. MatchupsModeStep — gate: "Fast-track or order teams myself?"
 *      Fast-track stashes pre-randomized positions on the gate slice
 *      and hides PositionsStep entirely.
 *   2. PositionsStep — shuffle / manually set positions (manual path only)
 *   3. ReviewStep — auto-generates matches on mount, renders week cards
 *      with per-week edit capability (reuses WeekEditorView). Reads
 *      positions from either the positions step OR the gate's stash.
 *
 * No stage handler is required — Step 3 generates on mount, and per-week
 * edits save themselves via the existing useUpdateMatch mutation.
 */

import type { WizardConfig } from '@/components/wizard';
import { MatchupsModeStep } from './steps/MatchupsModeStep';
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
      id: 'matchups-mode',
      title: 'Matchups',
      component: MatchupsModeStep as WizardConfig<MatchupsWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'positions',
      title: 'Team Positions',
      subtitle: 'Assign each team a schedule position — determines who plays who each week',
      // Hidden when the operator picked Fast-track on the gate.
      // PositionsStep gets bypassed entirely in that path; ReviewStep
      // reads the gate's pre-randomized positions instead.
      showIf: (fd) => fd['matchups-mode']?.mode !== 'fast',
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
      // state, which is confusing. The PageHeader's "Back to My Teams" is still
      // available if they truly need to bail out.
      hideCancel: true,
      // Confirm before activating the season. Emphasize that edits are still
      // possible afterward via the season schedule page.
      confirmOnNext: {
        title: 'Accept this schedule and finalize the season?',
        message:
          'If the start date is today or in the past, the season goes live immediately and players can begin scoring. If the start date is in the future, the season is queued — it goes live automatically on that date.\n\nEither way, you can still edit individual weeks later from the season schedule page — swap teams, change venues, or adjust tables whenever you need to. You don\'t have to have everything perfect right now.',
        confirmText: 'Yes, finalize',
        cancelText: 'Not yet',
      },
      component: ReviewStep as WizardConfig<MatchupsWizardFormData>['steps'][number]['component'],
    },
  ],
};
