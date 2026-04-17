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
      component: ChampionshipStep as WizardConfig<ScheduleWizardFormData>['steps'][number]['component'],
    },
    {
      id: 'schedule-review',
      title: 'Review Schedule',
      subtitle: 'Review the weekly calendar, add blackout weeks for holidays or breaks',
      component: ScheduleWizardStep as WizardConfig<ScheduleWizardFormData>['steps'][number]['component'],
    },
  ],
};
