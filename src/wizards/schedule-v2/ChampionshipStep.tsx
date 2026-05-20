/**
 * @fileoverview ChampionshipStep — BCA/APA conflict tracking preference
 *
 * Two modes:
 *
 * 1. **Next-season click-thru mode** (when `_flowContext.championshipTracking`
 *    exists). The operator already set this up at first-league creation —
 *    we just confirm with a conversational question + two buttons:
 *
 *       "Hey — you track BCA (Aug 1–7) but not APA. Still the case?"
 *       [Skip — same as before]   [Change tracking]
 *
 *    Skip commits the snapshot via onChange and advances via onNext.
 *    Change reveals the checkbox editor inline.
 *
 *    If the operator isn't tracking either championship, the schedule
 *    wizard's `showIf` skips this step entirely (configured in
 *    scheduleWizardConfig).
 *
 * 2. **First-time mode** — operator hasn't told us yet. Show the
 *    original checkbox UI so they can opt in.
 *
 * This is a league/operator-level preference — set once, carries
 * forward to future seasons. Dates are entered annually by admin into
 * `championship_date_options`.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
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
  onNext,
  formData,
}: WizardStepProps<ChampionshipValue | undefined, ScheduleWizardFormData>) {
  const flowContext = (formData as Record<string, unknown>)._flowContext as
    | FlowContextShape
    | undefined;

  const tracking = flowContext?.championshipTracking;

  if (tracking) {
    return (
      <NextSeasonChampionshipConfirm
        value={value}
        onChange={onChange}
        onNext={onNext}
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

/**
 * Click-thru: one button to skip (= keep as-is + advance), one to
 * change. No radio, no extra Next click.
 */
function NextSeasonChampionshipConfirm({
  value,
  onChange,
  onNext,
  tracking,
}: {
  value: ChampionshipValue | undefined;
  onChange: (v: ChampionshipValue) => void;
  onNext: () => void;
  tracking: NonNullable<FlowContextShape['championshipTracking']>;
}) {
  const [editing, setEditing] = useState(false);

  const snapshot: ChampionshipValue = {
    trackBca: tracking.trackBca,
    trackApa: tracking.trackApa,
  };
  const current = value ?? snapshot;

  // Conversational summary line: "BCA (dates) but not APA" / "BCA + APA" / etc.
  const question = (() => {
    const both = tracking.trackBca && tracking.trackApa;
    const onlyBca = tracking.trackBca && !tracking.trackApa;
    const onlyApa = !tracking.trackBca && tracking.trackApa;
    if (both) {
      return `You're tracking both BCA (${tracking.bcaDates ?? 'dates TBD'}) and APA (${tracking.apaDates ?? 'dates TBD'}). Keep that?`;
    }
    if (onlyBca) {
      return `You're tracking BCA (${tracking.bcaDates ?? 'dates TBD'}) but not APA. Keep that?`;
    }
    if (onlyApa) {
      return `You're tracking APA (${tracking.apaDates ?? 'dates TBD'}) but not BCA. Keep that?`;
    }
    // Step should be hidden via showIf when neither is tracked, but
    // handle the case gracefully just in case.
    return `You're not tracking BCA or APA. Keep that?`;
  })();

  const handleSkip = () => {
    onChange(snapshot);
    onNext();
  };

  if (!editing) {
    return (
      <div className="space-y-6 max-w-lg">
        <div className="flex items-center gap-1">
          <p className="font-medium text-foreground">National Championships</p>
          <InfoButton title="Championship Conflicts" size="sm">
            <p>
              You set this when you created your first league. We
              carry it forward each season — but you can change it
              any time.
            </p>
          </InfoButton>
        </div>

        <p className="text-foreground">{question}</p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleSkip} loadingText="none">
            Keep — same as last season
          </Button>
          <Button
            variant="outline"
            onClick={() => setEditing(true)}
            loadingText="none"
          >
            Change tracking →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg">
      <p className="font-medium text-foreground">Change championship tracking</p>

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

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onChange(snapshot);
          setEditing(false);
        }}
        loadingText="none"
      >
        ← Use last season&rsquo;s tracking instead
      </Button>
    </div>
  );
}
