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
import { SeasonSettingsModeStep } from './steps/SeasonSettingsModeStep';
import { SeasonLengthStep } from './steps/SeasonLengthStep';
import { PlayoffFormatStep } from './steps/PlayoffFormatStep';
import {
  ChampionshipModeStep,
  ChampionshipEditStep,
} from '@/wizards/schedule-v2/ChampionshipStep';
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
    //
    // The gate-step ("season-settings-mode") snapshots length + playoff
    // when the LO picks "Keep". We treat that snapshot as the committed
    // answers for the two hidden steps — so the summary still grows
    // row-by-row even when they're skipped via the gate.
    const gate = formData['season-settings-mode'];
    const lengthValue =
      (formData['season-length'] as number | undefined) ?? gate?.length;
    const playoffValue =
      (formData['playoff-format'] as { format?: string; wildcard?: boolean } | undefined) ??
      gate?.playoff;

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
      id: 'season-settings-mode',
      title: 'Settings',
      // Combined "length + playoff" gate. Only next-season flows see
      // it — first-season flows have nothing to "keep" so they go
      // straight to the individual length + playoff steps.
      showIf: (fd) => {
        const ctx = (fd as Record<string, unknown>)._flowContext as
          | { previousSeasonLength?: number }
          | undefined;
        return ctx?.previousSeasonLength != null;
      },
      component: SeasonSettingsModeStep as WizardConfig<SeasonWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'season-length',
      title: 'Season Length',
      // First-season flow: always shown.
      // Next-season flow: hidden when the LO picked "Keep both" on the
      // gate step (defaults snapshotted there and read by
      // useCreateSeasonV2). Visible when the gate's mode is 'change'.
      showIf: (fd) => {
        const ctx = (fd as Record<string, unknown>)._flowContext as
          | { previousSeasonLength?: number }
          | undefined;
        if (ctx?.previousSeasonLength == null) return true; // first-season
        const gate = fd['season-settings-mode'];
        return gate?.mode === 'change';
      },
      component: SeasonLengthStep as WizardConfig<SeasonWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'playoff-format',
      title: 'Playoffs',
      // Same visibility as season-length.
      showIf: (fd) => {
        const ctx = (fd as Record<string, unknown>)._flowContext as
          | { previousSeasonLength?: number }
          | undefined;
        if (ctx?.previousSeasonLength == null) return true; // first-season
        const gate = fd['season-settings-mode'];
        return gate?.mode === 'change';
      },
      validate: (value: unknown) => {
        const v = value as { format?: string } | undefined;
        return v?.format ? undefined : ['Please select a playoff format'];
      },
      component: PlayoffFormatStep as WizardConfig<SeasonWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'championships-mode',
      title: 'Championships',
      // Next-season only — gate step. Mirrors `season-settings-mode`:
      // Keep snapshots current tracking + advances; Change advances
      // to the editor below.
      // First-season flow keeps championship in the Schedule wizard
      // (different config) since it ties to schedule building.
      showIf: (fd) => {
        const ctx = (fd as Record<string, unknown>)._flowContext as
          | { championshipTracking?: { trackBca: boolean; trackApa: boolean } }
          | undefined;
        return !!ctx?.championshipTracking;
      },
      component: ChampionshipModeStep as WizardConfig<SeasonWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'championships-edit',
      title: 'Edit Tracking',
      // Only shown when the LO picked "Change" on the championships-mode
      // gate. Same pattern as season-length / playoff-format vs the
      // settings-mode gate.
      showIf: (fd) => {
        const ctx = (fd as Record<string, unknown>)._flowContext as
          | { championshipTracking?: { trackBca: boolean; trackApa: boolean } }
          | undefined;
        if (!ctx?.championshipTracking) return false;
        const gate = fd['championships-mode'];
        return gate?.mode === 'change';
      },
      component: ChampionshipEditStep as WizardConfig<SeasonWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'review',
      title: 'Review',
      component: ReviewStep as WizardConfig<SeasonWizardFormData>['steps'][number]['component'],
    },
  ],
};
