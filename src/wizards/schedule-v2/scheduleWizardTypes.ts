/**
 * @fileoverview Schedule Wizard types
 */

import type { WeekEntry } from '@/types/season';

export interface ScheduleWizardFormData {
  /** Step: ChampionshipStep — BCA/APA conflict tracking */
  'championships'?: { trackBca: boolean; trackApa: boolean };
  /** The generated/edited schedule from ScheduleReview */
  'schedule-review'?: WeekEntry[];
}
