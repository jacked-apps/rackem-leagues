/**
 * @fileoverview Create-bracket flow — step 3: seeding + review.
 *
 * Pick the seeding mode, then preview the round-1 matchups (so an unexpected
 * pairing is caught before the bracket goes live). "Random" can't preview exact
 * pairings (the shuffle happens at start), so it shows a note instead.
 */

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import type { SeedingMode } from '@/types/bracket';
import { buildPairingPreview } from './pairingPreview';

interface ReviewStepProps {
  participants: string[];
  seedingMode: SeedingMode;
  onSeedingModeChange: (mode: SeedingMode) => void;
}

const SEEDING_MODES: { value: SeedingMode; label: string; desc: string }[] = [
  {
    value: 'seeded',
    label: 'Seeded',
    desc: 'Your list order is the seed — top players are kept apart.',
  },
  { value: 'random', label: 'Random', desc: 'Pairings are drawn when you start.' },
];

export function ReviewStep({
  participants,
  seedingMode,
  onSeedingModeChange,
}: ReviewStepProps) {
  const preview =
    seedingMode === 'random' ? null : buildPairingPreview(participants);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Seeding</Label>
        <RadioGroup
          value={seedingMode}
          onValueChange={(v) => onSeedingModeChange(v as SeedingMode)}
          className="grid gap-2"
        >
          {SEEDING_MODES.map((m) => (
            <Label
              key={m.value}
              htmlFor={`seed-${m.value}`}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors',
                seedingMode === m.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              )}
            >
              <RadioGroupItem value={m.value} id={`seed-${m.value}`} className="mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-medium">{m.label}</div>
                <p className="text-sm text-muted-foreground">{m.desc}</p>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>Round 1</Label>
        {preview === null ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Matchups are drawn randomly when you start the tournament.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {preview.map((m, i) => (
              <li key={i} className="flex items-center gap-3 p-3 text-sm">
                <span className="w-5 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                <span className="flex-1">
                  {m.home ?? <em className="text-muted-foreground">bye</em>}
                </span>
                <span className="text-xs text-muted-foreground">vs</span>
                <span className="flex-1 text-right">
                  {m.away ?? <em className="text-muted-foreground">bye</em>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
