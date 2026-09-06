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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { GAME_TYPES } from '../gameTypes';
import type { BracketFormat } from '@/types/bracket';

/** Game types offered for a tournament (used later by handicap/scoring). */
/** Elimination formats, with a one-line explanation each. */
const FORMATS: { value: BracketFormat; label: string; desc: string }[] = [
  {
    value: 'single_elimination',
    label: 'Single elimination',
    desc: 'One loss and you’re out.',
  },
  {
    value: 'double_elimination',
    label: 'Double elimination',
    desc: 'A loss drops you to the losers bracket — you’re out on the second.',
  },
];

interface DetailsStepProps {
  name: string;
  format: BracketFormat;
  grandFinalReset: boolean;
  gameType: string | null;
  onNameChange: (name: string) => void;
  onFormatChange: (format: BracketFormat) => void;
  onResetChange: (reset: boolean) => void;
  onGameTypeChange: (gameType: string) => void;
}

export function DetailsStep({
  name,
  format,
  grandFinalReset,
  gameType,
  onNameChange,
  onFormatChange,
  onResetChange,
  onGameTypeChange,
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
        <Label htmlFor="game-type">Game</Label>
        <Select value={gameType ?? undefined} onValueChange={onGameTypeChange}>
          <SelectTrigger id="game-type">
            <SelectValue placeholder="Choose a game" />
          </SelectTrigger>
          <SelectContent>
            {GAME_TYPES.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Format</Label>
        <RadioGroup
          value={format}
          onValueChange={(v) => onFormatChange(v as BracketFormat)}
          className="grid gap-2"
        >
          {FORMATS.map((f) => (
            <Label
              key={f.value}
              htmlFor={`fmt-${f.value}`}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                format === f.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              )}
            >
              <RadioGroupItem value={f.value} id={`fmt-${f.value}`} className="mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-medium">{f.label}</div>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </div>

      {format === 'double_elimination' && (
        <div className="flex items-center justify-between gap-4 rounded-md border p-3">
          <div className="space-y-1">
            <Label htmlFor="reset-toggle">Grand Finals reset</Label>
            <p className="text-sm text-muted-foreground">
              {grandFinalReset
                ? 'The losers-side finalist must beat the champion twice to win the title.'
                : 'The final is decided by a single matchup.'}
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
