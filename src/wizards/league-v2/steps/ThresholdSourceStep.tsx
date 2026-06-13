/**
 * @fileoverview ThresholdSourceStep — wizard step that tells the LO what
 * handicap source their configured combo will use, with a "play
 * unhandicapped" escape hatch for off-preset combos.
 *
 * Phase 4 Unit 4.3 of the modular-league-system v2 plan.
 *
 * The step is purely informational for combos with a calibrated source
 * (the three Tested Presets, plus Fargo + games-won via the formula
 * shipped in Unit 3.2). For combos without a calibrated source, the
 * LO can either:
 *   - Proceed with manual captain-entry at lineup lock (default)
 *   - Toggle "play unhandicapped" → useCreateLeagueV2 writes
 *     `mechanism = 'none'` regardless of the LO's MechanismStep choice.
 *
 * The "author custom chart now" inline-editor option in the original
 * plan spec is deferred until Unit 3.4 ships the chart editor UI. The
 * "manual entry at lineup lock" path already works today (captains
 * adjust thresholds when locking lineup) so off-preset combos always
 * have a working fallback.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { WizardStepProps } from '@/components/wizard';
import type { LeagueWizardFormData } from '../leagueWizardTypes';

type SourceClass =
  | 'tested_preset_3v3'
  | 'tested_preset_5v5'
  | 'fargo_start_points'
  | 'fargo_games_won'
  | 'manual_entry';

function classifyThresholdSource(formData: LeagueWizardFormData): SourceClass {
  const handicapType = formData['handicap-system'];
  const winCondition = formData['win-condition'] ?? 'games';
  const mechanism = formData['mechanism'];
  const lineupSize = formData['lineup-size'];
  const matchFormat = formData['match-format'];

  // Tested Preset: BCA 3v3 (lineup=3, points handicap, double_round_robin)
  if (
    lineupSize === 3 &&
    matchFormat === 'double_round_robin' &&
    handicapType === 'points' &&
    mechanism === 'extra_games'
  ) {
    return 'tested_preset_3v3';
  }

  // Tested Preset: BCA 5v5 (lineup=5, percentage, single_round_robin)
  if (
    lineupSize === 5 &&
    matchFormat === 'single_round_robin' &&
    handicapType === 'percentage' &&
    mechanism === 'extra_games'
  ) {
    return 'tested_preset_5v5';
  }

  // Fargo + start_points + win_condition='points' (start-points-credit flow)
  if (handicapType === 'fargo' && (mechanism === 'start_points' || winCondition === 'points')) {
    return 'fargo_start_points';
  }

  // Fargo + games-won + extra_games (the formula from Unit 3.2)
  if (handicapType === 'fargo' && winCondition === 'games') {
    return 'fargo_games_won';
  }

  // Anything else: no calibrated source — captains adjust at lineup
  // lock or the LO opts into mechanism='none'.
  return 'manual_entry';
}

interface SourceDescription {
  badge: string;
  badgeClass: string;
  title: string;
  body: string;
}

function describeSource(source: SourceClass): SourceDescription {
  switch (source) {
    case 'tested_preset_3v3':
      return {
        badge: 'Calibrated',
        badgeClass: 'bg-success/10 text-success border-success/40',
        title: 'Rackem League 3v3 Points Chart',
        body:
          'This combo uses the seeded Tested Preset chart. Threshold values are calibrated against the standard Rackem 3v3 handicap table. No action needed.',
      };
    case 'tested_preset_5v5':
      return {
        badge: 'Calibrated',
        badgeClass: 'bg-success/10 text-success border-success/40',
        title: 'Rackem League 5v5 Percentage Chart',
        body:
          'This combo uses the seeded Tested Preset chart. Threshold values are calibrated against the standard BCA 5v5 percentage handicap table. No action needed.',
      };
    case 'fargo_start_points':
      return {
        badge: 'Calibrated',
        badgeClass: 'bg-success/10 text-success border-success/40',
        title: 'FargoRate start-points formula',
        body:
          'Captains negotiate the agreed start-points credit at lineup lock based on each team\'s lineup ratings. Formula derived from FargoRate\'s published primitives — captains can override if their league uses different conventions.',
      };
    case 'fargo_games_won':
      return {
        badge: 'Calibrated',
        badgeClass: 'bg-success/10 text-success border-success/40',
        title: 'Fargo games-to-win formula',
        body:
          'Per-team thresholds are computed from the lineup ratings using the FargoRate base formula (T = 2^(rating/100)). Validated against FargoRate\'s published HOT race chart for individual matchups (96-pt gap on 10-game race → 7-4 race, exact match). Captains can override at lineup lock if your league has agreed on different thresholds.',
      };
    case 'manual_entry':
      return {
        badge: 'Manual entry',
        badgeClass: 'bg-warning/10 text-warning border-warning/40',
        title: 'No calibrated chart for this combo',
        body:
          'This handicap combination doesn\'t have a built-in calibrated chart. Captains will enter the agreed thresholds at lineup lock time — same workflow as captains overriding the calibrated defaults in other systems. Or, if your league plays without handicaps, toggle the option below.',
      };
  }
}

export function ThresholdSourceStep({
  value,
  onChange,
  formData,
}: WizardStepProps<'unhandicapped' | undefined, LeagueWizardFormData>) {
  const source = classifyThresholdSource(formData);
  const desc = describeSource(source);
  const showUnhandicappedOption = source === 'manual_entry';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded border ${desc.badgeClass}`}
            >
              {desc.badge}
            </span>
            <CardTitle className="text-base">{desc.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{desc.body}</p>
        </CardContent>
      </Card>

      {showUnhandicappedOption && (
        <div className="flex items-start gap-3 p-3 border border-border rounded">
          <Checkbox
            id="threshold-unhandicapped"
            checked={value === 'unhandicapped'}
            onCheckedChange={(checked) =>
              onChange(checked === true ? 'unhandicapped' : undefined)
            }
          />
          <div className="space-y-1">
            <Label htmlFor="threshold-unhandicapped" className="font-medium">
              Play this league unhandicapped
            </Label>
            <p className="text-xs text-muted-foreground">
              Skips handicap thresholds entirely — every player needs the same
              number of game wins regardless of rating. Sets the league\'s
              handicap mechanism to <code>none</code>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export for tests + useCreateLeagueV2 to consume.
export { classifyThresholdSource };
export type { SourceClass };
