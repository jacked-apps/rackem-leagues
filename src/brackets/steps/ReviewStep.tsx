/**
 * @fileoverview Create-bracket flow — step 3: seeding + review.
 *
 * Pick the seeding mode, then preview the round-1 matchups (so an unexpected
 * pairing is caught before the bracket goes live). "Random" can't preview exact
 * pairings (the shuffle happens at start), so it shows a note instead.
 */

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import type { SeedingMode } from '@/types/bracket';
import { buildPairingPreview } from './pairingPreview';

interface ReviewStepProps {
  participants: string[];
  seedingMode: SeedingMode;
  onSeedingModeChange: (mode: SeedingMode) => void;
}

const SEEDING_LABELS: Record<SeedingMode, string> = {
  seeded: 'Seeded — top of the list plays the bottom (order = seed)',
  ranked: 'Ranked — adjacent players in the list meet first',
  random: 'Random — pairings drawn when you start',
};

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
        >
          {(Object.keys(SEEDING_LABELS) as SeedingMode[]).map((mode) => (
            <div key={mode} className="flex items-center space-x-2">
              <RadioGroupItem value={mode} id={`seed-${mode}`} />
              <Label htmlFor={`seed-${mode}`}>{SEEDING_LABELS[mode]}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label>Round 1</Label>
        {preview === null ? (
          <p className="text-sm text-muted-foreground">
            Matchups are drawn randomly when you start the bracket.
          </p>
        ) : (
          <Card>
            <CardContent className="space-y-1 p-4">
              {preview.map((m, i) => (
                <div key={i} className="text-sm">
                  {m.home ?? <em className="text-muted-foreground">bye</em>}
                  {' vs '}
                  {m.away ?? <em className="text-muted-foreground">bye</em>}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
