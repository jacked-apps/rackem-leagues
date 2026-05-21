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
import { ChampionshipStep } from '@/wizards/schedule-v2/ChampionshipStep';
import type { SeasonWizardFormData } from './seasonWizardTypes';
import { parseLocalDate } from '@/utils/formatters';
import { generateSeasonName } from '@/types/season';
import { formatDayOfWeek, formatGameType, type DayOfWeek, type GameType } from '@/types/league';

const PLAYOFF_FORMAT_LABELS: Record<string, string> = {
  'none': 'No Playoffs',
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

/** Require a selection for steps that need one */
const requireSelection = (value: unknown) =>
  value ? undefined : ['Please make a selection'];

export const seasonWizardConfig: WizardConfig<SeasonWizardFormData> = {
  id: 'season-creation-v2',
  title: 'Create Season',
  schemaVersion: 1,
  initialFormData: {},
  getSummaryItems: (formData) => {
    // Additive summary — grows with each step so the LO sees the full picture
    // of what they're building. Derived rows (Start Date, Season Name) update
    // as upstream choices change.
    const intro = formData['intro'] as
      | { leagueStartDate?: string; hasExistingSeasons?: boolean }
      | undefined;
    const flowContext = (formData as Record<string, unknown>)._flowContext as
      | {
          leagueStartDate?: string;
          dayOfWeek?: string;
          gameType?: string;
          division?: string;
        }
      | undefined;

    // Start date: additive — appears only after the user has actually
    // committed to one. For the next-season flow, that's the dedicated
    // start-date step. For first-season, the intro IS the start-date
    // confirmation (operator already saw it on the league-create step
    // and is acknowledging here).
    const isNextSeason = !!intro?.hasExistingSeasons;
    const startDateStr = isNextSeason
      ? (formData['season-start-date'] as string | undefined)
      : intro?.leagueStartDate;

    // Derived season name — same formula as `useCreateSeasonV2`, so the
    // summary mirrors what will actually get saved.
    let derivedSeasonName: string | undefined;
    if (startDateStr && flowContext?.dayOfWeek && flowContext?.gameType) {
      try {
        derivedSeasonName = generateSeasonName(
          parseLocalDate(startDateStr),
          formatDayOfWeek(flowContext.dayOfWeek as DayOfWeek),
          formatGameType(flowContext.gameType as GameType),
          flowContext.division,
        );
      } catch {
        derivedSeasonName = undefined;
      }
    }

    // Additive gating — each row appears only after the user has
    // visited the step that owns it. Each step's mount-useEffect
    // writes a default to formData, so the presence of the formData
    // slice IS the "user has been here" signal.
    const lengthValue = formData['season-length'] as number | undefined;
    const playoffValue = formData['playoff-format'] as
      | { format?: string; wildcard?: boolean }
      | undefined;

    // Season Name shows only when all upstream answers are committed.
    const showSeasonName =
      !!derivedSeasonName && lengthValue != null && !!playoffValue?.format;

    return [
      {
        label: 'Start Date',
        value: startDateStr ? formatDateForSummary(startDateStr) : undefined,
      },
      {
        label: 'Regular Season',
        value: lengthValue != null ? `${lengthValue} weeks` : undefined,
      },
      { label: 'Playoffs', value: formatPlayoffFormat(playoffValue) },
      { label: 'Season Name', value: showSeasonName ? derivedSeasonName : undefined },
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
      // Always shown. The step component handles its own
      // "Keep / Change" UI from previousSeasonLength in flow context
      // (next-season flow) or falls back to a bare NumberStepper
      // (first-season flow).
      component: SeasonLengthStep as WizardConfig<SeasonWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'playoff-format',
      title: 'Playoffs',
      // Always shown. Same self-contained Keep/Change pattern as
      // the length step.
      validate: (value: unknown) => {
        const v = value as { format?: string } | undefined;
        return v?.format ? undefined : ['Please select a playoff format'];
      },
      component: PlayoffFormatStep as WizardConfig<SeasonWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'championships',
      title: 'Championships',
      // Next-season only — championship tracking belongs alongside
      // the other "are last season's settings still right?" gates.
      // First-season flow keeps championship in the Schedule wizard
      // where it ties to schedule building.
      // Hidden when nothing is tracked (showIf returns false), so
      // operators who opted out never see it.
      showIf: (fd) => {
        const ctx = (fd as Record<string, unknown>)._flowContext as
          | { championshipTracking?: { trackBca: boolean; trackApa: boolean } }
          | undefined;
        if (!ctx?.championshipTracking) return false;
        return ctx.championshipTracking.trackBca || ctx.championshipTracking.trackApa;
      },
      component: ChampionshipStep as WizardConfig<SeasonWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'review',
      title: 'Review',
      component: ReviewStep as WizardConfig<SeasonWizardFormData>['steps'][number]['component'],
    },
  ],
};
