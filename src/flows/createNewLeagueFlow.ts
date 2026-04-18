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

const HANDICAP_LABELS: Record<string, string> = {
  points: 'Points (-1/+2)',
  percentage: 'Percentage (BCA)',
  fargo: 'Fargo Rating',
  none: 'No Handicap',
  custom_formula: 'Custom Formula',
};

const MATCH_FORMAT_LABELS: Record<string, string> = {
  double_round_robin: 'Double Round Robin',
  single_round_robin: 'Single Round Robin',
  individual_races: 'Individual Races',
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
    if (context.lineupSize) {
      items.push({ label: 'Lineup Size', value: String(context.lineupSize) });
    }
    if (context.rosterSize) {
      items.push({ label: 'Roster Size', value: String(context.rosterSize) });
    }
    if (context.handicapType) {
      items.push({
        label: 'Handicap',
        value: HANDICAP_LABELS[context.handicapType] ?? context.handicapType,
      });
    }
    if (context.matchFormat) {
      items.push({
        label: 'Match Format',
        value: MATCH_FORMAT_LABELS[context.matchFormat] ?? context.matchFormat,
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
