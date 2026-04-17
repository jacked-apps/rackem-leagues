/**
 * @fileoverview PlayoffFormatStep — playoff structure selection + wildcard toggle
 *
 * Preset formats cover ~90% of leagues. Custom config done after the wizard.
 * Wildcard checkbox only shows after a format is selected.
 */

import { CardSelector } from '@/components/wizard';
import { InfoButton } from '@/components/InfoButton';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { WizardStepProps } from '@/components/wizard';
import type { SeasonWizardFormData } from '../seasonWizardTypes';
import { PLAYOFF_OPTIONS } from './playoffFormatOptions';

interface PlayoffValue {
  format: string;
  wildcard: boolean;
}

export function PlayoffFormatStep({
  value,
  onChange,
}: WizardStepProps<PlayoffValue | undefined, SeasonWizardFormData>) {
  const current = value ?? { format: '', wildcard: false };

  const handleFormatChange = (format: string) => {
    onChange({ ...current, format });
  };

  const handleWildcardChange = (checked: boolean) => {
    onChange({ ...current, wildcard: checked });
  };

  return (
    <div className="space-y-6">
      <CardSelector
        label="How should playoffs be structured?"
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
        onChange={handleFormatChange}
      />

      {current.format && current.format !== 'custom' && current.format !== 'none' && (
        <div className="flex items-center gap-3 pl-1">
          <Checkbox
            id="wildcard"
            checked={current.wildcard}
            onCheckedChange={(checked) => handleWildcardChange(checked === true)}
            className="size-5 border-2 border-gray-400"
          />
          <div className="flex items-center gap-1">
            <Label htmlFor="wildcard">Use wildcard spot</Label>
            <InfoButton title="Wildcard" size="sm">
              <p>
                Replaces the last qualifying spot with a random draw
                from non-qualifying teams. Gives every team a chance
                at the playoffs.
              </p>
            </InfoButton>
          </div>
        </div>
      )}
    </div>
  );
}
