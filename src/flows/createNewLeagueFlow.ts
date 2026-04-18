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
import { seasonWizardConfig } from '@/wizards/season-v2/seasonWizardConfig';
import { scheduleWizardConfig } from '@/wizards/schedule-v2/scheduleWizardConfig';
import { teamsWizardConfig } from '@/wizards/teams-v2/teamsWizardConfig';
import { matchupsWizardConfig } from '@/wizards/matchups-v2/matchupsWizardConfig';

const LEAGUE_FORMAT_LABELS: Record<string, string> = {
  standard_3v3: 'Standard 3v3',
  fargo_5v5: 'Fargo 5v5',
  custom_5v5: 'Custom 5v5',
};

export const createNewLeagueFlow: WizardFlowConfig = {
  id: 'create-new-league',
  title: 'Create New League',
  // Cumulative summary: what's been committed from earlier stages.
  // Rendered above the active wizard's own summary so the user always
  // sees the full picture, not just in-progress choices.
  getContextSummaryItems: (context) => {
    const items = [];
    if (context.leagueName) {
      items.push({ label: 'League', value: context.leagueName });
    }
    if (context.leagueFormat) {
      items.push({
        label: 'Format',
        value: LEAGUE_FORMAT_LABELS[context.leagueFormat] ?? context.leagueFormat,
      });
    }
    if (context.leagueStartDate) {
      items.push({ label: 'Start Date', value: context.leagueStartDate });
    }
    if (context.seasonName) {
      items.push({ label: 'Season', value: context.seasonName });
    }
    if (context.seasonLength) {
      items.push({ label: 'Regular Season', value: `${context.seasonLength} weeks` });
    }
    if (context.playoffWeeks) {
      items.push({
        label: 'Playoff Weeks',
        value: String(context.playoffWeeks),
      });
    }
    return items;
  },
  stages: [
    {
      kind: 'wizard',
      id: 'league',
      title: 'League',
      wizard: leagueWizardConfig,
    },
    {
      kind: 'wizard',
      id: 'season',
      title: 'Season',
      wizard: seasonWizardConfig,
    },
    {
      kind: 'wizard',
      id: 'schedule',
      title: 'Schedule',
      wizard: scheduleWizardConfig,
    },
    {
      kind: 'wizard',
      id: 'teams',
      title: 'Teams',
      wizard: teamsWizardConfig,
    },
    {
      kind: 'wizard',
      id: 'matchups',
      title: 'Matchups',
      wizard: matchupsWizardConfig,
    },
  ],
};
