/**
 * @fileoverview ChampionshipStep — BCA/APA conflict tracking preference
 *
 * Asks if the operator wants to track BCA and/or APA national championship
 * conflicts on their schedule. This is a league-level preference — set once,
 * carries forward to future seasons.
 *
 * Doesn't ask for specific dates. Dates are entered into the database
 * annually by admin. The schedule generator reads this preference and
 * flags championship weeks when dates overlap.
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { InfoButton } from '@/components/InfoButton';
import type { WizardStepProps } from '@/components/wizard';
import type { ScheduleWizardFormData } from './scheduleWizardTypes';

interface ChampionshipValue {
  trackBca: boolean;
  trackApa: boolean;
}

export function ChampionshipStep({
  value,
  onChange,
}: WizardStepProps<ChampionshipValue | undefined, ScheduleWizardFormData>) {
  const current = value ?? { trackBca: false, trackApa: false };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-1">
        <p className="font-medium text-foreground">National Championships</p>
        <InfoButton title="Championship Conflicts" size="sm">
          <p>
            BCA and APA hold national championships each year. If your
            players travel to compete, you may want to suspend league
            play for those weeks. Enable tracking here and championship
            weeks will be flagged on your schedule when dates overlap.
            You can always change this later in league settings.
          </p>
        </InfoButton>
      </div>

      <p className="text-foreground">
        Some leagues suspend play during national championships when
        players travel to compete. If you have a significant number
        of players who plan to attend, holding league nights during
        these events can lead to makeup matches or forfeits.
      </p>
      <p className="text-foreground">
        Would you like to track these potential conflicts on your schedule?
      </p>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Checkbox
            id="track-bca"
            checked={current.trackBca}
            onCheckedChange={(checked) =>
              onChange({ ...current, trackBca: checked === true })
            }
            className="size-5 border-2 border-gray-400"
          />
          <Label htmlFor="track-bca">
            Track BCA National Championship conflicts
          </Label>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="track-apa"
            checked={current.trackApa}
            onCheckedChange={(checked) =>
              onChange({ ...current, trackApa: checked === true })
            }
            className="size-5 border-2 border-gray-400"
          />
          <Label htmlFor="track-apa">
            Track APA National Championship conflicts
          </Label>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Championship dates are updated annually. If dates haven&rsquo;t
        been announced yet, conflicts will appear on your schedule once
        they&rsquo;re set.
      </p>
    </div>
  );
}
