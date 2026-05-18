/**
 * @fileoverview "Start Next Season" Flow Configuration
 *
 * Parallel to `createNewLeagueFlow` — same scaffold, same stage
 * components, but drops the League stage since the league already
 * exists. The 4 remaining stages are wired to the SAME wizard
 * configs the first-time flow uses, so any improvement to a stage
 * lands in both places automatically.
 *
 * Stages:
 *   1. Season (existing seasonWizardConfig)
 *   2. Schedule (existing scheduleWizardConfig)
 *   3. Teams (existing teamsWizardConfig)
 *   4. Matchups (existing matchupsWizardConfig)
 *
 * Pre-fill comes from the previous season's data — passed in as the
 * flow's `initialContext` when mounted by `NewSeasonFromPreviousPage`.
 */

import type { WizardFlowConfig } from '@/components/wizard';
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

export const createNextSeasonFlow: WizardFlowConfig = {
  id: 'create-next-season',
  title: 'Start Next Season',
  // Cumulative summary — same shape as createNewLeagueFlow so the
  // header always shows the same info regardless of which entry
  // point the operator came through.
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
    if (context.seasonName) {
      items.push({ label: 'Season', value: context.seasonName });
    }
    if (context.seasonLength) {
      items.push({ label: 'Regular Season', value: `${context.seasonLength} weeks` });
    }
    if (context.scheduleComplete) {
      items.push({ label: 'Schedule', value: 'Saved' });
    }
    if (context.teamCount) {
      items.push({
        label: 'Teams',
        value: `${context.teamCount} team${context.teamCount === 1 ? '' : 's'}`,
      });
    }
    if (context.venueCount) {
      items.push({
        label: 'Venues',
        value: `${context.venueCount} venue${context.venueCount === 1 ? '' : 's'}`,
      });
    }
    return items;
  },
  stages: [
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
