/**
 * @fileoverview Read-only "built-in calculation" view of the threshold editor.
 *
 * Some real thresholds use dedicated math operations (Fargo start-points / Fargo
 * games-won, the points/percentage games-needed formulas, read-a-pref, the
 * milestone product). Their math isn't editable in the arithmetic builder — an
 * LO clones them to USE them and to learn from them. This panel explains what
 * the built-in does; the editor still lets the LO rename it and set its
 * expansion mode. (Charts, by contrast, are cell-editable in ChartView.)
 */

import { Label } from '@/components/ui/label';
import { ReadOnlyFormula } from './ReadOnlyFormula';
import { builtinFormulaLines } from './builtinFormula';
import type { ThresholdDefinition } from './useThresholdRoom';

/** Plain-English description of each built-in operation. */
const BUILT_INS: Record<string, { title: string; blurb: string }> = {
  fargo_start_points_for_side: {
    title: 'Start points — Fargo',
    blurb:
      "Gives the weaker team a head start in points, computed from the lineup's Fargo ratings. Works for any lineup size.",
  },
  fargo_games_won: {
    title: 'Games to win — Fargo',
    blurb:
      "Derives how many games each team needs to win from the lineup's Fargo ratings (FargoRate win expectancy). Any lineup size.",
  },
  games_needed_3v3_formula: {
    title: 'Games to win — Points formula',
    blurb:
      'Computes the win target from the points handicap gap. The formula scales to any lineup size (the chart version is locked to its size).',
  },
  games_needed_5v5_formula: {
    title: 'Games to win — Percentage formula',
    blurb:
      'Computes the win target from the percentage handicap gap. Scales to any lineup size.',
  },
  chart_lookup_3v3: {
    title: 'Games to win — Points chart (3-player)',
    blurb: 'The built-in 3-player points lookup table.',
  },
  read_pref: {
    title: 'Reads a league setting',
    blurb: 'Reads a number you configure in league settings (e.g. games to win). The same for both sides.',
  },
  arithmetic_round_product: {
    title: 'Milestone — a percent of another number',
    blurb: 'Multiplies two league settings and rounds (e.g. 70% of games-to-win). The same for both sides.',
  },
};

export interface BuiltInViewProps {
  readonly definition: ThresholdDefinition;
}

export function BuiltInView({ definition }: BuiltInViewProps) {
  const info = BUILT_INS[definition.operationKind] ?? {
    title: 'Built-in calculation',
    blurb: 'A built-in threshold calculation.',
  };
  const formula = builtinFormulaLines(definition.operationKind);
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Built-in calculation</Label>
        <div className="font-medium">{info.title}</div>
        <p className="text-sm text-muted-foreground">{info.blurb}</p>
      </div>

      {formula ? (
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">The formula it uses</Label>
          <ReadOnlyFormula lines={formula} />
          <p className="text-xs text-muted-foreground">
            Shown so you can see how it works. The dashed symbols (like <span className="font-mono">^</span>,{' '}
            <span className="font-mono">floor</span>) aren't editable yet — we'll open them up later. For now
            you can clone it, rename it, and use it.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          You can clone it, rename it, and use it, but its math isn't editable here. (Charts are the editable
          kind.)
        </p>
      )}
    </div>
  );
}
