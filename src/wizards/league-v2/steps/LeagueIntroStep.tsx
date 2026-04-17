/**
 * @fileoverview LeagueIntroStep — welcome/explanation step before questions begin
 *
 * Explains what a "league" is in this system and sets expectations:
 * - A league is a game + night combination
 * - It has recurring seasons
 * - This setup only needs to be done once for this combination
 * - Seasons, schedules, teams, and matchups come after
 */

import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

export function LeagueIntroStep(_props: WizardStepProps<unknown, LeagueWizardFormData>) {
  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-gray-700">
        A league represents a specific game and night combination — for
        example, &ldquo;8-Ball on Mondays.&rdquo; Once created, your
        league will have recurring seasons with their own schedules,
        teams, and matchups.
      </p>
      <p className="text-gray-700">
        This setup only needs to be done once. After this, you&rsquo;ll
        create new seasons under this league without repeating these steps.
      </p>
      <p className="text-sm text-gray-500">
        Click Next to get started. This should only take a minute.
      </p>
    </div>
  );
}
