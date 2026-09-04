/**
 * @fileoverview Create-bracket flow — step 1: details (name + format).
 *
 * Bracket name, elimination format, and (double-elim only) the grand-final
 * reset toggle. Bare shadcn; styling refinements come later.
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import type { BracketFormat } from '@/types/bracket';

interface DetailsStepProps {
  name: string;
  format: BracketFormat;
  grandFinalReset: boolean;
  onNameChange: (name: string) => void;
  onFormatChange: (format: BracketFormat) => void;
  onResetChange: (reset: boolean) => void;
}

export function DetailsStep({
  name,
  format,
  grandFinalReset,
  onNameChange,
  onFormatChange,
  onResetChange,
}: DetailsStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="bracket-name">Tournament name</Label>
        <Input
          id="bracket-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Friday Night 9-Ball"
          maxLength={80}
        />
      </div>

      <div className="space-y-2">
        <Label>Format</Label>
        <RadioGroup
          value={format}
          onValueChange={(v) => onFormatChange(v as BracketFormat)}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="single_elimination" id="fmt-single" />
            <Label htmlFor="fmt-single">Single elimination</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="double_elimination" id="fmt-double" />
            <Label htmlFor="fmt-double">Double elimination</Label>
          </div>
        </RadioGroup>
      </div>

      {format === 'double_elimination' && (
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="reset-toggle">Grand Finals</Label>
            <p className="text-sm text-muted-foreground">
              The losers-side finalist must beat the champion twice to win the
              title.
            </p>
          </div>
          <Switch
            id="reset-toggle"
            checked={grandFinalReset}
            onCheckedChange={onResetChange}
          />
        </div>
      )}
    </div>
  );
}
