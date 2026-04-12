/**
 * @fileoverview "Create New League" Flow Configuration
 *
 * The full 5-stage flow for setting up a new league from scratch:
 *   1. League (Wizard 2.0 — built on new framework)
 *   2. Season (placeholder — links to existing season wizard)
 *   3. Schedule (placeholder — links to existing schedule setup)
 *   4. Teams (placeholder — links to existing team management)
 *   5. Matchups (placeholder — links to existing schedule setup)
 *
 * Only Stage 1 is a real wizard. Stages 2-5 are placeholders that link
 * to the existing legacy pages. As each wizard gets rebuilt on the new
 * framework, its placeholder gets swapped to a wizard stage in this file.
 */

import type { WizardFlowConfig } from '@/components/wizard';
import { leagueWizardConfig } from '@/wizards/league-v2/leagueWizardConfig';

export const createNewLeagueFlow: WizardFlowConfig = {
  id: 'create-new-league',
  title: 'Create New League',
  stages: [
    {
      kind: 'wizard',
      id: 'league',
      title: 'League',
      wizard: leagueWizardConfig,
    },
    {
      kind: 'placeholder',
      id: 'season',
      title: 'Season',
      description: 'Your league has been created. The next step is to create your first season — set the length, playoff weeks, and tournament dates.',
      legacyRoute: '/league/:leagueId/create-season',
    },
    {
      kind: 'placeholder',
      id: 'schedule',
      title: 'Schedule',
      description: 'Your season is set. Now generate the weekly schedule — set blackout dates, holidays, and review the calendar.',
      legacyRoute: '/league/:leagueId/season/:seasonId/manage-schedule',
    },
    {
      kind: 'placeholder',
      id: 'teams',
      title: 'Teams',
      description: 'Your schedule is ready. Now create the teams that will compete this season and assign their rosters.',
      legacyRoute: '/league/:leagueId/manage-teams',
    },
    {
      kind: 'placeholder',
      id: 'matchups',
      title: 'Matchups',
      description: 'Teams are set. The final step is to generate the matchups — which teams play each other each week.',
      legacyRoute: '/league/:leagueId/season/:seasonId/schedule-setup',
    },
  ],
};
