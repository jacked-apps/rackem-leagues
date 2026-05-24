/**
 * @fileoverview Championship-tracking steps for the wizards.
 *
 * Exports three components:
 *
 * 1. **ChampionshipStep** — used in the FIRST-time league flow
 *    (schedule wizard). Original checkbox UI for operators who haven't
 *    set tracking yet.
 *
 * 2. **ChampionshipModeStep** — gate page used in the NEXT-season
 *    flow (season wizard). Same shape as the SeasonSettingsModeStep:
 *    Keep / Change buttons, both auto-advance.
 *      - Keep:   snapshot current tracking, advance, edit step is hidden.
 *      - Change: mode='change', advance to ChampionshipEditStep.
 *
 * 3. **ChampionshipEditStep** — editor revealed by the gate when the
 *    operator picks Change. Checkbox UI for BCA/APA with date hints.
 *
 * This is a league/operator-level preference — set once, carries
 * forward to future seasons. Dates are entered annually by admin into
 * `championship_date_options`.
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { InfoButton } from '@/components/InfoButton';
import type { WizardStepProps } from '@/components/wizard';

export interface ChampionshipValue {
  trackBca: boolean;
  trackApa: boolean;
}

export interface ChampionshipModeValue {
  mode: 'keep' | 'change';
  trackBca?: boolean;
  trackApa?: boolean;
}

interface FlowContextShape {
  championshipTracking?: {
    trackBca: boolean;
    trackApa: boolean;
    bcaDates?: string;
    apaDates?: string;
  };
}

// ----------------------------------------------------------------------------
// 1. First-time picker (schedule wizard, first-league flow)
// ----------------------------------------------------------------------------

export function ChampionshipStep({
  value,
  onChange,
}: WizardStepProps<ChampionshipValue | undefined, unknown>) {
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

// ----------------------------------------------------------------------------
// 2. Gate (season wizard, next-season flow)
// ----------------------------------------------------------------------------

export function ChampionshipModeStep({
  onChange,
  onNext,
  formData,
}: WizardStepProps<ChampionshipModeValue | undefined, unknown>) {
  const flowContext = (formData as Record<string, unknown>)._flowContext as
    | FlowContextShape
    | undefined;
  const tracking = flowContext?.championshipTracking ?? {
    trackBca: false,
    trackApa: false,
  };

  const keepSnapshot: ChampionshipModeValue = {
    mode: 'keep',
    trackBca: tracking.trackBca,
    trackApa: tracking.trackApa,
  };

  // No mount auto-fill: the summary should only reflect the operator's
  // active choices. The Keep button writes the snapshot.

  const handleKeep = () => {
    onChange(keepSnapshot);
    onNext();
  };

  const handleChange = () => {
    onChange({ mode: 'change' });
    onNext();
  };

  const question = (() => {
    const both = tracking.trackBca && tracking.trackApa;
    const onlyBca = tracking.trackBca && !tracking.trackApa;
    const onlyApa = !tracking.trackBca && tracking.trackApa;
    if (both) {
      return `You're tracking both BCA (${flowContext?.championshipTracking?.bcaDates ?? 'dates TBD'}) and APA (${flowContext?.championshipTracking?.apaDates ?? 'dates TBD'}). Use the same setup?`;
    }
    if (onlyBca) {
      return `You're tracking BCA (${flowContext?.championshipTracking?.bcaDates ?? 'dates TBD'}) but not APA. Use the same setup?`;
    }
    if (onlyApa) {
      return `You're tracking APA (${flowContext?.championshipTracking?.apaDates ?? 'dates TBD'}) but not BCA. Use the same setup?`;
    }
    return `You're not tracking BCA or APA conflicts. Use the same setup?`;
  })();

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-1">
        <p className="font-medium text-foreground">National Championships</p>
        <InfoButton title="Championship Conflicts" size="sm">
          <p>
            You set this when you created your first league. We carry it
            forward each season — but you can change it any time.
          </p>
        </InfoButton>
      </div>

      <p className="text-foreground">{question}</p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleKeep} loadingText="none">
          Keep — same as last season
        </Button>
        <Button variant="outline" onClick={handleChange} loadingText="none">
          Change tracking →
        </Button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// 3. Editor (season wizard, next-season flow — only when gate=change)
// ----------------------------------------------------------------------------

export function ChampionshipEditStep({
  value,
  onChange,
  formData,
}: WizardStepProps<ChampionshipValue | undefined, unknown>) {
  const flowContext = (formData as Record<string, unknown>)._flowContext as
    | FlowContextShape
    | undefined;
  const tracking = flowContext?.championshipTracking ?? {
    trackBca: false,
    trackApa: false,
  };

  const current = value ?? {
    trackBca: tracking.trackBca,
    trackApa: tracking.trackApa,
  };

  useEffect(() => {
    if (!value) {
      onChange({ trackBca: tracking.trackBca, trackApa: tracking.trackApa });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <p className="font-medium text-foreground">Change championship tracking</p>
        <p className="text-sm text-muted-foreground mt-1">
          Toggle which championships should be flagged on your schedule.
        </p>
      </div>

      <div className="space-y-3">
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
    </div>
  );
}
