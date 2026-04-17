/**
 * @fileoverview Teams Wizard v2 Configuration
 *
 * Two-step wizard:
 *   1. Venue selection — pick venues from existing list or create new ones
 *   2. Captains & Teams — pick captains, auto-create one team per captain
 */

import type { WizardConfig } from '@/components/wizard';
import { VenueSelectionStep } from './steps/VenueSelectionStep';
import { CaptainsTeamsStep } from './steps/CaptainsTeamsStep';
import type { TeamsWizardFormData } from './teamsWizardTypes';

export const teamsWizardConfig: WizardConfig<TeamsWizardFormData> = {
  id: 'teams-creation-v2',
  title: 'Teams',
  schemaVersion: 1,
  initialFormData: {},
  getSummaryItems: (formData) => [
    {
      label: 'Venues',
      value: formData['venues']?.length
        ? `${formData['venues'].length} venue${formData['venues'].length === 1 ? '' : 's'}`
        : undefined,
    },
    {
      label: 'Teams',
      value: formData['captains']?.length
        ? `${formData['captains'].length} team${formData['captains'].length === 1 ? '' : 's'}`
        : undefined,
    },
  ],
  steps: [
    {
      id: 'venues',
      title: 'Venues',
      validate: (value: unknown) => {
        const v = value as string[] | undefined;
        return v && v.length > 0 ? undefined : ['Select at least one venue'];
      },
      component: VenueSelectionStep as WizardConfig<TeamsWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'captains',
      title: 'Captains & Teams',
      validate: (value: unknown) => {
        const v = value as unknown[] | undefined;
        return v && v.length >= 2 ? undefined : ['Add at least 2 captains'];
      },
      // Warn before advancing. Adding teams after the matchups step means
      // regenerating the entire schedule (positions + matchup table change).
      // The one forgiving case: if this league has an odd team count, a new
      // team fills the BYE slot without disturbing existing matchups.
      confirmOnNext: {
        title: 'Done adding teams?',
        message:
          'Once the matchup schedule is generated, adding a new team becomes difficult — you\'ll typically have to reset matchups and regenerate them with the new team included.\n\n(Exception: if your current team count is odd, a new team can fill the BYE slot without disturbing the generated schedule.)\n\nMake sure every team you know about is added before continuing.',
        confirmText: 'Yes, Continue to Matchups',
        cancelText: 'Add More Teams',
      },
      component: CaptainsTeamsStep as WizardConfig<TeamsWizardFormData>['steps'][number]['component'],
    },
  ],
};
