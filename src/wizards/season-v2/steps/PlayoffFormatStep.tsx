/**
 * @fileoverview PlayoffFormatStep — playoff structure selection + wildcard toggle
 *
 * Two modes:
 *
 * 1. **Next-season mode** (when `_flowContext.previousSeasonPlayoffWeeks`
 *    is defined) — radio choice: "Same as last (N playoff weeks)" or
 *    "Change playoffs". "Change" reveals the CardSelector + wildcard
 *    checkbox. "Same" picks the most common format for the previous
 *    week count (none / 1week_top4 / 2week_top4).
 *
 * 2. **First-season / fallback mode** — full CardSelector immediately
 *    (original behavior).
 *
 * Preset formats cover ~90% of leagues. Custom config done after the wizard.
 * Wildcard checkbox only shows after a format is selected.
 */

import { useEffect } from 'react';
import { CardSelector } from '@/components/wizard';
import { InfoButton } from '@/components/InfoButton';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { WizardStepProps } from '@/components/wizard';
import type { SeasonWizardFormData } from '../seasonWizardTypes';
import { PLAYOFF_OPTIONS } from './playoffFormatOptions';

interface PlayoffValue {
  format: string;
  wildcard: boolean;
}

interface FlowContextShape {
  previousSeasonPlayoffWeeks?: number;
}

/** Map "last season had N playoff weeks" to a sensible default format. */
function defaultFormatForWeekCount(weeks: number): string {
  if (weeks <= 0) return 'none';
  if (weeks === 1) return '1week_top4';
  return '2week_top4';
}

/** Human-readable summary of last season's playoffs. */
function summarizePlayoffWeeks(weeks: number): string {
  if (weeks <= 0) return 'No playoffs';
  if (weeks === 1) return '1 playoff week';
  return `${weeks} playoff weeks`;
}

export function PlayoffFormatStep({
  value,
  onChange,
  formData,
}: WizardStepProps<PlayoffValue | undefined, SeasonWizardFormData>) {
  const flowContext = (formData as Record<string, unknown>)._flowContext as
    | FlowContextShape
    | undefined;

  const previousPlayoffWeeks = flowContext?.previousSeasonPlayoffWeeks;

  if (previousPlayoffWeeks != null) {
    return (
      <NextSeasonPlayoffPicker
        value={value}
        onChange={onChange}
        previousPlayoffWeeks={previousPlayoffWeeks}
      />
    );
  }

  return <FirstSeasonPlayoffPicker value={value} onChange={onChange} />;
}

/** Original behavior: CardSelector immediately. */
function FirstSeasonPlayoffPicker({
  value,
  onChange,
}: {
  value: PlayoffValue | undefined;
  onChange: (v: PlayoffValue) => void;
}) {
  const current = value ?? { format: '', wildcard: false };
  return (
    <div className="space-y-6">
      <CardSelector
        label="How should playoffs be structured?"
        labelInfoButton={{
          title: 'Playoff Format',
          content: (
            <p>
              Pick a standard format to get started. Your playoff
              structure is fully customizable — after the wizard, use
              the Playoff Builder to adjust qualification rules, bracket
              styles, matchup seeding, and more.
            </p>
          ),
        }}
        options={PLAYOFF_OPTIONS}
        value={current.format}
        onChange={(format) => onChange({ ...current, format })}
      />
      <WildcardToggle current={current} onChange={onChange} />
    </div>
  );
}

/** "Same as last / Change" pattern. */
function NextSeasonPlayoffPicker({
  value,
  onChange,
  previousPlayoffWeeks,
}: {
  value: PlayoffValue | undefined;
  onChange: (v: PlayoffValue) => void;
  previousPlayoffWeeks: number;
}) {
  const sameDefault: PlayoffValue = {
    format: defaultFormatForWeekCount(previousPlayoffWeeks),
    wildcard: false,
  };

  // Default to "Same as last" on first mount
  useEffect(() => {
    if (!value || value.format === '') {
      onChange(sameDefault);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousPlayoffWeeks]);

  const current = value ?? sameDefault;
  const mode: 'same' | 'change' =
    current.format === sameDefault.format && current.wildcard === sameDefault.wildcard
      ? 'same'
      : 'change';

  const handleModeChange = (next: string) => {
    if (next === 'same') onChange(sameDefault);
    else onChange({ format: '', wildcard: false });
  };

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <Label className="text-base">How should playoffs be structured?</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Last season: <strong>{summarizePlayoffWeeks(previousPlayoffWeeks)}</strong>.
        </p>
      </div>

      <RadioGroup value={mode} onValueChange={handleModeChange} className="space-y-3">
        <ChoiceRow
          id="same"
          label={`Same as last — ${summarizePlayoffWeeks(previousPlayoffWeeks)}`}
          sublabel="Keep the same playoff setup as last season."
        />
        <ChoiceRow
          id="change"
          label="Change playoffs"
          sublabel="Add, remove, or pick a different format."
        />
      </RadioGroup>

      {mode === 'change' && (
        <div className="space-y-4 pt-2 pl-7 border-l-2 border-muted">
          <CardSelector
            label="Pick a format"
            labelInfoButton={{
              title: 'Playoff Format',
              content: (
                <p>
                  Pick a standard format to get started. Your playoff
                  structure is fully customizable — after the wizard,
                  use the Playoff Builder to adjust qualification rules,
                  bracket styles, matchup seeding, and more.
                </p>
              ),
            }}
            options={PLAYOFF_OPTIONS}
            value={current.format}
            onChange={(format) => onChange({ ...current, format })}
          />
          <WildcardToggle current={current} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

function WildcardToggle({
  current,
  onChange,
}: {
  current: PlayoffValue;
  onChange: (v: PlayoffValue) => void;
}) {
  if (!current.format || current.format === 'custom' || current.format === 'none') {
    return null;
  }
  return (
    <div className="flex items-center gap-3 pl-1">
      <Checkbox
        id="wildcard"
        checked={current.wildcard}
        onCheckedChange={(checked) =>
          onChange({ ...current, wildcard: checked === true })
        }
        className="size-5 border-2 border-gray-400"
      />
      <div className="flex items-center gap-1">
        <Label htmlFor="wildcard">Use wildcard spot</Label>
        <InfoButton title="Wildcard" size="sm">
          <p>
            Replaces the last qualifying spot with a random draw from
            non-qualifying teams. Gives every team a chance at the
            playoffs.
          </p>
        </InfoButton>
      </div>
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
