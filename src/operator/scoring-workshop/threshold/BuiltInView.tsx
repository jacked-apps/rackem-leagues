/**
 * @fileoverview Read-only "built-in calculation" view of the threshold editor.
 *
 * Some real thresholds are tiny PROGRAMS (Fargo, the games-needed formulas) with
 * conditional logic — not single-line formulas. For now we show the ACTUAL code
 * that runs, read-only, so you can see exactly what it does. An editable code
 * editor (gated to technical users) is a later step. Charts stay cell-editable
 * in ChartView; these don't, yet.
 */

import { Label } from '@/components/ui/label';
import { builtinCode } from './builtinCode';
import type { ThresholdDefinition } from './useThresholdRoom';

/** Plain-English description of each built-in operation. */
const BUILT_INS: Record<string, { title: string; blurb: string }> = {
  fargo_start_points_for_side: {
    title: 'Start points — Fargo',
    blurb:
      "Gives the weaker team a head start in points, computed from the lineup's Fargo ratings. Any lineup size.",
  },
  fargo_games_won: {
    title: 'Games to win — Fargo',
    blurb:
      "Derives how many games each team needs to win from the lineup's Fargo ratings. Any lineup size.",
  },
  games_needed_3v3_formula: {
    title: 'Games to win — Points formula',
    blurb:
      'Computes the win/tie/lose targets from the points handicap gap. Scales to any lineup size.',
  },
  games_needed_5v5_formula: {
    title: 'Games to win — Percentage formula',
    blurb: 'Computes the win target from the percentage handicap gap. Any lineup size.',
  },
  chart_lookup_3v3: {
    title: 'Games to win — Points chart (3-player)',
    blurb: 'The built-in 3-player points lookup table.',
  },
  read_pref: {
    title: 'Reads a league setting',
    blurb: 'Reads a number you configure in league settings. The same for both sides.',
  },
  arithmetic_round_product: {
    title: 'Milestone — a percent of another number',
    blurb: 'Multiplies two league settings and rounds. The same for both sides.',
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
  const code = builtinCode(definition.operationKind);
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div>
        <Label className="text-xs uppercase text-muted-foreground">Built-in calculation</Label>
        <div className="font-medium">{info.title}</div>
        <p className="text-sm text-muted-foreground">{info.blurb}</p>
      </div>

      {code && (
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">The code it runs</Label>
          <pre className="max-h-80 overflow-auto rounded-md border bg-background p-3 text-xs leading-relaxed">
            <code className="font-mono">{code}</code>
          </pre>
          <p className="text-xs text-muted-foreground">
            This is the real code that runs — read-only for now. It's a small program with
            its own logic (not a one-line formula), so editing it is a later, code-editor step.
          </p>
        </div>
      )}
    </div>
  );
}
