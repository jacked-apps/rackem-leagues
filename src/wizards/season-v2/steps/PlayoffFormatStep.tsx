/**
 * @fileoverview PlayoffFormatStep — playoff structure selection + wildcard toggle
 *
 * Click-thru pattern (same shape as ChampionshipStep): conversational
 * question + [Skip — same as last] / [Change playoffs →] buttons.
 *
 * **Next-season mode** (when `_flowContext.previousSeasonPlayoffWeeks`
 * is defined): Skip commits a sensible default for the previous
 * week-count and advances. Change reveals the CardSelector + wildcard
 * checkbox inline.
 *
 * **First-season / fallback mode**: full CardSelector immediately
 * (original behavior).
 */

import { useEffect, useState } from 'react';
import { CardSelector } from '@/components/wizard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { InfoButton } from '@/components/InfoButton';
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

export function PlayoffFormatStep({
  value,
  onChange,
  onNext,
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
        onNext={onNext}
        previousPlayoffWeeks={previousPlayoffWeeks}
      />
    );
  }

  return <FirstSeasonPlayoffPicker value={value} onChange={onChange} />;
}

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

function NextSeasonPlayoffPicker({
  value,
  onChange,
  onNext,
  previousPlayoffWeeks,
}: {
  value: PlayoffValue | undefined;
  onChange: (v: PlayoffValue) => void;
  onNext: () => void;
  previousPlayoffWeeks: number;
}) {
  const skipDefault: PlayoffValue = {
    format: defaultFormatForWeekCount(previousPlayoffWeeks),
    wildcard: false,
  };

  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!value || value.format === '') onChange(skipDefault);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousPlayoffWeeks]);

  const handleSkip = () => {
    onChange(skipDefault);
    onNext();
  };

  if (!editing) {
    return (
      <div className="space-y-6 max-w-lg">
        <div>
          <Label className="text-base">Playoffs</Label>
          <p className="text-foreground mt-1">
            Last season had{' '}
            <strong>{summarizePlayoffWeeks(previousPlayoffWeeks)}</strong>.
            Same setup?
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleSkip} loadingText="none">
            Keep — {summarizePlayoffWeeks(previousPlayoffWeeks)}
          </Button>
          <Button
            variant="outline"
            onClick={() => setEditing(true)}
            loadingText="none"
          >
            Change playoffs →
          </Button>
        </div>
      </div>
    );
  }

  const current = value ?? skipDefault;
  return (
    <div className="space-y-4 max-w-lg">
      <p className="font-medium text-foreground">Change playoff format</p>

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

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onChange(skipDefault);
          setEditing(false);
        }}
        loadingText="none"
      >
        ← Use last season&rsquo;s playoff format instead
      </Button>
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
        className="size-5 border-2 border-input"
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
