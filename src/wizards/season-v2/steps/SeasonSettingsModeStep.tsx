/**
 * @fileoverview SeasonSettingsModeStep — gate step that lets the LO
 * skip BOTH the Season Length + Playoff Format steps in one click.
 *
 * Only shown when the previous-season anchor exists (next-season
 * flow). For first-season leagues there's nothing to "keep," so the
 * step's `showIf` hides it and the two existing steps run normally.
 *
 *   "Keep"   → snapshots the previous-season defaults into this slice;
 *              SeasonLengthStep + PlayoffFormatStep are hidden via
 *              `showIf`; useCreateSeasonV2 reads the snapshot.
 *   "Change" → both subsequent steps render normally (each with its
 *              own "Same as last / Change" sub-radio).
 *
 * Saves N clicks for the common "keep last season's setup" path.
 */

import { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { WizardStepProps } from '@/components/wizard';
import type { SeasonWizardFormData } from '../seasonWizardTypes';

interface FlowContextShape {
  previousSeasonLength?: number;
  previousSeasonPlayoffWeeks?: number;
}

type ModeValue = NonNullable<SeasonWizardFormData['season-settings-mode']>;

/** Map "last season had N playoff weeks" to a sensible default format. */
function defaultFormatForWeekCount(weeks: number): string {
  if (weeks <= 0) return 'none';
  if (weeks === 1) return '1week_top4';
  return '2week_top4';
}

/** Human-readable summary of last season's playoffs. */
function summarizePlayoffWeeks(weeks: number): string {
  if (weeks <= 0) return 'no playoffs';
  if (weeks === 1) return '1 playoff week';
  return `${weeks} playoff weeks`;
}

export function SeasonSettingsModeStep({
  value,
  onChange,
  formData,
}: WizardStepProps<ModeValue | undefined, SeasonWizardFormData>) {
  const flowContext = (formData as Record<string, unknown>)._flowContext as
    | FlowContextShape
    | undefined;

  const previousLength = flowContext?.previousSeasonLength ?? 16;
  const previousPlayoffWeeks = flowContext?.previousSeasonPlayoffWeeks ?? 0;
  const defaultPlayoff = {
    format: defaultFormatForWeekCount(previousPlayoffWeeks),
    wildcard: false,
  };

  // Default to "keep" on first mount + snapshot the resolved defaults.
  useEffect(() => {
    if (!value) {
      onChange({
        mode: 'keep',
        length: previousLength,
        playoff: defaultPlayoff,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousLength, previousPlayoffWeeks]);

  const mode: 'keep' | 'change' = value?.mode ?? 'keep';

  const handleModeChange = (next: string) => {
    if (next === 'keep') {
      onChange({
        mode: 'keep',
        length: previousLength,
        playoff: defaultPlayoff,
      });
    } else {
      onChange({ mode: 'change' });
    }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <Label className="text-base">
          Season length + playoffs
        </Label>
        <p className="text-sm text-muted-foreground mt-1">
          Last season was <strong>{previousLength} weeks</strong> with{' '}
          <strong>{summarizePlayoffWeeks(previousPlayoffWeeks)}</strong>.
        </p>
      </div>

      <RadioGroup value={mode} onValueChange={handleModeChange} className="space-y-3">
        <ChoiceRow
          id="keep"
          label="Keep both — same as last season"
          sublabel={`${previousLength} weeks + ${summarizePlayoffWeeks(previousPlayoffWeeks)}. Skips the next two steps.`}
        />
        <ChoiceRow
          id="change"
          label="Change something"
          sublabel="Walks you through the length + playoff steps so you can edit either or both."
        />
      </RadioGroup>
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
