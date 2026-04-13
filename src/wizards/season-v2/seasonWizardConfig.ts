/**
 * @fileoverview Season Wizard v2 Configuration
 *
 * Steps: Intro → (Start Date — next season only) → Season Length → Playoff Weeks → Review
 *
 * The start date step only shows for subsequent seasons (showIf).
 * First seasons inherit the league's start date.
 *
 * The wizard needs a SeasonWizardContext to know the league ID, day of
 * week, start date, and whether this is the first season. This context
 * is injected via the intro step's initial value.
 */

import type { WizardConfig } from '@/components/wizard';
import { ReviewStep } from '@/components/wizard';
import { SeasonIntroStep } from './steps/SeasonIntroStep';
import { SeasonStartDateStep } from './steps/SeasonStartDateStep';
import { SeasonLengthStep } from './steps/SeasonLengthStep';
import { PlayoffFormatStep } from './steps/PlayoffFormatStep';
import type { SeasonWizardFormData } from './seasonWizardTypes';

const PLAYOFF_FORMAT_LABELS: Record<string, string> = {
  '1week_all': '1 Week — All Teams',
  '1week_top4': '1 Week — Top 4',
  '2week_top4': '2 Weeks — Top 4',
  '2week_percentage': '2 Weeks — Top 50%',
};

function formatPlayoffFormat(value: unknown): string | undefined {
  if (!value) return undefined;
  const v = value as { format?: string; wildcard?: boolean };
  if (!v.format) return undefined;
  const label = PLAYOFF_FORMAT_LABELS[v.format] ?? v.format;
  return v.wildcard ? `${label} + Wildcard` : label;
}

/** Require a selection for steps that need one */
const requireSelection = (value: unknown) =>
  value ? undefined : ['Please make a selection'];

export const seasonWizardConfig: WizardConfig<SeasonWizardFormData> = {
  id: 'season-creation-v2',
  title: 'Create Season',
  schemaVersion: 1,
  initialFormData: {},
  getSummaryItems: (formData) => {
    // First season: start date comes from the intro context (league start date)
    // Next season: start date comes from the date picker step
    const intro = formData['intro'] as { leagueStartDate?: string; hasExistingSeasons?: boolean } | undefined;
    const startDate = formData['season-start-date'] ?? intro?.leagueStartDate;

    return [
    {
      label: 'Start Date',
      value: startDate ?? undefined,
    },
    {
      label: 'Regular Season',
      value: formData['season-length'] ? `${formData['season-length']} weeks` : undefined,
    },
    {
      label: 'Playoffs',
      value: formatPlayoffFormat(formData['playoff-format']),
    },
  ];
  },
  steps: [
    {
      id: 'intro',
      title: 'Season Setup',
      component: SeasonIntroStep as WizardConfig<SeasonWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'season-start-date',
      title: 'Start Date',
      // Only show for subsequent seasons — first season inherits league date
      showIf: (fd) => {
        const intro = fd['intro'] as { hasExistingSeasons?: boolean } | undefined;
        return intro?.hasExistingSeasons === true;
      },
      validate: requireSelection,
      component: SeasonStartDateStep as WizardConfig<SeasonWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'season-length',
      title: 'Season Length',
      component: SeasonLengthStep as WizardConfig<SeasonWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'playoff-format',
      title: 'Playoffs',
      validate: (value: unknown) => {
        const v = value as { format?: string } | undefined;
        return v?.format ? undefined : ['Please select a playoff format'];
      },
      component: PlayoffFormatStep as WizardConfig<SeasonWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'review',
      title: 'Review',
      component: ReviewStep as WizardConfig<SeasonWizardFormData>['steps'][number]['component'],
    },
  ],
};
