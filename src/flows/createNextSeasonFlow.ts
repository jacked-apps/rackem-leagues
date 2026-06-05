/**
 * @fileoverview "Create Next Season" Flow Configuration
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
import { parseLocalDate } from '@/utils/formatters';

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

/** Compact date for summary cells: "Thu, May 28, 2026". */
function formatDateForSummary(isoDate: string): string {
  const date = parseLocalDate(isoDate);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Title-case a single word ("monday" → "Monday"). */
function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}


export const createNextSeasonFlow: WizardFlowConfig = {
  id: 'create-next-season',
  title: 'Create Next Season',
  // Cumulative summary — same shape as createNewLeagueFlow so the
  // header always shows the same info regardless of which entry
  // point the operator came through.
  getContextSummaryItems: (context) => {
    // Additive summary: each fact only appears once it's known. The order
    // below is the order the LO sees as they progress, so the panel reads
    // top-down like a story of what's been built.
    const items = [];

    // League identity (always known on entry)
    if (context.leagueName) {
      items.push({ label: 'League', value: context.leagueName });
    }
    if (context.dayOfWeek) {
      items.push({ label: 'Night', value: titleCase(context.dayOfWeek) });
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

    // Season facts — appear progressively as Stage 1 commits
    if (context.seasonName) {
      items.push({ label: 'Season Name', value: context.seasonName });
    }
    if (context.seasonStartDate) {
      items.push({ label: 'Start Date', value: formatDateForSummary(context.seasonStartDate) });
    }
    if (context.seasonLength) {
      items.push({ label: 'Season Length', value: `${context.seasonLength} weeks` });
    }
    if (context.playoffWeeks != null) {
      items.push({
        label: 'Playoffs',
        value: context.playoffWeeks > 0
          ? `${context.playoffWeeks} week${context.playoffWeeks === 1 ? '' : 's'}`
          : 'None',
      });
    }
    // Championship Tracking — only show ONCE Stage 1 has committed
    // (seasonId set means the upcoming season exists in DB). Before
    // that, `context.championshipTracking` is just the carried-over
    // org-level preference; emitting it would look like a pre-confirmed
    // choice the operator never made. During Stage 1 the row is owned
    // by `seasonWizardConfig.getSummaryItems` (reads formData) so the
    // operator sees their pick the moment they click Keep/Change.
    if (context.seasonId && context.championshipTracking) {
      const c = context.championshipTracking;
      const orgs = [c.trackBca && 'BCA', c.trackApa && 'APA'].filter(Boolean);
      items.push({
        label: 'Championship Tracking',
        value: orgs.length === 0 ? 'None' : orgs.join(' + '),
      });
    }

    // Schedule fact — set once Stage 2 commits weeks
    if (context.scheduleComplete) {
      items.push({ label: 'Schedule', value: 'Saved' });
    }

    // Teams facts — set once Stage 3 commits. The guards use `!= null`
    // (not just truthy) so a 0 still surfaces — that's how the operator
    // catches a broken Stage-3 save where the wizard advanced with no
    // teams created. Pre-Stage-3 the detection hook leaves these as
    // `undefined`, so the rows correctly stay hidden.
    if (context.venueCount != null) {
      items.push({
        label: 'Venues',
        value: `${context.venueCount} venue${context.venueCount === 1 ? '' : 's'}`,
      });
    }
    if (context.teamCount != null) {
      items.push({
        label: 'Teams',
        value: `${context.teamCount} team${context.teamCount === 1 ? '' : 's'}`,
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
