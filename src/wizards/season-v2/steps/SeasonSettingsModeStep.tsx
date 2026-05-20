/**
 * @fileoverview SeasonSettingsModeStep — gate step that lets the LO
 * skip BOTH the Season Length + Playoff Format steps in one click.
 *
 * Click-thru pattern (same shape as ChampionshipStep): conversational
 * question + [Skip — same as last] / [Change something →] buttons.
 *
 * Only shown when the previous-season anchor exists (next-season
 * flow). For first-season leagues there's nothing to "keep," so the
 * step's `showIf` hides it and the two existing steps run normally.
 *
 *   Skip   → snapshots the previous-season defaults into this slice;
 *            SeasonLengthStep + PlayoffFormatStep are hidden via
 *            `showIf`; useCreateSeasonV2 reads the snapshot.
 *            Auto-advances via onNext.
 *   Change → both subsequent steps render normally (each with its
 *            own "Skip / Change" sub-prompt). Auto-advances via onNext.
 *
 * Saves N clicks for the common "keep last season's setup" path.
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { WizardStepProps } from '@/components/wizard';
import type { SeasonWizardFormData } from '../seasonWizardTypes';

interface FlowContextShape {
  previousSeasonLength?: number;
  previousSeasonPlayoffWeeks?: number;
}

type ModeValue = NonNullable<SeasonWizardFormData['season-settings-mode']>;

function defaultFormatForWeekCount(weeks: number): string {
  if (weeks <= 0) return 'none';
  if (weeks === 1) return '1week_top4';
  return '2week_top4';
}

function summarizePlayoffWeeks(weeks: number): string {
  if (weeks <= 0) return 'no playoffs';
  if (weeks === 1) return '1 playoff week';
  return `${weeks} playoff weeks`;
}

export function SeasonSettingsModeStep({
  value,
  onChange,
  onNext,
  formData,
}: WizardStepProps<ModeValue | undefined, SeasonWizardFormData>) {
  const flowContext = (formData as Record<string, unknown>)._flowContext as
    | FlowContextShape
    | undefined;

  const previousLength = flowContext?.previousSeasonLength ?? 16;
  const previousPlayoffWeeks = flowContext?.previousSeasonPlayoffWeeks ?? 0;
  const keepSnapshot: ModeValue = {
    mode: 'keep',
    length: previousLength,
    playoff: {
      format: defaultFormatForWeekCount(previousPlayoffWeeks),
      wildcard: false,
    },
  };

  // Snapshot the defaults on mount so summary + downstream creation
  // have values even before the user clicks Skip.
  useEffect(() => {
    if (!value) onChange(keepSnapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousLength, previousPlayoffWeeks]);

  const handleSkip = () => {
    onChange(keepSnapshot);
    onNext();
  };

  const handleChange = () => {
    onChange({ mode: 'change' });
    onNext();
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <Label className="text-base">Season length + playoffs</Label>
        <p className="text-foreground mt-1">
          Last season ran <strong>{previousLength} weeks</strong> with{' '}
          <strong>{summarizePlayoffWeeks(previousPlayoffWeeks)}</strong>.
          Use the same setup?
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleSkip} loadingText="none">
          Keep — same as last season
        </Button>
        <Button variant="outline" onClick={handleChange} loadingText="none">
          Change something →
        </Button>
      </div>
    </div>
  );
}
