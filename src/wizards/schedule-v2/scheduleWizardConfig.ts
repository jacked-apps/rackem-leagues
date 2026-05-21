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
      // Only shown in the FIRST-time league flow — there, championship
      // tracking is part of building the schedule for the first time
      // (the operator is making the decision, not confirming it).
      //
      // For next-season runs, the championship "is this still right?"
      // confirmation now lives in the Season wizard (Stage 1) next to
      // the other settings gates, so Stage 2 jumps straight to the
      // schedule grid. The presence of `flowContext.championshipTracking`
      // is the "this is a next-season run" signal.
      showIf: (fd) => {
        const ctx = (fd as Record<string, unknown>)._flowContext as
          | { championshipTracking?: { trackBca: boolean; trackApa: boolean } }
          | undefined;
        // TEMP debug — remove after diagnosing why championship step
        // shows on next-season runs when it shouldn't.
        // eslint-disable-next-line no-console
        console.log('[scheduleWizardConfig] championships showIf', {
          hasCtx: !!ctx,
          championshipTracking: ctx?.championshipTracking,
          willShow: !ctx?.championshipTracking,
        });
        return !ctx?.championshipTracking;
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
