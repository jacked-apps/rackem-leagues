/**
 * @fileoverview Teams Wizard v2 Configuration
 *
 * First-season flow (2 steps):
 *   1. Venues — pick venues
 *   2. Captains & Teams — pick captains, auto-create one team per captain
 *
 * Next-season flow (4 steps with showIf gates):
 *   1. VenuesModeStep gate — "Same venues?" Keep/Change
 *   2. Venues (only when gate=change)
 *   3. CaptainsModeStep gate — "Same teams?" Keep/Change
 *   4. Captains & Teams (only when gate=change)
 *
 * The Keep gates snapshot the previous season's data so useSaveTeamsV2
 * has values without the editor steps rendering.
 */

import type { WizardConfig } from '@/components/wizard';
import { VenuesModeStep } from './steps/VenuesModeStep';
import { VenueSelectionStep } from './steps/VenueSelectionStep';
import { CaptainsModeStep } from './steps/CaptainsModeStep';
import { CaptainsTeamsStep } from './steps/CaptainsTeamsStep';
import type { TeamsWizardFormData } from './teamsWizardTypes';

export const teamsWizardConfig: WizardConfig<TeamsWizardFormData> = {
  id: 'teams-creation-v2',
  title: 'Teams',
  schemaVersion: 1,
  initialFormData: {},
  getSummaryItems: (formData) => {
    // Pull from the explicit step values first; fall back to the
    // gate-step snapshots when the editor steps were skipped via "Keep".
    const venuesGate = formData['venues-mode'];
    const captainsGate = formData['captains-mode'];
    const venueIds =
      (formData['venues'] as string[] | undefined) ?? venuesGate?.venueIds;
    const captains =
      (formData['captains'] as TeamsWizardFormData['captains']) ?? captainsGate?.captains;
    return [
      {
        label: 'Venues',
        value: venueIds?.length
          ? `${venueIds.length} venue${venueIds.length === 1 ? '' : 's'}`
          : undefined,
      },
      {
        label: 'Teams',
        value: captains?.length
          ? `${captains.length} team${captains.length === 1 ? '' : 's'}`
          : undefined,
      },
    ];
  },
  steps: [
    {
      id: 'venues-mode',
      title: 'Venues',
      // Next-season only — gate. Hidden in first-season flow.
      showIf: (fd) => {
        const ctx = (fd as Record<string, unknown>)._flowContext as
          | { previousSeasonVenueIds?: string[] }
          | undefined;
        return (ctx?.previousSeasonVenueIds?.length ?? 0) > 0;
      },
      component: VenuesModeStep as WizardConfig<TeamsWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'venues',
      title: 'Venues',
      // First-season flow: always shown.
      // Next-season flow: shown only when LO picked "Change" on the gate.
      showIf: (fd) => {
        const ctx = (fd as Record<string, unknown>)._flowContext as
          | { previousSeasonVenueIds?: string[] }
          | undefined;
        if (!ctx?.previousSeasonVenueIds?.length) return true; // first-season
        const gate = fd['venues-mode'];
        return gate?.mode === 'change';
      },
      validate: (value: unknown) => {
        const v = value as string[] | undefined;
        return v && v.length > 0 ? undefined : ['Select at least one venue'];
      },
      component: VenueSelectionStep as WizardConfig<TeamsWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'captains-mode',
      title: 'Teams',
      // Next-season only — gate. Hidden in first-season flow.
      showIf: (fd) => {
        const ctx = (fd as Record<string, unknown>)._flowContext as
          | { reupResponses?: unknown[] }
          | undefined;
        return (ctx?.reupResponses?.length ?? 0) > 0;
      },
      component: CaptainsModeStep as WizardConfig<TeamsWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'captains',
      title: 'Captains & Teams',
      // First-season flow: always shown.
      // Next-season flow: shown only when LO picked "Change" on the gate.
      showIf: (fd) => {
        const ctx = (fd as Record<string, unknown>)._flowContext as
          | { reupResponses?: unknown[] }
          | undefined;
        if (!ctx?.reupResponses?.length) return true; // first-season
        const gate = fd['captains-mode'];
        return gate?.mode === 'change';
      },
      validate: (value: unknown) => {
        const v = value as unknown[] | undefined;
        // Hard floor of 4. Anything fewer can't run a meaningful
        // round-robin season (you'd be playing the same one or two
        // opponents over and over). Belt-and-suspenders against the
        // "all teams removed" failure mode the operator just hit.
        return v && v.length >= 4
          ? undefined
          : ['A season needs at least 4 teams. Add captains below.'];
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
