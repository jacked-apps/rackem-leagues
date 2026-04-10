/**
 * @fileoverview Helper functions for the League Creation Wizard
 *
 * Derives values from the user's answers (day of week, season name, year)
 * that are used in the league name and summary display.
 */

import { parseLocalDate } from '@/utils/formatters';
import { formatGameType } from '@/types/league';
import { buildLeagueTitle } from '@/utils/leagueUtils';
import type { WizardSummaryItem } from '@/components/wizard';
import type { LeagueWizardFormData } from './leagueWizardTypes';

/**
 * Derive day of week, season name, and year from an ISO date string.
 * Used to build the auto-generated league name.
 */
export function deriveDateFields(isoDate: string) {
  const date = parseLocalDate(isoDate);

  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });

  const monthIndex = date.getMonth();
  const season =
    monthIndex >= 2 && monthIndex <= 4 ? 'Spring' :
    monthIndex >= 5 && monthIndex <= 7 ? 'Summer' :
    monthIndex >= 8 && monthIndex <= 10 ? 'Fall' : 'Winter';

  const year = date.getFullYear();

  return { dayOfWeek, season, year };
}

/** Map the format selection value to a display string for the summary */
export function formatLeagueFormat(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const map: Record<string, string> = {
    fargo_5v5: '5v5 Fargo Rated',
    standard_3v3: '3v3 Standard',
    standard_5v5: '5v5 Standard',
    custom: 'Custom',
  };
  return map[value] ?? value;
}

/** Map match format value to display string */
export function formatMatchFormat(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const map: Record<string, string> = {
    double_round_robin: 'Double Round Robin',
    single_round_robin: 'Single Round Robin',
    individual_races: 'Individual Races',
  };
  return map[value] ?? value;
}

/** Map handicap system value to display string */
export function formatHandicapSystem(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const map: Record<string, string> = {
    points: 'Points (-1/+2)',
    percentage: 'Percentage (BCA)',
    fargo: 'Fargo Rating',
    none: 'No Handicap',
    custom_formula: 'Custom Formula',
  };
  return map[value] ?? value;
}

/** Build the summary items list from form data */
export function getLeagueSummaryItems(formData: LeagueWizardFormData): WizardSummaryItem[] {
  const dateFields = formData['start-date']
    ? deriveDateFields(formData['start-date'])
    : null;

  const qualifier = formData['qualifier']?.trim() || null;

  const leagueName = buildLeagueTitle({
    gameType: formData['game-type'] ?? null,
    dayOfWeek: dateFields?.dayOfWeek ?? null,
    division: qualifier,
    season: dateFields?.season ?? null,
    year: dateFields?.year ?? null,
  });

  return [
    { label: 'League Name', value: leagueName || undefined },
    {
      label: 'Game Type',
      value: formData['game-type'] ? formatGameType(formData['game-type']) : undefined,
    },
    { label: 'Start Date', value: formData['start-date'] ?? undefined },
    { label: 'League Day', value: dateFields?.dayOfWeek ?? undefined },
    { label: 'Format', value: formatLeagueFormat(formData['league-format']) },
    ...(formData['league-format'] === 'custom'
      ? [
          { label: 'Lineup Size', value: formData['lineup-size']?.toString() },
          { label: 'Roster Size', value: formData['roster-size']?.toString() },
          { label: 'Match Format', value: formatMatchFormat(formData['match-format']) },
          { label: 'Handicap', value: formatHandicapSystem(formData['handicap-system']) },
        ]
      : []),
  ];
}
