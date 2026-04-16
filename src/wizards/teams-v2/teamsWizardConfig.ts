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
      component: CaptainsTeamsStep as WizardConfig<TeamsWizardFormData>['steps'][number]['component'],
    },
  ],
};
