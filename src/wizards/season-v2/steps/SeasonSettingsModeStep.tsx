/**
 * @fileoverview SeasonSettingsModeStep — combined "length + playoffs"
 * confirmation page. Shows both prior values together with a single
 * "Same as last? / Change" choice.
 *
 *   Keep   → snapshots the previous-season defaults into this slice;
 *            SeasonLengthStep + PlayoffFormatStep are hidden via
 *            `showIf`; useCreateSeasonV2 reads the snapshot.
 *            Auto-advances via onNext.
 *   Change → mode='change'; both subsequent steps render (each with
 *            its own Skip/Change sub-prompt). Auto-advances via onNext.
 *
 * Only shown in the next-season flow (previous-season anchor in
 * context). First-season flows skip this gate and run the two
 * individual steps directly.
 */

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

  // No mount auto-fill: the summary panel should only show what the
  // operator actively confirmed in this wizard, not the previous
  // season's defaults. The Keep button below writes the snapshot.

  const handleKeep = () => {
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
        <Button onClick={handleKeep} loadingText="none">
          Keep — same as last season
        </Button>
        <Button variant="outline" onClick={handleChange} loadingText="none">
          Change something →
        </Button>
      </div>
    </div>
  );
}
