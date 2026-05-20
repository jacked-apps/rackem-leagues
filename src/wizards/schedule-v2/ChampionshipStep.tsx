/**
 * @fileoverview ChampionshipStep — BCA/APA conflict tracking preference
 *
 * Two modes:
 *
 * 1. **Next-season mode** (when `_flowContext.championshipTracking`
 *    exists) — the operator already set this up when they created
 *    their first league. Show "Keep tracking — BCA (dates), APA (dates)"
 *    vs "Change" radio. Snapshots BCA/APA defaults so the next stage
 *    has values without forcing edits.
 *
 *    If the operator isn't tracking either championship, the
 *    schedule wizard's `showIf` skips this step entirely (configured
 *    in scheduleWizardConfig).
 *
 * 2. **First-time mode** — operator hasn't told us yet. Show the
 *    original checkbox UI.
 *
 * This is a league/operator-level preference — set once, carries
 * forward to future seasons. Dates are entered annually by admin
 * into `championship_date_options`.
 */

import { useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { InfoButton } from '@/components/InfoButton';
import type { WizardStepProps } from '@/components/wizard';
import type { ScheduleWizardFormData } from './scheduleWizardTypes';

interface ChampionshipValue {
  trackBca: boolean;
  trackApa: boolean;
}

interface FlowContextShape {
  championshipTracking?: {
    trackBca: boolean;
    trackApa: boolean;
    bcaDates?: string;
    apaDates?: string;
  };
}

export function ChampionshipStep({
  value,
  onChange,
  formData,
}: WizardStepProps<ChampionshipValue | undefined, ScheduleWizardFormData>) {
  const flowContext = (formData as Record<string, unknown>)._flowContext as
    | FlowContextShape
    | undefined;

  const tracking = flowContext?.championshipTracking;

  if (tracking) {
    return (
      <NextSeasonChampionshipPicker
        value={value}
        onChange={onChange}
        tracking={tracking}
      />
    );
  }

  return <FirstTimeChampionshipPicker value={value} onChange={onChange} />;
}

/** Original behavior — operator hasn't told us yet. */
function FirstTimeChampionshipPicker({
  value,
  onChange,
}: {
  value: ChampionshipValue | undefined;
  onChange: (v: ChampionshipValue) => void;
}) {
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
        players travel to compete. If you have a significant number of
        players who plan to attend, holding league nights during these
        events can lead to makeup matches or forfeits.
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
        Championship dates are updated annually. If dates haven&rsquo;t been
        announced yet, conflicts will appear on your schedule once they&rsquo;re
        set.
      </p>
    </div>
  );
}

/** "Same as last / Change" pattern for next-season runs. */
function NextSeasonChampionshipPicker({
  value,
  onChange,
  tracking,
}: {
  value: ChampionshipValue | undefined;
  onChange: (v: ChampionshipValue) => void;
  tracking: NonNullable<FlowContextShape['championshipTracking']>;
}) {
  const sameDefault: ChampionshipValue = {
    trackBca: tracking.trackBca,
    trackApa: tracking.trackApa,
  };

  useEffect(() => {
    if (!value) onChange(sameDefault);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracking.trackBca, tracking.trackApa]);

  const current = value ?? sameDefault;
  const mode: 'keep' | 'change' =
    current.trackBca === sameDefault.trackBca && current.trackApa === sameDefault.trackApa
      ? 'keep'
      : 'change';

  const handleModeChange = (next: string) => {
    if (next === 'keep') onChange(sameDefault);
    else onChange({ trackBca: !sameDefault.trackBca, trackApa: !sameDefault.trackApa });
  };

  const summaryParts: string[] = [];
  if (tracking.trackBca) summaryParts.push(`BCA${tracking.bcaDates ? ` (${tracking.bcaDates})` : ''}`);
  if (tracking.trackApa) summaryParts.push(`APA${tracking.apaDates ? ` (${tracking.apaDates})` : ''}`);
  const summary = summaryParts.join(' + ') || 'None';

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-1">
        <p className="font-medium text-foreground">National Championships</p>
        <InfoButton title="Championship Conflicts" size="sm">
          <p>
            BCA and APA hold national championships each year. If your
            players travel to compete, you may want to suspend league
            play for those weeks. You set this once when you created
            your first league — keep it the same or change it for this
            season.
          </p>
        </InfoButton>
      </div>

      <p className="text-sm text-muted-foreground">
        Currently tracking: <strong>{summary}</strong>.
      </p>

      <RadioGroup value={mode} onValueChange={handleModeChange} className="space-y-3">
        <ChoiceRow
          id="keep"
          label="Keep current tracking"
          sublabel={`Stay with ${summary}. Skip to the schedule.`}
        />
        <ChoiceRow
          id="change"
          label="Change tracking"
          sublabel="Edit which championships are flagged on the schedule."
        />
      </RadioGroup>

      {mode === 'change' && (
        <div className="space-y-3 pt-2 pl-7 border-l-2 border-muted">
          <div className="flex items-center gap-3">
            <Checkbox
              id="track-bca-edit"
              checked={current.trackBca}
              onCheckedChange={(checked) =>
                onChange({ ...current, trackBca: checked === true })
              }
              className="size-5 border-2 border-gray-400"
            />
            <Label htmlFor="track-bca-edit">
              Track BCA National Championship conflicts
              {tracking.bcaDates && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({tracking.bcaDates})
                </span>
              )}
            </Label>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="track-apa-edit"
              checked={current.trackApa}
              onCheckedChange={(checked) =>
                onChange({ ...current, trackApa: checked === true })
              }
              className="size-5 border-2 border-gray-400"
            />
            <Label htmlFor="track-apa-edit">
              Track APA National Championship conflicts
              {tracking.apaDates && (
                <span className="text-xs text-muted-foreground ml-2">
                  ({tracking.apaDates})
                </span>
              )}
            </Label>
          </div>
        </div>
      )}
    </div>
  );
}

function ChoiceRow({
  id,
  label,
  sublabel,
}: {
  id: string;
  label: string;
  sublabel: string;
}) {
  return (
    <div className="flex items-start gap-3 cursor-pointer">
      <RadioGroupItem value={id} id={id} className="mt-1" />
      <Label htmlFor={id} className="cursor-pointer flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-sm text-muted-foreground">{sublabel}</div>
      </Label>
    </div>
  );
}
