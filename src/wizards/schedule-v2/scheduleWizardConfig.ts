/**
 * @fileoverview Schedule Wizard v2 Configuration
 *
 * Two-step wizard:
 *   1. ChampionshipStep — track BCA/APA conflicts? (affects what shows on schedule)
 *   2. ScheduleWizardStep — wraps existing ScheduleReview component
 */

import type { WizardConfig } from '@/components/wizard';
import { ChampionshipStep } from './ChampionshipStep';
import { ScheduleWizardStep } from './ScheduleWizardStep';
import type { ScheduleWizardFormData } from './scheduleWizardTypes';

export const scheduleWizardConfig: WizardConfig<ScheduleWizardFormData> = {
  id: 'schedule-creation-v2',
  title: 'Schedule',
  schemaVersion: 1,
  initialFormData: {},
  getSummaryItems: (formData) => {
    const champs = formData['championships'];
    const tracked: string[] = [];
    if (champs?.trackBca) tracked.push('BCA');
    if (champs?.trackApa) tracked.push('APA');
    return [
      {
        label: 'Championship Tracking',
        value: champs ? (tracked.length ? tracked.join(' & ') : 'None') : undefined,
      },
    ];
  },
  steps: [
    {
      id: 'championships',
      title: 'Championship Tracking',
      optional: true,
      // For next-season runs, skip this step entirely when the
      // operator isn't tracking either championship — they already
      // told us "don't bother" at first-league creation and we don't
      // re-ask every season. Visible in: (a) first-league runs (no
      // flowContext.championshipTracking) so they CAN opt in, or
      // (b) next-season runs where at least one is currently tracked
      // so they can confirm or change.
      showIf: (fd) => {
        const ctx = (fd as Record<string, unknown>)._flowContext as
          | { championshipTracking?: { trackBca: boolean; trackApa: boolean } }
          | undefined;
        if (!ctx?.championshipTracking) return true; // first-time flow
        return ctx.championshipTracking.trackBca || ctx.championshipTracking.trackApa;
      },
      component: ChampionshipStep as WizardConfig<ScheduleWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'schedule-review',
      title: 'Review Schedule',
      subtitle: 'Review the weekly calendar, add blackout weeks for holidays or breaks',
      component: ScheduleWizardStep as WizardConfig<ScheduleWizardFormData>['steps'][number]['component'],
      // ScheduleReview renders its own Previous / Save & Exit / Save & Continue
      // buttons with step-specific semantics (the replace-vs-keep dialog for
      // existing schedules can't be expressed through the shell's generic nav).
      // Suppress the shell's Back / Cancel / Next so we don't double-render.
      hideBack: true,
      hideCancel: true,
      hideNext: true,
    },
  ],
};
